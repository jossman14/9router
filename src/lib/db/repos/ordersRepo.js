import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";
import { getPackageById } from "./packagesRepo.js";
import { createSubscription } from "./subscriptionsRepo.js";

const STATUSES = ["pending", "paid", "cancelled"];

function rowToOrder(row) {
  if (!row) return null;
  return {
    ...row,
    amountIdr: Number(row.amountIdr) || 0,
    amountUsd: Number(row.amountUsd) || 0,
  };
}

export async function listOrders({ userId = null, status = null, limit = 200 } = {}) {
  const db = await getAdapter();
  const conds = [];
  const params = [];
  if (userId) { conds.push("o.userId = ?"); params.push(userId); }
  if (status) { conds.push("o.status = ?"); params.push(status); }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  return db.all(
    `SELECT o.*, u.email AS userEmail, u.name AS userName
     FROM orders o LEFT JOIN users u ON u.id = o.userId
     ${where} ORDER BY o.createdAt DESC LIMIT ?`,
    [...params, limit]
  ).map(rowToOrder);
}

export async function getOrderById(id) {
  const db = await getAdapter();
  return rowToOrder(db.get(`SELECT * FROM orders WHERE id = ?`, [id]));
}

export async function createOrder({ userId, packageId, amountIdr, note = "", createdBy = "admin", status = "pending" }) {
  if (!STATUSES.includes(status)) throw new Error(`Status tidak dikenal: ${status}`);
  const db = await getAdapter();
  if (!db.get(`SELECT id FROM users WHERE id = ?`, [userId])) throw new Error("Pengguna tidak ditemukan");

  const pkg = await getPackageById(packageId);
  if (!pkg) throw new Error("Paket tidak ditemukan");

  const now = new Date().toISOString();
  const id = uuidv4();
  db.run(
    `INSERT INTO orders(id, userId, packageId, packageName, amountIdr, amountUsd, status, note, createdBy, createdAt, updatedAt)
     VALUES(?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
    [id, userId, pkg.id, pkg.name,
     amountIdr === undefined || amountIdr === null || amountIdr === ""
       ? pkg.priceIdr
       : Math.max(0, Math.round(Number(amountIdr) || 0)),
     status, String(note || "").slice(0, 300), createdBy, now, now]
  );
  if (status === "paid") return applyPaidOrder(id);
  return getOrderById(id);
}

/**
 * Marking an order paid is the only thing that grants a package. It issues a
 * fresh subscription carrying its own token balance — it does not top up an
 * existing one, so the user keeps a clear per-purchase history.
 */
export async function applyPaidOrder(id) {
  const db = await getAdapter();
  const order = db.get(`SELECT * FROM orders WHERE id = ?`, [id]);
  if (!order) return null;
  // Re-applying would hand out a second subscription for one payment.
  if (order.status === "paid") return getOrderById(id);

  db.run(`UPDATE orders SET status = 'paid', updatedAt = ? WHERE id = ?`,
    [new Date().toISOString(), id]);
  await createSubscription({
    userId: order.userId,
    packageId: order.packageId,
    orderId: id,
    select: true,
  });
  return getOrderById(id);
}

export async function setOrderStatus(id, status) {
  if (!STATUSES.includes(status)) throw new Error(`Status tidak dikenal: ${status}`);
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
    `SELECT COUNT(*) AS paidOrders, COALESCE(SUM(amountIdr), 0) AS revenueIdr
     FROM orders WHERE status = 'paid'`
  ) || {};
  const pending = db.get(`SELECT COUNT(*) AS n FROM orders WHERE status = 'pending'`)?.n ?? 0;
  return {
    paidOrders: Number(row.paidOrders) || 0,
    revenueIdr: Number(row.revenueIdr) || 0,
    pendingOrders: Number(pending) || 0,
  };
}
