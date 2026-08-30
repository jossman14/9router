import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";
import { getTier, TIERS } from "@/lib/saas/config.js";

const STATUSES = ["pending", "paid", "cancelled"];

function rowToOrder(row) {
  if (!row) return null;
  return { ...row, amountUsd: Number(row.amountUsd) || 0 };
}

export async function listOrders({ userId = null, status = null, limit = 200 } = {}) {
  const db = await getAdapter();
  const conds = [];
  const params = [];
  if (userId) { conds.push("o.userId = ?"); params.push(userId); }
  if (status) { conds.push("o.status = ?"); params.push(status); }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const rows = db.all(
    `SELECT o.*, u.email AS userEmail, u.name AS userName
     FROM orders o LEFT JOIN users u ON u.id = o.userId
     ${where} ORDER BY o.createdAt DESC LIMIT ?`,
    [...params, limit]
  );
  return rows.map(rowToOrder);
}

export async function getOrderById(id) {
  const db = await getAdapter();
  return rowToOrder(db.get(`SELECT * FROM orders WHERE id = ?`, [id]));
}

export async function createOrder({ userId, tier, amountUsd, note = "", createdBy = "admin", status = "pending" }) {
  if (!TIERS[tier]) throw new Error(`Unknown tier: ${tier}`);
  if (!STATUSES.includes(status)) throw new Error(`Unknown status: ${status}`);
  const db = await getAdapter();
  if (!db.get(`SELECT id FROM users WHERE id = ?`, [userId])) throw new Error("Unknown user");

  const now = new Date().toISOString();
  const order = {
    id: uuidv4(),
    userId,
    tier,
    amountUsd: amountUsd ?? getTier(tier).priceUsd,
    status,
    note,
    createdBy,
    createdAt: now,
    updatedAt: now,
  };
  db.run(
    `INSERT INTO orders(id, userId, tier, amountUsd, status, note, createdBy, createdAt, updatedAt)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [order.id, order.userId, order.tier, order.amountUsd, order.status,
     order.note, order.createdBy, order.createdAt, order.updatedAt]
  );
  if (status === "paid") await applyPaidOrder(order.id);
  return getOrderById(order.id);
}

/**
 * Marking an order paid is the only thing that moves a user's plan. Tier change
 * and period reset happen in one transaction with the status flip, so a crash
 * cannot leave an order marked paid without the plan actually applied.
 */
export async function applyPaidOrder(id) {
  const db = await getAdapter();
  let applied = false;
  db.transaction(() => {
    const order = db.get(`SELECT * FROM orders WHERE id = ?`, [id]);
    if (!order || order.status === "paid") {
      // Re-applying a paid order would silently reset the billing period.
      if (order?.status === "paid") applied = true;
      return;
    }
    const now = new Date().toISOString();
    const quota = getTier(order.tier).tokenQuota;
    db.run(`UPDATE orders SET status = 'paid', updatedAt = ? WHERE id = ?`, [now, id]);
    db.run(
      `UPDATE users SET tier = ?, tokenQuota = ?, tokensUsed = 0, periodStart = ?, updatedAt = ?
       WHERE id = ?`,
      [order.tier, quota, now, now, order.userId]
    );
    applied = true;
  });
  return applied ? getOrderById(id) : null;
}

export async function setOrderStatus(id, status) {
  if (!STATUSES.includes(status)) throw new Error(`Unknown status: ${status}`);
  if (status === "paid") return applyPaidOrder(id);
  const db = await getAdapter();
  db.run(`UPDATE orders SET status = ?, updatedAt = ? WHERE id = ?`,
    [status, new Date().toISOString(), id]);
  return getOrderById(id);
}

export async function deleteOrder(id) {
  const db = await getAdapter();
  return (db.run(`DELETE FROM orders WHERE id = ?`, [id])?.changes ?? 0) > 0;
}

/** Revenue is counted from paid orders only. */
export async function getRevenueSummary() {
  const db = await getAdapter();
  const row = db.get(
    `SELECT COUNT(*) AS paidOrders, COALESCE(SUM(amountUsd), 0) AS revenueUsd
     FROM orders WHERE status = 'paid'`
  ) || {};
  const pending = db.get(`SELECT COUNT(*) AS n FROM orders WHERE status = 'pending'`)?.n ?? 0;
  return {
    paidOrders: Number(row.paidOrders) || 0,
    revenueUsd: Number(row.revenueUsd) || 0,
    pendingOrders: Number(pending) || 0,
  };
}
