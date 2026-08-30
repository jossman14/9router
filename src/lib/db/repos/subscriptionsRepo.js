import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";
import { getPackageById, getDefaultPackage } from "./packagesRepo.js";

function rowToSub(row) {
  if (!row) return null;
  const quota = Number(row.tokenQuota) || 0;
  const used = Number(row.tokensUsed) || 0;
  return {
    ...row,
    tokenQuota: quota,
    tokensUsed: used,
    tokensRemaining: Math.max(0, quota - used),
    usedPercent: quota ? Math.min(100, (used / quota) * 100) : 0,
    rpm: Number(row.rpm) || 60,
    maxKeys: Number(row.maxKeys) || 3,
    isSelected: row.isSelected === 1 || row.isSelected === true,
    allowedModels: parseJson(row.allowedModels, []),
    isExpired: !!row.expiresAt && Date.parse(row.expiresAt) < Date.now(),
  };
}

export async function listSubscriptions(userId) {
  const db = await getAdapter();
  return db
    .all(`SELECT * FROM subscriptions WHERE userId = ? ORDER BY createdAt DESC`, [userId])
    .map(rowToSub);
}

export async function getSubscriptionById(id) {
  const db = await getAdapter();
  return rowToSub(db.get(`SELECT * FROM subscriptions WHERE id = ?`, [id]));
}

/**
 * The subscription the gateway charges: the user's selected one, as long as it
 * is active and unexpired. Returns null when they have nothing usable, which
 * the quota gate turns into a clear "no active package" error.
 */
export async function getActiveSubscription(userId) {
  const db = await getAdapter();
  const row = db.get(
    `SELECT * FROM subscriptions
     WHERE userId = ? AND isSelected = 1 AND status = 'active'
     LIMIT 1`,
    [userId]
  );
  const sub = rowToSub(row);
  if (!sub) return null;
  if (sub.isExpired) {
    db.run(`UPDATE subscriptions SET status = 'expired', updatedAt = ? WHERE id = ?`,
      [new Date().toISOString(), sub.id]);
    return null;
  }
  return sub;
}

export async function createSubscription({ userId, packageId, orderId = null, select = true }) {
  const db = await getAdapter();
  const pkg = packageId ? await getPackageById(packageId) : await getDefaultPackage();
  if (!pkg) throw new Error("Paket tidak ditemukan");

  const now = new Date();
  const nowIso = now.toISOString();
  const expires = new Date(now.getTime() + pkg.durationDays * 86400_000).toISOString();
  const id = uuidv4();

  db.transaction(() => {
    // Only one selected subscription per user, enforced by clearing first.
    if (select) db.run(`UPDATE subscriptions SET isSelected = 0 WHERE userId = ?`, [userId]);
    db.run(
      `INSERT INTO subscriptions(id, userId, packageId, packageName, tokenQuota, tokensUsed,
        allowedModels, rpm, maxKeys, status, isSelected, orderId, startedAt, expiresAt, createdAt, updatedAt)
       VALUES(?, ?, ?, ?, ?, 0, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)`,
      [id, userId, pkg.id, pkg.name, pkg.tokenQuota, stringifyJson(pkg.allowedModels),
       pkg.rpm, pkg.maxKeys, select ? 1 : 0, orderId, nowIso, expires, nowIso, nowIso]
    );
  });
  return getSubscriptionById(id);
}

/** User picks which purchased package their traffic draws from. */
export async function selectSubscription(userId, subscriptionId) {
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = db.get(`SELECT * FROM subscriptions WHERE id = ? AND userId = ?`,
      [subscriptionId, userId]);
    if (!row) return;
    if (row.status !== "active") return;
    db.run(`UPDATE subscriptions SET isSelected = 0 WHERE userId = ?`, [userId]);
    db.run(`UPDATE subscriptions SET isSelected = 1, updatedAt = ? WHERE id = ?`,
      [new Date().toISOString(), subscriptionId]);
    result = { ...rowToSub(row), isSelected: true };
  });
  return result;
}

/** Ensures a user always has something to use — called on registration. */
export async function ensureSubscription(userId) {
  const existing = await getActiveSubscription(userId);
  if (existing) return existing;
  const pkg = await getDefaultPackage();
  if (!pkg) return null;
  return createSubscription({ userId, packageId: pkg.id, select: true });
}

export async function setSubscriptionStatus(id, status) {
  const db = await getAdapter();
  db.run(`UPDATE subscriptions SET status = ?, updatedAt = ? WHERE id = ?`,
    [status, new Date().toISOString(), id]);
  return getSubscriptionById(id);
}

/** Admin: top up or correct a balance without issuing a new subscription. */
export async function adjustSubscriptionQuota(id, tokenQuota) {
  const db = await getAdapter();
  db.run(`UPDATE subscriptions SET tokenQuota = ?, updatedAt = ? WHERE id = ?`,
    [Math.max(0, Math.round(Number(tokenQuota) || 0)), new Date().toISOString(), id]);
  return getSubscriptionById(id);
}
