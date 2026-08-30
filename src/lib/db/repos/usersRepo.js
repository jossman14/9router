import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { getAdapter } from "../driver.js";
import { ADMIN_EMAIL } from "../../saas/config.js";

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
  // Join the selected subscription so the admin console shows the plan a user
  // is actually spending against, not a stale column.
  return db.all(
    `SELECT u.*,
            s.id AS subscriptionId, s.packageId, s.packageName,
            COALESCE(s.tokenQuota, 0) AS subTokenQuota,
            COALESCE(s.tokensUsed, 0) AS subTokensUsed,
            s.expiresAt
     FROM users u
     LEFT JOIN subscriptions s ON s.userId = u.id AND s.isSelected = 1 AND s.status = 'active'
     ORDER BY u.createdAt DESC`
  ).map((r) => {
    const u = rowToUser(r);
    return {
      ...u,
      subscriptionId: r.subscriptionId || null,
      packageId: r.packageId || null,
      packageName: r.packageName || null,
      tokenQuota: Number(r.subTokenQuota) || 0,
      tokensUsed: Number(r.subTokensUsed) || 0,
      expiresAt: r.expiresAt || null,
    };
  });
}

/**
 * Decide the role for a brand-new account.
 *
 * ADMIN_EMAIL is the deliberate way to nominate the operator. The empty-table
 * fallback exists so a fresh install is administrable at all, but it is a race
 * if the site is public before anyone registers — hence the warning. Set
 * ADMIN_EMAIL before opening signups.
 */
function resolveRole(db, email, explicitRole) {
  if (explicitRole) return explicitRole;
  if (ADMIN_EMAIL && email === ADMIN_EMAIL) return "admin";
  const count = db.get(`SELECT COUNT(*) AS n FROM users`)?.n ?? 0;
  if (count === 0) {
    console.warn(
      "[SaaS] First account created with no ADMIN_EMAIL set — granting admin to " +
      `${email}. Set ADMIN_EMAIL before exposing signups publicly.`
    );
    return "admin";
  }
  return "user";
}

export async function createUser({ email, password, name = "", role = null }) {
  const db = await getAdapter();
  const normalized = normalizeEmail(email);
  if (!normalized || !password) throw new Error("email and password are required");
  if (db.get(`SELECT id FROM users WHERE email = ?`, [normalized])) {
    const err = new Error("Email already registered");
    err.code = "EMAIL_TAKEN";
    throw err;
  }
  const resolvedRole = resolveRole(db, normalized, role);
  const now = new Date().toISOString();
  const user = {
    id: uuidv4(),
    email: normalized,
    passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    name: name || normalized.split("@")[0],
    role: resolvedRole,
    // The tier/quota columns are legacy: quota lives on `subscriptions` now.
    // They stay nulled out so nothing reads a stale value by accident.
    tier: null,
    tokenQuota: 0,
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


export async function setUserActive(id, isActive) {
  const db = await getAdapter();
  db.run(`UPDATE users SET isActive = ?, updatedAt = ? WHERE id = ?`,
    [isActive ? 1 : 0, new Date().toISOString(), id]);
  return getUserById(id);
}

