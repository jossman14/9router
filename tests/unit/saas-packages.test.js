// Self-check for admin-defined packages, per-subscription quota, model
// allow-lists, and the purchase -> subscription grant path.
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "9r-pkg-"));
process.env.DATA_DIR = tmp;
process.env.API_KEY_SECRET = "test-pepper-that-is-long-enough-for-hmac";

let createUser, createApiKey, authorizeApiKey, isModelAllowed, saveRequestUsage;
let seedPackagesIfEmpty, createPackage, listPackages, updatePackage;
let ensureSubscription, createSubscription, getActiveSubscription, listSubscriptions, selectSubscription;
let createOrder, applyPaidOrder, getRevenueSummary;

beforeAll(async () => {
  ({ createUser } = await import("@/lib/db/repos/usersRepo.js"));
  ({ createApiKey } = await import("@/lib/db/repos/apiKeysRepo.js"));
  ({ authorizeApiKey, isModelAllowed } = await import("@/lib/saas/quota.js"));
  ({ saveRequestUsage } = await import("@/lib/db/repos/usageRepo.js"));
  ({ seedPackagesIfEmpty, createPackage, listPackages, updatePackage } =
    await import("@/lib/db/repos/packagesRepo.js"));
  ({ ensureSubscription, createSubscription, getActiveSubscription, listSubscriptions, selectSubscription } =
    await import("@/lib/db/repos/subscriptionsRepo.js"));
  ({ createOrder, applyPaidOrder, getRevenueSummary } = await import("@/lib/db/repos/ordersRepo.js"));
  await seedPackagesIfEmpty();
});

describe("model allow-list matching", () => {
  it("treats an empty list as 'any model'", () => {
    expect(isModelAllowed([], "anything")).toBe(true);
  });
  it("matches bare and provider-qualified forms", () => {
    expect(isModelAllowed(["deepseek-v3"], "deepseek-v3")).toBe(true);
    expect(isModelAllowed(["deepseek-v3"], "deepseek/deepseek-v3")).toBe(true);
    expect(isModelAllowed(["deepseek-v3"], "glm-4")).toBe(false);
  });
  it("supports a provider wildcard", () => {
    expect(isModelAllowed(["qwen/*"], "qwen/qwen3-max")).toBe(true);
    expect(isModelAllowed(["qwen/*"], "glm/glm-4")).toBe(false);
  });
});

describe("packages", () => {
  it("seeds a default catalogue once", async () => {
    const pkgs = await listPackages();
    expect(pkgs.length).toBeGreaterThanOrEqual(3);
    expect(await seedPackagesIfEmpty()).toBe(false); // idempotent
  });

  it("stores an admin-defined package with price, quota and models", async () => {
    const pkg = await createPackage({
      name: "Paket Hemat 10rb",
      priceIdr: 10_000,
      tokenQuota: 10_000_000,
      allowedModels: ["deepseek-v3", "glm-4", "qwen/*"],
      rpm: 30, maxKeys: 2, durationDays: 30,
    });
    expect(pkg.priceIdr).toBe(10_000);
    expect(pkg.tokenQuota).toBe(10_000_000);
    expect(pkg.allowedModels).toEqual(["deepseek-v3", "glm-4", "qwen/*"]);
  });
});

describe("subscription quota", () => {
  it("gives a new account the free package and charges that balance", async () => {
    const u = await createUser({ email: "p1@example.com", password: "password123" });
    const sub = await ensureSubscription(u.id);
    expect(sub.tokenQuota).toBe(100_000);

    const key = await createApiKey("k", null, u.id);
    expect((await authorizeApiKey(key.key, "gpt-5")).ok).toBe(true);

    await saveRequestUsage({
      provider: "openai", model: "gpt-5", apiKey: key.key,
      tokens: { prompt_tokens: 60_000, completion_tokens: 0 },
      timestamp: new Date().toISOString(),
    });
    const after = await getActiveSubscription(u.id);
    expect(after.tokensUsed).toBe(60_000);
    expect(after.tokensRemaining).toBe(40_000);
  });

  it("blocks a model outside the package allow-list", async () => {
    const u = await createUser({ email: "p2@example.com", password: "password123" });
    const pkg = await createPackage({
      name: "Only DeepSeek", priceIdr: 5000, tokenQuota: 1_000_000,
      allowedModels: ["deepseek-v3"],
    });
    await createSubscription({ userId: u.id, packageId: pkg.id, select: true });
    const key = await createApiKey("k", null, u.id);

    expect((await authorizeApiKey(key.key, "deepseek-v3")).ok).toBe(true);
    const denied = await authorizeApiKey(key.key, "gpt-5");
    expect(denied.ok).toBe(false);
    expect(denied.status).toBe(403);
    expect(denied.error).toMatch(/tidak termasuk/);
  });

  it("refuses when the quota on the selected package is gone", async () => {
    const u = await createUser({ email: "p3@example.com", password: "password123" });
    const pkg = await createPackage({ name: "Tiny", priceIdr: 1000, tokenQuota: 100 });
    await createSubscription({ userId: u.id, packageId: pkg.id, select: true });
    const key = await createApiKey("k", null, u.id);

    await saveRequestUsage({
      provider: "openai", model: "m", apiKey: key.key,
      tokens: { prompt_tokens: 500, completion_tokens: 0 },
      timestamp: new Date().toISOString(),
    });
    const res = await authorizeApiKey(key.key, "m");
    expect(res.ok).toBe(false);
    expect(res.status).toBe(402);
  });

  it("switching package switches which balance is spent", async () => {
    const u = await createUser({ email: "p4@example.com", password: "password123" });
    const small = await createPackage({ name: "Small", priceIdr: 1000, tokenQuota: 1000 });
    const big = await createPackage({ name: "Big", priceIdr: 9000, tokenQuota: 5_000_000 });

    const subSmall = await createSubscription({ userId: u.id, packageId: small.id, select: true });
    const subBig = await createSubscription({ userId: u.id, packageId: big.id, select: true });
    // The newest purchase is selected.
    expect((await getActiveSubscription(u.id)).id).toBe(subBig.id);

    await selectSubscription(u.id, subSmall.id);
    expect((await getActiveSubscription(u.id)).id).toBe(subSmall.id);

    const key = await createApiKey("k", null, u.id);
    await saveRequestUsage({
      provider: "openai", model: "m", apiKey: key.key,
      tokens: { prompt_tokens: 300, completion_tokens: 0 },
      timestamp: new Date().toISOString(),
    });

    const subs = await listSubscriptions(u.id);
    expect(subs.find((s) => s.id === subSmall.id).tokensUsed).toBe(300);
    expect(subs.find((s) => s.id === subBig.id).tokensUsed).toBe(0);
  });

  it("one tenant cannot select another's package", async () => {
    const a = await createUser({ email: "p5@example.com", password: "password123" });
    const b = await createUser({ email: "p6@example.com", password: "password123" });
    const subA = await ensureSubscription(a.id);
    expect(await selectSubscription(b.id, subA.id)).toBeNull();
  });
});

describe("purchase grants a package", () => {
  it("pending grants nothing; paid issues a subscription", async () => {
    const u = await createUser({ email: "p7@example.com", password: "password123" });
    await ensureSubscription(u.id);
    const pkg = await createPackage({ name: "Beli", priceIdr: 10_000, tokenQuota: 10_000_000 });

    const order = await createOrder({ userId: u.id, packageId: pkg.id, status: "pending" });
    expect(order.amountIdr).toBe(10_000);
    expect((await getActiveSubscription(u.id)).tokenQuota).toBe(100_000);

    await applyPaidOrder(order.id);
    const active = await getActiveSubscription(u.id);
    expect(active.packageName).toBe("Beli");
    expect(active.tokenQuota).toBe(10_000_000);
  });

  it("re-applying a paid order does not grant a second package", async () => {
    const u = await createUser({ email: "p8@example.com", password: "password123" });
    const pkg = await createPackage({ name: "Sekali", priceIdr: 7000, tokenQuota: 500 });
    const order = await createOrder({ userId: u.id, packageId: pkg.id, status: "paid" });

    const before = (await listSubscriptions(u.id)).length;
    await applyPaidOrder(order.id);
    expect((await listSubscriptions(u.id)).length).toBe(before);
  });

  it("counts rupiah revenue from paid orders only", async () => {
    const before = (await getRevenueSummary()).revenueIdr;
    const u = await createUser({ email: "p9@example.com", password: "password123" });
    const pkg = await createPackage({ name: "Rev", priceIdr: 25_000, tokenQuota: 100 });
    await createOrder({ userId: u.id, packageId: pkg.id, status: "pending" });
    expect((await getRevenueSummary()).revenueIdr).toBe(before);
    await createOrder({ userId: u.id, packageId: pkg.id, status: "paid" });
    expect((await getRevenueSummary()).revenueIdr).toBe(before + 25_000);
  });

  it("editing a package does not change an already-purchased balance", async () => {
    const u = await createUser({ email: "p10@example.com", password: "password123" });
    const pkg = await createPackage({ name: "Snap", priceIdr: 1000, tokenQuota: 2000 });
    await createSubscription({ userId: u.id, packageId: pkg.id, select: true });

    await updatePackage(pkg.id, { tokenQuota: 999_999 });
    expect((await getActiveSubscription(u.id)).tokenQuota).toBe(2000);
  });
});
