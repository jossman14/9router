import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";

// Seeded once on an empty table so a fresh install has something to sell and
// every new signup has a free plan to land on. Admins edit these freely.
const SEED = [
  {
    name: "Free", description: "Coba gratis, tanpa kartu kredit.",
    priceIdr: 0, tokenQuota: 100_000, allowedModels: [], rpm: 10, maxKeys: 1,
    durationDays: 30, sortOrder: 0,
  },
  {
    name: "Hemat", description: "Untuk proyek kecil dan eksperimen.",
    priceIdr: 10_000, tokenQuota: 10_000_000, allowedModels: [], rpm: 60, maxKeys: 3,
    durationDays: 30, sortOrder: 1,
  },
  {
    name: "Pro", description: "Untuk aplikasi produksi.",
    priceIdr: 50_000, tokenQuota: 60_000_000, allowedModels: [], rpm: 300, maxKeys: 10,
    durationDays: 30, sortOrder: 2,
  },
];

function rowToPackage(row) {
  if (!row) return null;
  return {
    ...row,
    priceIdr: Number(row.priceIdr) || 0,
    tokenQuota: Number(row.tokenQuota) || 0,
    rpm: Number(row.rpm) || 60,
    maxKeys: Number(row.maxKeys) || 3,
    durationDays: Number(row.durationDays) || 30,
    sortOrder: Number(row.sortOrder) || 0,
    isActive: row.isActive === 1 || row.isActive === true,
    allowedModels: parseJson(row.allowedModels, []),
  };
}

function normalizeModels(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.map((m) => String(m).trim()).filter(Boolean))];
}

export async function seedPackagesIfEmpty() {
  const db = await getAdapter();
  if ((db.get(`SELECT COUNT(*) AS n FROM packages`)?.n ?? 0) > 0) return false;
  for (const p of SEED) await createPackage(p);
  console.log(`[SaaS] Seeded ${SEED.length} default packages.`);
  return true;
}

export async function listPackages({ activeOnly = false } = {}) {
  const db = await getAdapter();
  const rows = activeOnly
    ? db.all(`SELECT * FROM packages WHERE isActive = 1 ORDER BY sortOrder ASC, priceIdr ASC`)
    : db.all(`SELECT * FROM packages ORDER BY sortOrder ASC, priceIdr ASC`);
  return rows.map(rowToPackage);
}

export async function getPackageById(id) {
  const db = await getAdapter();
  return rowToPackage(db.get(`SELECT * FROM packages WHERE id = ?`, [id]));
}

/** The plan new signups land on: cheapest active package (normally Free). */
export async function getDefaultPackage() {
  const db = await getAdapter();
  return rowToPackage(
    db.get(`SELECT * FROM packages WHERE isActive = 1 ORDER BY priceIdr ASC, sortOrder ASC LIMIT 1`)
  );
}

export async function createPackage(data) {
  const db = await getAdapter();
  const name = String(data.name || "").trim();
  if (!name) throw new Error("Nama paket wajib diisi");
  const now = new Date().toISOString();
  const pkg = {
    id: uuidv4(),
    name,
    description: String(data.description || "").slice(0, 300),
    priceIdr: Math.max(0, Math.round(Number(data.priceIdr) || 0)),
    tokenQuota: Math.max(0, Math.round(Number(data.tokenQuota) || 0)),
    allowedModels: normalizeModels(data.allowedModels),
    rpm: Math.max(1, Math.round(Number(data.rpm) || 60)),
    maxKeys: Math.max(1, Math.round(Number(data.maxKeys) || 3)),
    durationDays: Math.max(1, Math.round(Number(data.durationDays) || 30)),
    isActive: data.isActive === false ? 0 : 1,
    sortOrder: Math.round(Number(data.sortOrder) || 0),
  };
  db.run(
    `INSERT INTO packages(id, name, description, priceIdr, tokenQuota, allowedModels, rpm, maxKeys, durationDays, isActive, sortOrder, createdAt, updatedAt)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [pkg.id, pkg.name, pkg.description, pkg.priceIdr, pkg.tokenQuota,
     stringifyJson(pkg.allowedModels), pkg.rpm, pkg.maxKeys, pkg.durationDays,
     pkg.isActive, pkg.sortOrder, now, now]
  );
  return getPackageById(pkg.id);
}

export async function updatePackage(id, data) {
  const db = await getAdapter();
  const cur = await getPackageById(id);
  if (!cur) return null;
  const merged = {
    name: data.name !== undefined ? String(data.name).trim() || cur.name : cur.name,
    description: data.description !== undefined ? String(data.description).slice(0, 300) : cur.description,
    priceIdr: data.priceIdr !== undefined ? Math.max(0, Math.round(Number(data.priceIdr) || 0)) : cur.priceIdr,
    tokenQuota: data.tokenQuota !== undefined ? Math.max(0, Math.round(Number(data.tokenQuota) || 0)) : cur.tokenQuota,
    allowedModels: data.allowedModels !== undefined ? normalizeModels(data.allowedModels) : cur.allowedModels,
    rpm: data.rpm !== undefined ? Math.max(1, Math.round(Number(data.rpm) || 60)) : cur.rpm,
    maxKeys: data.maxKeys !== undefined ? Math.max(1, Math.round(Number(data.maxKeys) || 3)) : cur.maxKeys,
    durationDays: data.durationDays !== undefined ? Math.max(1, Math.round(Number(data.durationDays) || 30)) : cur.durationDays,
    isActive: data.isActive !== undefined ? (data.isActive ? 1 : 0) : (cur.isActive ? 1 : 0),
    sortOrder: data.sortOrder !== undefined ? Math.round(Number(data.sortOrder) || 0) : cur.sortOrder,
  };
  db.run(
    `UPDATE packages SET name = ?, description = ?, priceIdr = ?, tokenQuota = ?, allowedModels = ?,
     rpm = ?, maxKeys = ?, durationDays = ?, isActive = ?, sortOrder = ?, updatedAt = ? WHERE id = ?`,
    [merged.name, merged.description, merged.priceIdr, merged.tokenQuota,
     stringifyJson(merged.allowedModels), merged.rpm, merged.maxKeys, merged.durationDays,
     merged.isActive, merged.sortOrder, new Date().toISOString(), id]
  );
  return getPackageById(id);
}

/**
 * Packages are never hard-deleted while a subscription references one — the
 * snapshot on the subscription would still be valid but the purchase history
 * would lose its label. Deactivate instead.
 */
export async function deletePackage(id) {
  const db = await getAdapter();
  const inUse = db.get(`SELECT COUNT(*) AS n FROM subscriptions WHERE packageId = ?`, [id])?.n ?? 0;
  if (inUse > 0) {
    db.run(`UPDATE packages SET isActive = 0, updatedAt = ? WHERE id = ?`, [new Date().toISOString(), id]);
    return { deleted: false, deactivated: true };
  }
  const res = db.run(`DELETE FROM packages WHERE id = ?`, [id]);
  return { deleted: (res?.changes ?? 0) > 0, deactivated: false };
}
