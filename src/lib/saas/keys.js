import crypto from "node:crypto";

// SaaS keys are high-entropy random, so a plain SHA-256 lookup hash is correct:
// bcrypt buys nothing against a 256-bit random secret and would cost a KDF on
// every single LLM request. Peppered with API_KEY_SECRET so a stolen DB dump
// can't be rainbow-checked against guessed keys.
const PEPPER = process.env.API_KEY_SECRET || "endpoint-proxy-api-key-secret";

export const KEY_PREFIX = "sk9r_";

export function generateKey() {
  const secret = crypto.randomBytes(32).toString("base64url");
  const key = `${KEY_PREFIX}${secret}`;
  return { key, keyHash: hashKey(key), keyPrefix: key.slice(0, 12) };
}

export function hashKey(key) {
  return crypto.createHmac("sha256", PEPPER).update(String(key)).digest("hex");
}

export function isSaasKey(key) {
  return typeof key === "string" && key.startsWith(KEY_PREFIX);
}
