// Read through a dynamic key so the bundler cannot fold the value in at build
// time. A static `process.env.SAAS_MODE` gets inlined into the middleware/proxy
// bundle, which silently baked in whatever the flag was during `next build` —
// an operator setting SAAS_MODE at deploy time would get tenant routing in the
// route handlers but not in the gate in front of them.
function env(name) {
  return typeof process !== "undefined" && process.env ? process.env[name] : undefined;
}

// SaaS mode. Off by default so self-hosted single-user installs are untouched.
export const SAAS_MODE = env("SAAS_MODE") === "true";

// Token quota is per billing period (30 days rolling from signup/last reset).
// rpm = requests/minute per API key. Both are enforced; quota is the hard stop.
export const TIERS = {
  free:    { label: "Free",    tokenQuota:     100_000, rpm:  10, maxKeys: 1,  priceUsd: 0 },
  starter: { label: "Starter", tokenQuota:   1_000_000, rpm:  60, maxKeys: 3,  priceUsd: 9 },
  pro:     { label: "Pro",     tokenQuota:  10_000_000, rpm: 300, maxKeys: 10, priceUsd: 49 },
  scale:   { label: "Scale",   tokenQuota: 100_000_000, rpm: 900, maxKeys: 50, priceUsd: 299 },
};

export const ADMIN_EMAIL = (env("ADMIN_EMAIL") || "").trim().toLowerCase();

export const DEFAULT_TIER = "free";
export const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

export function getTier(name) {
  return TIERS[name] || TIERS[DEFAULT_TIER];
}

// Fail closed at boot rather than shipping dev defaults to production.
// ponytail: called from instrumentation/register; throwing here beats a silent
// insecure deploy. Add a secrets-manager fetch only if you outgrow env vars.
export function assertSaasSecrets() {
  if (!SAAS_MODE) return;
  const missing = ["JWT_SECRET", "API_KEY_SECRET"].filter((k) => !env(k) || env(k).length < 32);
  if (missing.length) {
    throw new Error(`SAAS_MODE requires ${missing.join(", ")} to be set to >=32 random chars`);
  }
  if (!env("INITIAL_PASSWORD") || env("INITIAL_PASSWORD") === "123456") {
    throw new Error("SAAS_MODE requires INITIAL_PASSWORD to be set to a non-default value");
  }
}
