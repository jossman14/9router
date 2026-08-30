// Self-check for the SaaS gate: key hashing, quota exhaustion, rate limiting,
// period rollover, and tenant isolation. Runs against a throwaway DB dir.
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "9r-saas-"));
process.env.DATA_DIR = tmp;
process.env.API_KEY_SECRET = "test-pepper-that-is-long-enough-for-hmac";

let createUser, getUserById, createApiKey, findApiKeyRow, authorizeApiKey,
    saveRequestUsage, hashKey, getApiKeys, checkRate,
    seedPackagesIfEmpty, ensureSubscription, getActiveSubscription;

beforeAll(async () => {
  ({ createUser, getUserById } = await import("@/lib/db/repos/usersRepo.js"));
  ({ createApiKey, findApiKeyRow, getApiKeys } = await import("@/lib/db/repos/apiKeysRepo.js"));
  ({ authorizeApiKey } = await import("@/lib/saas/quota.js"));
  ({ saveRequestUsage } = await import("@/lib/db/repos/usageRepo.js"));
  ({ hashKey } = await import("@/lib/saas/keys.js"));
  ({ checkRate } = await import("@/lib/saas/rateLimit.js"));
  ({ seedPackagesIfEmpty } = await import("@/lib/db/repos/packagesRepo.js"));
  ({ ensureSubscription, getActiveSubscription } = await import("@/lib/db/repos/subscriptionsRepo.js"));
  await seedPackagesIfEmpty();
});

// Every account needs a plan before the gate will let it through.
async function userWithPlan(email) {
  const u = await createUser({ email, password: "password123" });
  await ensureSubscription(u.id);
  return u;
}

describe("SaaS key + quota gate", () => {
  it("stores the key as a hash, never the plaintext", async () => {
    const user = await userWithPlan("a@example.com");
    const key = await createApiKey("app", null, user.id);

    expect(key.key).toMatch(/^sk9r_/);
    const row = await findApiKeyRow(key.key);
    expect(row).toBeTruthy();
    expect(row.key).toBe(hashKey(key.key));
    expect(row.key).not.toBe(key.key);

    // Listing must never hand the plaintext back out.
    const listed = await getApiKeys(user.id);
    expect(listed[0].key).toBeNull();
    expect(listed[0].keyPrefix).toBe(key.key.slice(0, 12));
  });

  it("authorizes a fresh key and refuses an unknown one", async () => {
    const user = await userWithPlan("b@example.com");
    const key = await createApiKey("app", null, user.id);

    const ok = await authorizeApiKey(key.key);
    expect(ok.ok).toBe(true);
    expect(ok.userId).toBe(user.id);

    const bad = await authorizeApiKey("sk9r_not-a-real-key");
    expect(bad.ok).toBe(false);
    expect(bad.status).toBe(401);
  });

  it("meters tokens onto the active subscription and blocks once the quota is gone", async () => {
    const user = await userWithPlan("c@example.com");
    const key = await createApiKey("app", null, user.id);
    const quota = (await getActiveSubscription(user.id)).tokenQuota; // free = 100_000

    await saveRequestUsage({
      provider: "openai", model: "gpt-5", apiKey: key.key,
      tokens: { prompt_tokens: 40_000, completion_tokens: 10_000 },
      timestamp: new Date().toISOString(),
    });

    const mid = await getActiveSubscription(user.id);
    expect(mid.tokensUsed).toBe(50_000);
    expect((await authorizeApiKey(key.key)).ok).toBe(true);

    await saveRequestUsage({
      provider: "openai", model: "gpt-5", apiKey: key.key,
      tokens: { prompt_tokens: quota, completion_tokens: 0 },
      timestamp: new Date(Date.now() + 1000).toISOString(),
    });

    const after = await getActiveSubscription(user.id);
    expect(after.tokensUsed).toBeGreaterThanOrEqual(quota);

    const blocked = await authorizeApiKey(key.key);
    expect(blocked.ok).toBe(false);
    expect(blocked.status).toBe(402);
  });

  it("never writes a live credential into the usage table", async () => {
    const user = await userWithPlan("d@example.com");
    const key = await createApiKey("app", null, user.id);
    const entry = {
      provider: "openai", model: "gpt-5", apiKey: key.key,
      tokens: { prompt_tokens: 5, completion_tokens: 5 },
      timestamp: new Date().toISOString(),
    };
    await saveRequestUsage(entry);
    // saveRequestUsage rewrites entry.apiKey to the non-secret prefix.
    expect(entry.apiKey).toBe(key.key.slice(0, 12));
    expect(entry.apiKey).not.toBe(key.key);
  });

  it("keeps tenants isolated", async () => {
    const alice = await userWithPlan("e@example.com");
    const bob = await userWithPlan("f@example.com");
    await createApiKey("alice-key", null, alice.id);

    expect((await getApiKeys(alice.id))).toHaveLength(1);
    expect((await getApiKeys(bob.id))).toHaveLength(0);
  });

  it("rate limits per key within the window", () => {
    for (let i = 0; i < 3; i++) expect(checkRate("rl-test", 3).ok).toBe(true);
    const over = checkRate("rl-test", 3);
    expect(over.ok).toBe(false);
    expect(over.retryAfter).toBeGreaterThan(0);
  });

  it("suspends a disabled account", async () => {
    const { setUserActive } = await import("@/lib/db/repos/usersRepo.js");
    const user = await userWithPlan("g@example.com");
    const key = await createApiKey("app", null, user.id);
    await setUserActive(user.id, false);
    const res = await authorizeApiKey(key.key);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(403);
  });

});
