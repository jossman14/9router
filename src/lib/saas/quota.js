import { findApiKeyRow, touchApiKey } from "@/lib/db/repos/apiKeysRepo.js";
import { getUserById } from "@/lib/db/repos/usersRepo.js";
import { getActiveSubscription } from "@/lib/db/repos/subscriptionsRepo.js";
import { SAAS_MODE } from "./config.js";
import { checkRate } from "./rateLimit.js";

// Pin the locale: server locale varies by host, and an error string that
// changes shape per machine is a bad thing to ask a user to read back to you.
const NUM = new Intl.NumberFormat("id-ID");
const fmt = (n) => NUM.format(Number(n) || 0);

/**
 * A package's allowedModels is an allow-list of model ids. Empty means "any
 * model this gateway can route". Matching is on the bare model name and on the
 * `provider/model` form, plus a `provider/*` wildcard, because callers address
 * the same model both ways.
 */
export function isModelAllowed(allowedModels, model) {
  if (!Array.isArray(allowedModels) || allowedModels.length === 0) return true;
  if (!model) return true;
  const asked = String(model).toLowerCase();
  const bare = asked.includes("/") ? asked.slice(asked.indexOf("/") + 1) : asked;
  const vendor = asked.includes("/") ? asked.slice(0, asked.indexOf("/")) : "";
  return allowedModels.some((raw) => {
    const allowed = String(raw).toLowerCase().trim();
    if (!allowed) return false;
    if (allowed === asked || allowed === bare) return true;
    if (allowed.endsWith("/*")) return vendor && vendor === allowed.slice(0, -2);
    // A bare allow-list entry should also match a provider-qualified request.
    if (!allowed.includes("/") && allowed === bare) return true;
    return false;
  });
}

/**
 * Single gate for an inbound LLM request: key validity → account state →
 * active package → rate limit → model allow-list → token quota.
 *
 * Returns { ok: true, keyId, userId, subscriptionId } or
 * { ok: false, status, error }. Error strings stay generic where they would
 * otherwise let an attacker distinguish "no such key" from "disabled key".
 */
export async function authorizeApiKey(apiKey, model = null) {
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

  const user = await getUserById(row.userId);
  if (!user || !user.isActive) {
    return { ok: false, status: 403, error: "Account suspended" };
  }

  const sub = await getActiveSubscription(user.id);
  if (!sub) {
    return {
      ok: false, status: 402,
      error: "Tidak ada paket aktif. Pilih atau beli paket di dashboard untuk melanjutkan.",
    };
  }

  const rate = checkRate(row.id, sub.rpm);
  if (!rate.ok) {
    return {
      ok: false, status: 429, retryAfter: rate.retryAfter,
      error: `Rate limit terlampaui untuk paket ${sub.packageName} (${sub.rpm} permintaan/menit)`,
    };
  }

  if (!isModelAllowed(sub.allowedModels, model)) {
    return {
      ok: false, status: 403,
      error: `Model "${model}" tidak termasuk dalam paket ${sub.packageName}. Model yang tersedia: ${sub.allowedModels.join(", ")}.`,
    };
  }

  if (sub.tokensUsed >= sub.tokenQuota) {
    return {
      ok: false, status: 402,
      error: `Kuota token paket ${sub.packageName} habis (${fmt(sub.tokensUsed)}/${fmt(sub.tokenQuota)}). Beli paket baru atau pilih paket lain di dashboard.`,
    };
  }

  touchApiKey(row.id).catch(() => {});
  return { ok: true, keyId: row.id, userId: user.id, subscriptionId: sub.id, package: sub.packageName };
}
