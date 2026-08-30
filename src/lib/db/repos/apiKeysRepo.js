import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";
import { SAAS_MODE, getTier } from "@/lib/saas/config.js";
import { generateKey, hashKey } from "@/lib/saas/keys.js";

function rowToKey(row) {
  if (!row) return null;
  return {
    id: row.id,
    // SaaS rows store only the hash, so never surface `key` for them — the
    // plaintext is shown once, at creation.
    key: row.userId ? null : row.key,
    keyPrefix: row.keyPrefix || null,
    name: row.name,
    machineId: row.machineId,
    userId: row.userId || null,
    lastUsedAt: row.lastUsedAt || null,
    isActive: row.isActive === 1 || row.isActive === true,
    createdAt: row.createdAt,
  };
}

export async function getApiKeys(userId = null) {
  const db = await getAdapter();
  const rows = userId
    ? db.all(`SELECT * FROM apiKeys WHERE userId = ? ORDER BY createdAt ASC`, [userId])
    : db.all(`SELECT * FROM apiKeys ORDER BY createdAt ASC`);
  return rows.map(rowToKey);
}

export async function getApiKeyById(id) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
  return rowToKey(row);
}

/**
 * SaaS: createApiKey(name, null, userId) → hashed, user-owned, tier-capped.
 * Legacy: createApiKey(name, machineId) → unchanged machine-bound plaintext key.
 */
export async function createApiKey(name, machineId, userId = null) {
  const db = await getAdapter();
  const now = new Date().toISOString();

  if (SAAS_MODE || userId) {
    if (!userId) throw new Error("userId is required in SAAS_MODE");
    const user = db.get(`SELECT tier FROM users WHERE id = ?`, [userId]);
    if (!user) throw new Error("Unknown user");
    const count = db.get(`SELECT COUNT(*) AS n FROM apiKeys WHERE userId = ?`, [userId])?.n ?? 0;
    const maxKeys = getTier(user.tier).maxKeys;
    if (count >= maxKeys) {
      const err = new Error(`Key limit reached for the ${user.tier} plan (${maxKeys})`);
      err.code = "KEY_LIMIT";
      throw err;
    }
    const { key, keyHash, keyPrefix } = generateKey();
    const id = uuidv4();
    db.run(
      `INSERT INTO apiKeys(id, key, name, machineId, userId, keyPrefix, isActive, createdAt)
       VALUES(?, ?, ?, NULL, ?, ?, 1, ?)`,
      [id, keyHash, name, userId, keyPrefix, now]
    );
    // Plaintext returned once and never stored.
    return { id, key, keyPrefix, name, userId, isActive: true, createdAt: now };
  }

  if (!machineId) throw new Error("machineId is required");
  const { generateApiKeyWithMachine } = await import("@/shared/utils/apiKey");
  const result = generateApiKeyWithMachine(machineId);
  const apiKey = {
    id: uuidv4(), name, key: result.key, machineId, isActive: true, createdAt: now,
  };
  db.run(
    `INSERT INTO apiKeys(id, key, name, machineId, isActive, createdAt) VALUES(?, ?, ?, ?, ?, ?)`,
    [apiKey.id, apiKey.key, apiKey.name, apiKey.machineId, 1, apiKey.createdAt]
  );
  return apiKey;
}

export async function updateApiKey(id, data) {
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
    if (!row) return;
    // `key` is never client-writable — rotating means deleting and re-creating.
    const name = data.name !== undefined ? data.name : row.name;
    const isActive = data.isActive !== undefined ? (data.isActive ? 1 : 0) : row.isActive;
    db.run(`UPDATE apiKeys SET name = ?, isActive = ? WHERE id = ?`, [name, isActive, id]);
    result = rowToKey({ ...row, name, isActive });
  });
  return result;
}

export async function deleteApiKey(id, userId = null) {
  const db = await getAdapter();
  const res = userId
    ? db.run(`DELETE FROM apiKeys WHERE id = ? AND userId = ?`, [id, userId])
    : db.run(`DELETE FROM apiKeys WHERE id = ?`, [id]);
  return (res?.changes ?? 0) > 0;
}

/**
 * Resolve a presented key to its row. Matches the raw value (legacy plaintext
 * rows) or its hash (SaaS rows) in one query, so both formats keep working.
 */
export async function findApiKeyRow(key) {
  if (!key) return null;
  const db = await getAdapter();
  return db.get(`SELECT * FROM apiKeys WHERE key = ? OR key = ?`, [key, hashKey(key)]) || null;
}

export async function validateApiKey(key) {
  const row = await findApiKeyRow(key);
  if (!row) return false;
  return row.isActive === 1 || row.isActive === true;
}

export async function touchApiKey(id) {
  const db = await getAdapter();
  db.run(`UPDATE apiKeys SET lastUsedAt = ? WHERE id = ?`, [new Date().toISOString(), id]);
}
