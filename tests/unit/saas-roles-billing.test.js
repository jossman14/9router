// Self-check for the 3-role model and the purchase flow.
// Roles: default (SAAS off) / admin / user.
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "9r-roles-"));
process.env.DATA_DIR = tmp;
process.env.API_KEY_SECRET = "test-pepper-that-is-long-enough-for-hmac";

let createUser, listUsers;
let createOrder, applyPaidOrder, setOrderStatus, listOrders, getRevenueSummary;
let seedPackagesIfEmpty, listPackages, createPackage;
let ensureSubscription, getActiveSubscription, listSubscriptions;
let PKG;

beforeAll(async () => {
  ({ createUser, listUsers } = await import("@/lib/db/repos/usersRepo.js"));
  ({ createOrder, applyPaidOrder, setOrderStatus, listOrders, getRevenueSummary } =
    await import("@/lib/db/repos/ordersRepo.js"));
  ({ seedPackagesIfEmpty, listPackages, createPackage } = await import("@/lib/db/repos/packagesRepo.js"));
  ({ ensureSubscription, getActiveSubscription, listSubscriptions } =
    await import("@/lib/db/repos/subscriptionsRepo.js"));
  await seedPackagesIfEmpty();
  PKG = await createPackage({ name: "Uji Pro", priceIdr: 50_000, tokenQuota: 10_000_000 });
});

describe("roles", () => {
  it("makes the first account an admin so a fresh install is administrable", async () => {
    const first = await createUser({ email: "boss@example.com", password: "password123" });
    expect(first.role).toBe("admin");
  });

  it("makes every later account a plain user", async () => {
    const second = await createUser({ email: "member@example.com", password: "password123" });
    expect(second.role).toBe("user");
    const third = await createUser({ email: "member2@example.com", password: "password123" });
    expect(third.role).toBe("user");
  });
});

describe("purchase flow", () => {
  it("a pending order grants nothing", async () => {
    const u = await createUser({ email: "buyer@example.com", password: "password123" });
    await ensureSubscription(u.id);
    expect((await getActiveSubscription(u.id)).tokenQuota).toBe(100_000);

    const order = await createOrder({ userId: u.id, packageId: PKG.id, status: "pending" });
    expect(order.status).toBe("pending");
    expect(order.amountIdr).toBe(50_000); // defaults to the package price

    expect((await getActiveSubscription(u.id)).tokenQuota).toBe(100_000);
  });

  it("marking an order paid issues the purchased package", async () => {
    const u = await createUser({ email: "buyer2@example.com", password: "password123" });
    await ensureSubscription(u.id);
    const order = await createOrder({ userId: u.id, packageId: PKG.id, status: "pending" });

    const paid = await applyPaidOrder(order.id);
    expect(paid.status).toBe("paid");

    const active = await getActiveSubscription(u.id);
    expect(active.packageName).toBe("Uji Pro");
    expect(active.tokenQuota).toBe(10_000_000);
    expect(active.tokensUsed).toBe(0);
  });

  it("re-applying a paid order does not grant a second package", async () => {
    const u = await createUser({ email: "buyer3@example.com", password: "password123" });
    const order = await createOrder({ userId: u.id, packageId: PKG.id, status: "paid" });
    const before = (await listSubscriptions(u.id)).length;

    await applyPaidOrder(order.id);
    expect((await listSubscriptions(u.id)).length).toBe(before);
  });

  it("cancelling leaves the plan untouched", async () => {
    const u = await createUser({ email: "buyer4@example.com", password: "password123" });
    await ensureSubscription(u.id);
    const order = await createOrder({ userId: u.id, packageId: PKG.id, status: "pending" });
    await setOrderStatus(order.id, "cancelled");

    expect((await getActiveSubscription(u.id)).tokenQuota).toBe(100_000);
    expect((await listOrders({ userId: u.id }))[0].status).toBe("cancelled");
  });

  it("rejects an unknown package and an unknown user", async () => {
    const u = await createUser({ email: "buyer5@example.com", password: "password123" });
    await expect(createOrder({ userId: u.id, packageId: "nope" })).rejects.toThrow(/Paket tidak ditemukan/);
    await expect(createOrder({ userId: "ghost", packageId: PKG.id })).rejects.toThrow(/Pengguna tidak ditemukan/);
  });

  it("counts rupiah revenue from paid orders only", async () => {
    const before = await getRevenueSummary();
    const u = await createUser({ email: "buyer6@example.com", password: "password123" });
    await createOrder({ userId: u.id, packageId: PKG.id, amountIdr: 100_000, status: "pending" });

    const mid = await getRevenueSummary();
    expect(mid.revenueIdr).toBe(before.revenueIdr);
    expect(mid.pendingOrders).toBe(before.pendingOrders + 1);

    await createOrder({ userId: u.id, packageId: PKG.id, amountIdr: 25_000, status: "paid" });
    expect((await getRevenueSummary()).revenueIdr).toBe(before.revenueIdr + 25_000);
  });

  it("scopes order listing to one user", async () => {
    const a = await createUser({ email: "iso1@example.com", password: "password123" });
    const b = await createUser({ email: "iso2@example.com", password: "password123" });
    await createOrder({ userId: a.id, packageId: PKG.id, status: "pending" });

    expect(await listOrders({ userId: a.id })).toHaveLength(1);
    expect(await listOrders({ userId: b.id })).toHaveLength(0);
  });

  it("lists users for the admin console without password hashes", async () => {
    const all = await listUsers();
    expect(all.length).toBeGreaterThan(3);
    expect(all.every((u) => !("passwordHash" in u))).toBe(true);
  });

  it("exposes an admin-editable catalogue", async () => {
    expect((await listPackages()).length).toBeGreaterThanOrEqual(4);
  });
});
