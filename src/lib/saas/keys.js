import crypto from "node:crypto";

const PEPPER = process.env.API_KEY_SECRET || "endpoint-proxy-api-key-secret";

export const KEY_PREFIX = "sk9r_";

/**
 * High-entropy SaaS keys don't need bcrypt: a 256-bit random secret brute-forces
 * nothing, and per-request HMAC-SHA256 costs us a KDF on every LLM request. The
 * pepper (API_KEY_SECRET) prevents a DB dump from being rainbow-checked.
 */
export function hashKey(key) {
  return crypto.createHmac("sha256", PEPPER).update(String(key)).digest("hex");
}

/**
 * Generate a high-entropy key and its lookup forms.
 *
 * Returns:
 *   key     - plaintext, shown to user once (legacy) or encrypted (SaaS)
 *   keyHash - HMAC lookup for validateApiKey()
 *   keyPrefix - 12-char prefix for display
 *   keyEncrypted - AES-GCM ciphertext, stored in DB for SaaS key re-display
 */
export function generateKey() {
  const secret = crypto.randomBytes(32).toString("base64url");
  const key = `${KEY_PREFIX}${secret}`;
  const keyHash = hashKey(key);
  const keyPrefix = key.slice(0, 12);
  // Always encrypted: cheap (one scrypt per creation, never per request), and a
  // later SAAS_MODE flip must not orphan already-issued keys.
  // ponytail: single-process cipher suite; escalate to a KMS-backed envelope when
  // key rotation or multi-tenant isolation of the master key becomes a requirement.
  return { key, keyHash, keyPrefix, keyEncrypted: encryptKey(key) };
}

// AES-256-GCM envelope. IV: 12 bytes random. Tag appended to ciphertext.
const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

export function isSaasKey(key) {
  return typeof key === "string" && key.startsWith(KEY_PREFIX);
}

/**
 * Deterministic master key derived from API_KEY_SECRET so any process in the
 * cluster can encrypt/decrypt, and so the value never leaks into source.
 */
function deriveMaster() {
  const secret = process.env.API_KEY_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("API_KEY_SECRET must contain at least 32 characters to store recoverable keys");
  }
  return crypto.scryptSync(secret, "9router-key-enc", 32);
}

export function encryptKey(plaintext) {
  const iv = crypto.randomBytes(IV_LEN);
  const key = deriveMaster();
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const body = Buffer.concat([
    cipher.update(Buffer.from(String(plaintext), "utf8")),
    cipher.final(),
  ]);
  // Node GCM: update()/final() return ciphertext ONLY. The 16-byte auth tag
  // lives separately — cipher.getAuthTag(). Never slice it off the ciphertext.
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, body, tag]).toString("base64url");
}

export function decryptKey(b64) {
  if (!b64) return null;
  try {
    const raw = Buffer.from(String(b64), "base64url");
    if (raw.length < IV_LEN + TAG_LEN) return null;
    const iv = raw.subarray(0, IV_LEN);
    const tag = raw.subarray(raw.length - TAG_LEN);
    const body = raw.subarray(IV_LEN, raw.length - TAG_LEN);
    const key = deriveMaster();
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(body),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}
