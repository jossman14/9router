// Self-check for the 3-role model and the purchase flow.
// Roles: default (SAAS off) / admin / user.
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "9r-roles-"));
process.env.DATA_DIR = tmp;
process.env.API_KEY_SECRET = "test-pepper-that-is-long-enough-for-hmac";

let createUser, getUserById, listUsers, setUserTier;
let createOrder, applyPaidOrder, setOrderStatus, listOrders, getRevenueSummary;

beforeAll(async () => {
  ({ createUser, getUserById, listUsers, setUserTier } = await import("@/lib/db/repos/usersRepo.js"));
  ({ createOrder, applyPaidOrder, setOrderStatus, listOrders, getRevenueSummary } =
    await import("@/lib/db/repos/ordersRepo.js"));
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
  it("a pending order does not change the user's plan", async () => {
    const u = await createUser({ email: "buyer@example.com", password: "password123" });
    expect(u.tier).toBe("free");

    const order = await createOrder({ userId: u.id, tier: "pro", status: "pending" });
    expect(order.status).toBe("pending");
    expect(order.amountUsd).toBe(49); // defaults to the tier price

    const after = await getUserById(u.id);
    expect(after.tier).toBe("free");
    expect(after.tokenQuota).toBe(100_000);
  });

  it("marking an order paid applies the tier and resets the period", async () => {
    const u = await createUser({ email: "buyer2@example.com", password: "password123" });
    const order = await createOrder({ userId: u.id, tier: "pro", status: "pending" });

    // Burn some quota first so the reset is observable.
    await setUserTier(u.id, "free");
    const paid = await applyPaidOrder(order.id);
    expect(paid.status).toBe("paid");

    const after = await getUserById(u.id);
    expect(after.tier).toBe("pro");
    expect(after.tokenQuota).toBe(10_000_000);
    expect(after.tokensUsed).toBe(0);
  });

  it("re-applying a paid order does not reset the period again", async () => {
    const u = await createUser({ email: "buyer3@example.com", password: "password123" });
    const order = await createOrder({ userId: u.id, tier: "starter", status: "paid" });
    const first = await getUserById(u.id);

    const again = await applyPaidOrder(order.id);
    expect(again.status).toBe("paid");
    const second = await getUserById(u.id);
    expect(second.periodStart).toBe(first.periodStart);
  });

  it("cancelling leaves the plan untouched", async () => {
    const u = await createUser({ email: "buyer4@example.com", password: "password123" });
    const order = await createOrder({ userId: u.id, tier: "scale", status: "pending" });
    await setOrderStatus(order.id, "cancelled");

    const after = await getUserById(u.id);
    expect(after.tier).toBe("free");
    expect((await listOrders({ userId: u.id }))[0].status).toBe("cancelled");
  });

  it("rejects an unknown tier and an unknown user", async () => {
    const u = await createUser({ email: "buyer5@example.com", password: "password123" });
    await expect(createOrder({ userId: u.id, tier: "platinum" })).rejects.toThrow(/Unknown tier/);
    await expect(createOrder({ userId: "does-not-exist", tier: "pro" })).rejects.toThrow(/Unknown user/);
  });

  it("counts revenue from paid orders only", async () => {
    const before = await getRevenueSummary();
    const u = await createUser({ email: "buyer6@example.com", password: "password123" });
    await createOrder({ userId: u.id, tier: "pro", amountUsd: 100, status: "pending" });

    const mid = await getRevenueSummary();
    expect(mid.revenueUsd).toBe(before.revenueUsd);
    expect(mid.pendingOrders).toBe(before.pendingOrders + 1);

    const o = await createOrder({ userId: u.id, tier: "starter", amountUsd: 25, status: "paid" });
    expect(o.status).toBe("paid");
    const after = await getRevenueSummary();
    expect(after.revenueUsd).toBe(before.revenueUsd + 25);
  });

  it("scopes order listing to one user", async () => {
    const a = await createUser({ email: "iso1@example.com", password: "password123" });
    const b = await createUser({ email: "iso2@example.com", password: "password123" });
    await createOrder({ userId: a.id, tier: "pro", status: "pending" });

    expect(await listOrders({ userId: a.id })).toHaveLength(1);
    expect(await listOrders({ userId: b.id })).toHaveLength(0);
  });

  it("lists users for the admin console", async () => {
    const all = await listUsers();
    expect(all.length).toBeGreaterThan(3);
    expect(all.every((u) => !("passwordHash" in u))).toBe(true);
  });
});
