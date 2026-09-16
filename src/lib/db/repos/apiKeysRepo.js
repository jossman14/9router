import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";
import { SAAS_MODE } from "../../saas/config.js";
import { generateKey, hashKey, decryptKey } from "../../saas/keys.js";

function rowToKey(row) {
  if (!row) return null;
  return {
    id: row.id,
    // SaaS lists expose neither the lookup hash nor the encrypted secret.
    // Plaintext is available at creation or through the owner-only reveal.
    key: row.userId ? null : row.key,
    // Boolean only — the ciphertext itself never leaves the repo.
    hasEncrypted: row.userId ? !!row.keyEncrypted : false,
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
    const user = db.get(`SELECT id FROM users WHERE id = ?`, [userId]);
    if (!user) throw new Error("Unknown user");
    // The key allowance comes from the package the user is currently on.
    const sub = db.get(
      `SELECT packageName, maxKeys FROM subscriptions
       WHERE userId = ? AND isSelected = 1 AND status = 'active' LIMIT 1`, [userId]
    );
    if (!sub) {
      const err = new Error("Belum ada paket aktif. Pilih paket dulu sebelum membuat API key.");
      err.code = "NO_PACKAGE";
      throw err;
    }
    const count = db.get(`SELECT COUNT(*) AS n FROM apiKeys WHERE userId = ?`, [userId])?.n ?? 0;
    const maxKeys = Number(sub.maxKeys) || 1;
    if (count >= maxKeys) {
      const err = new Error(`Batas API key untuk paket ${sub.packageName} tercapai (${maxKeys}).`);
      err.code = "KEY_LIMIT";
      throw err;
    }
    const { key, keyHash, keyPrefix, keyEncrypted } = generateKey();
    const id = uuidv4();
    db.run(
      `INSERT INTO apiKeys(id, key, name, machineId, userId, keyPrefix, keyEncrypted, isActive, createdAt)
       VALUES(?, ?, ?, NULL, ?, ?, ?, 1, ?)`,
      [id, keyHash, name, userId, keyPrefix, keyEncrypted, now]
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

/**
 * Owned reveal only — decrypts the stored ciphertext for the key's owner.
 * Off the hot path: never called from auth or metering. Returns null when
 * there is nothing stored (legacy rows) or the pepper/tag no longer matches.
 */
export async function revealApiKey(id, userId) {
  if (!id || !userId) return null;
  const db = await getAdapter();
  const row = db.get(`SELECT key, keyEncrypted FROM apiKeys WHERE id = ? AND userId = ?`, [id, userId]);
  if (!row?.keyEncrypted) return null;
  const plaintext = decryptKey(row.keyEncrypted);
  return plaintext && hashKey(plaintext) === row.key ? plaintext : null;
}

export async function touchApiKey(id) {
  const db = await getAdapter();
  db.run(`UPDATE apiKeys SET lastUsedAt = ? WHERE id = ?`, [new Date().toISOString(), id]);
}
