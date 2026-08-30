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

export const ADMIN_EMAIL = (env("ADMIN_EMAIL") || "").trim().toLowerCase();

// Plans are rows in the `packages` table, editable from the admin console —
// see src/lib/db/repos/packagesRepo.js. There is deliberately no hardcoded
// tier table here any more: the gateway and every price surface must read the
// same source, or the site can advertise a quota the router will not honour.

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
