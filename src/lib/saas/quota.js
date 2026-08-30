import { findApiKeyRow, touchApiKey } from "@/lib/db/repos/apiKeysRepo.js";
import { rollPeriodIfDue } from "@/lib/db/repos/usersRepo.js";
import { SAAS_MODE, getTier } from "./config.js";
import { checkRate } from "./rateLimit.js";

// Pin the locale: server locale varies by host, and an error string that
// changes shape per machine is a bad thing to ask a user to read back to you.
const NUM = new Intl.NumberFormat("id-ID");
const fmt = (n) => NUM.format(Number(n) || 0);

/**
 * Single gate for an inbound LLM request: key validity → account state →
 * rate limit → token quota.
 *
 * Returns { ok: true, keyId, userId } or { ok: false, status, error }.
 * Error strings stay generic so an attacker can't distinguish "no such key"
 * from "disabled key".
 */
export async function authorizeApiKey(apiKey) {
  if (!apiKey) return { ok: false, status: 401, error: "Missing API key" };

  const row = await findApiKeyRow(apiKey);
  if (!row || !(row.isActive === 1 || row.isActive === true)) {
    return { ok: false, status: 401, error: "Invalid API key" };
  }

  // Legacy single-user key: no owner, no quota. Unchanged behaviour.
  if (!row.userId) {
    if (SAAS_MODE) return { ok: false, status: 401, error: "Invalid API key" };
    return { ok: true, keyId: row.id, userId: null };
  }

  const user = await rollPeriodIfDue(row.userId);
  if (!user || !user.isActive) {
    return { ok: false, status: 403, error: "Account suspended" };
  }

  const tier = getTier(user.tier);
  const rate = checkRate(row.id, tier.rpm);
  if (!rate.ok) {
    return {
      ok: false, status: 429, retryAfter: rate.retryAfter,
      error: `Rate limit exceeded for the ${user.tier} plan (${tier.rpm} req/min)`,
    };
  }

  if (user.tokensUsed >= user.tokenQuota) {
    return {
      ok: false, status: 402,
      error: `Token quota exhausted (${fmt(user.tokensUsed)}/${fmt(user.tokenQuota)} tokens this period). Upgrade your plan or wait for the period to reset.`,
    };
  }

  touchApiKey(row.id).catch(() => {});
  return { ok: true, keyId: row.id, userId: user.id, tier: user.tier };
}
