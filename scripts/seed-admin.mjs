#!/usr/bin/env node
/**
 * Create (or promote) the admin account for SaaS mode.
 *
 * Run this BEFORE switching SAAS_MODE on: once it is on, the operator console
 * is admin-only, and an install with no admin locks you out of your own gateway.
 *
 *   node scripts/seed-admin.mjs <email> <password>
 *
 * Re-running with an existing email promotes that account to admin and resets
 * its password, so it doubles as a recovery tool.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";

const [, , email, password] = process.argv;

if (!email || !password) {
  console.error("Usage: node scripts/seed-admin.mjs <email> <password>");
  process.exit(2);
}
if (password.length < 10) {
  console.error("Password must be at least 10 characters.");
  process.exit(2);
}

// The repo uses the "@/..." alias, which only Next resolves — import by path.
const root = path.resolve(import.meta.dirname, "..");
const load = (rel) => import(pathToFileURL(path.join(root, rel)).href);

const { getAdapter } = await load("src/lib/db/driver.js");
const { seedPackagesIfEmpty } = await load("src/lib/db/repos/packagesRepo.js");
const { createUser, getUserByEmail, setUserPassword } = await load("src/lib/db/repos/usersRepo.js");
const { ensureSubscription } = await load("src/lib/db/repos/subscriptionsRepo.js");

const db = await getAdapter();
await seedPackagesIfEmpty();

const normalized = email.trim().toLowerCase();
const existing = await getUserByEmail(normalized);

let userId;
if (existing) {
  userId = existing.id;
  await setUserPassword(userId, password);
  db.run(`UPDATE users SET role = 'admin', isActive = 1, updatedAt = ? WHERE id = ?`,
    [new Date().toISOString(), userId]);
  console.log(`Promoted existing account to admin and reset its password: ${normalized}`);
} else {
  const user = await createUser({ email: normalized, password, name: "Admin", role: "admin" });
  userId = user.id;
  console.log(`Created admin account: ${normalized}`);
}

await ensureSubscription(userId);

const row = db.get(`SELECT email, role, isActive FROM users WHERE id = ?`, [userId]);
console.log(`Verified: email=${row.email} role=${row.role} active=${row.isActive}`);
console.log("\nSign in at /login with this email and password.");
process.exit(0);
