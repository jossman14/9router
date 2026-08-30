import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { getAdapter } from "../driver.js";
import { getTier, DEFAULT_TIER, PERIOD_MS } from "@/lib/saas/config.js";

const BCRYPT_ROUNDS = 12;

function rowToUser(row) {
  if (!row) return null;
  const { passwordHash, ...rest } = row;
  return {
    ...rest,
    isActive: row.isActive === 1 || row.isActive === true,
    tokenQuota: Number(row.tokenQuota) || 0,
    tokensUsed: Number(row.tokensUsed) || 0,
  };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export async function getUserByEmail(email) {
  const db = await getAdapter();
  return db.get(`SELECT * FROM users WHERE email = ?`, [normalizeEmail(email)]) || null;
}

export async function getUserById(id) {
  const db = await getAdapter();
  return rowToUser(db.get(`SELECT * FROM users WHERE id = ?`, [id]));
}

export async function listUsers() {
  const db = await getAdapter();
  return db.all(`SELECT * FROM users ORDER BY createdAt DESC`).map(rowToUser);
}

export async function createUser({ email, password, name = "", tier = DEFAULT_TIER, role = "user" }) {
  const db = await getAdapter();
  const normalized = normalizeEmail(email);
  if (!normalized || !password) throw new Error("email and password are required");
  if (db.get(`SELECT id FROM users WHERE email = ?`, [normalized])) {
    const err = new Error("Email already registered");
    err.code = "EMAIL_TAKEN";
    throw err;
  }
  const now = new Date().toISOString();
  const user = {
    id: uuidv4(),
    email: normalized,
    passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    name: name || normalized.split("@")[0],
    role,
    tier,
    tokenQuota: getTier(tier).tokenQuota,
    tokensUsed: 0,
    periodStart: now,
    tokenVersion: 1,
    isActive: 1,
    createdAt: now,
    updatedAt: now,
  };
  db.run(
    `INSERT INTO users(id, email, passwordHash, name, role, tier, tokenQuota, tokensUsed, periodStart, tokenVersion, isActive, createdAt, updatedAt)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [user.id, user.email, user.passwordHash, user.name, user.role, user.tier, user.tokenQuota,
     0, user.periodStart, 1, 1, user.createdAt, user.updatedAt]
  );
  return rowToUser(user);
}

export async function verifyUserPassword(email, password) {
  const row = await getUserByEmail(email);
  if (!row) {
    // Constant-ish work on the miss path so response time doesn't leak whether
    // the email exists.
    await bcrypt.compare(String(password || ""), "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
    return null;
  }
  const ok = await bcrypt.compare(String(password || ""), row.passwordHash);
  if (!ok || !(row.isActive === 1 || row.isActive === true)) return null;
  return rowToUser(row);
}

export async function setUserPassword(id, password) {
  const db = await getAdapter();
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  db.run(
    `UPDATE users SET passwordHash = ?, tokenVersion = tokenVersion + 1, updatedAt = ? WHERE id = ?`,
    [hash, new Date().toISOString(), id]
  );
  return true;
}

export async function setUserTier(id, tier) {
  const db = await getAdapter();
  const t = getTier(tier);
  db.run(
    `UPDATE users SET tier = ?, tokenQuota = ?, updatedAt = ? WHERE id = ?`,
    [tier, t.tokenQuota, new Date().toISOString(), id]
  );
  return getUserById(id);
}

export async function setUserActive(id, isActive) {
  const db = await getAdapter();
  db.run(`UPDATE users SET isActive = ?, updatedAt = ? WHERE id = ?`,
    [isActive ? 1 : 0, new Date().toISOString(), id]);
  return getUserById(id);
}

/**
 * Roll the billing period if it has elapsed, then return the fresh row.
 * Called on the hot path, so it only writes when a reset is actually due.
 */
export async function rollPeriodIfDue(id) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM users WHERE id = ?`, [id]);
  if (!row) return null;
  const started = Date.parse(row.periodStart || "") || 0;
  if (started && Date.now() - started < PERIOD_MS) return rowToUser(row);
  const now = new Date().toISOString();
  db.run(`UPDATE users SET tokensUsed = 0, periodStart = ?, updatedAt = ? WHERE id = ?`, [now, now, id]);
  return rowToUser({ ...row, tokensUsed: 0, periodStart: now });
}
