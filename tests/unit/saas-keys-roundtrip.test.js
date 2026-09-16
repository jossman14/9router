// AES-GCM envelope and legacy HMAC compatibility. No database access.
import crypto from "node:crypto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const TEST_SECRET = "test-pepper-that-is-long-enough-for-hmac";
let encryptKey, decryptKey, generateKey, hashKey;

beforeEach(async () => {
  // The HMAC pepper is captured on import; configure it before loading keys.js.
  vi.stubEnv("API_KEY_SECRET", TEST_SECRET);
  vi.resetModules();
  ({ encryptKey, decryptKey, generateKey, hashKey } = await import("@/lib/saas/keys.js"));
});

afterEach(() => vi.unstubAllEnvs());

describe("saas key envelope", () => {
  it("round-trips short, long and unicode plaintext", () => {
    for (const pt of ["sk9r_abc", `sk9r_${"x".repeat(64)}`, "sk9r_ünïcode"]) {
      expect(decryptKey(encryptKey(pt))).toBe(pt);
    }
  });

  it("round-trips generateKey().keyEncrypted with a matching lookup hash", () => {
    const generated = generateKey();
    expect(decryptKey(generated.keyEncrypted)).toBe(generated.key);
    expect(generated.keyHash).toBe(hashKey(generated.key));
    expect(generated.keyPrefix).toBe(generated.key.slice(0, 12));
  });

  it("uses a fresh IV for each encryption", () => {
    const first = encryptKey("sk9r_same");
    const second = encryptKey("sk9r_same");
    expect(first).not.toBe(second);
    expect(decryptKey(first)).toBe(decryptKey(second));
  });

  it.each([0, 12, -1])("rejects tampering at envelope byte %i", (offset) => {
    const raw = Buffer.from(encryptKey("sk9r_tamper"), "base64url");
    const index = offset < 0 ? raw.length + offset : offset;
    raw[index] ^= 1;
    expect(decryptKey(raw.toString("base64url"))).toBeNull();
  });

  it("returns null on garbage, truncation and absent ciphertext", () => {
    for (const input of ["bogus", null, "", Buffer.alloc(27).toString("base64url")]) {
      expect(decryptKey(input)).toBeNull();
    }
  });

  it.each([undefined, "", "x".repeat(31)])("refuses encryption with an unconfigured or short secret (%s)", async (secret) => {
    vi.stubEnv("API_KEY_SECRET", secret);
    vi.resetModules();
    const keys = await import("@/lib/saas/keys.js");
    expect(() => keys.encryptKey("sk9r_secret")).toThrow(/API_KEY_SECRET.*32/);
    expect(() => keys.generateKey()).toThrow(/API_KEY_SECRET.*32/);
    // Hash lookups must remain compatible with pre-encryption installations.
    const expected = crypto.createHmac("sha256", secret || "endpoint-proxy-api-key-secret")
      .update("sk9r_legacy").digest("hex");
    expect(keys.hashKey("sk9r_legacy")).toBe(expected);
  });

  it("accepts a configured secret of exactly 32 characters", async () => {
    vi.stubEnv("API_KEY_SECRET", "a".repeat(32));
    vi.resetModules();
    const keys = await import("@/lib/saas/keys.js");
    expect(keys.decryptKey(keys.encryptKey("sk9r_boundary"))).toBe("sk9r_boundary");
  });

  it("fails closed when the encryption secret changes or disappears", async () => {
    const encrypted = encryptKey("sk9r_secret");
    for (const secret of ["a-different-secret-with-at-least-32-characters", undefined]) {
      vi.stubEnv("API_KEY_SECRET", secret);
      vi.resetModules();
      const keys = await import("@/lib/saas/keys.js");
      expect(keys.decryptKey(encrypted)).toBeNull();
    }
  });
});
