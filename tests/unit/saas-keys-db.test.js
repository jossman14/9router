// Persisted key material and backup round-trips. Real SQLite files, never a live DB.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_SECRET = "test-pepper-that-is-long-enough-for-hmac";
const otherSecret = "a-different-secret-with-at-least-32-characters";

let tempDir;
const originalDataDir = process.env.DATA_DIR;
const originalApiKeySecret = process.env.API_KEY_SECRET;
const originalSaasMode = process.env.SAAS_MODE;

function closeDatabase() {
  try { global._dbAdapter?.instance?.close?.(); } catch {}
  delete global._dbAdapter;
}

function useFreshDatabase() {
  closeDatabase();
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9r-keys-db-"));
  process.env.DATA_DIR = tempDir;
  vi.resetModules();
}

async function writeSchemaVersionOne() {
  const { getAdapter } = await import("@/lib/db/driver.js");
  const db = await getAdapter();
  db.exec(`DROP TABLE IF EXISTS apiKeys`);
  db.exec(`CREATE TABLE apiKeys (id TEXT PRIMARY KEY, key TEXT UNIQUE NOT NULL, name TEXT, machineId TEXT, userId TEXT, keyPrefix TEXT, lastUsedAt TEXT, isActive INTEGER DEFAULT 1, createdAt TEXT NOT NULL)`);
  db.run(`INSERT INTO apiKeys(id, key, name, userId, keyPrefix, isActive, createdAt) VALUES(?, ?, ?, ?, ?, 1, ?)`,
    ["legacy-saas", "legacy-hash", "legacy", "user-1", "sk9r_legacy-", new Date().toISOString()]);
  db.run(`UPDATE _meta SET value = '1' WHERE key = 'schemaVersion'`);
}

async function userWithPlan(email) {
  const [{ createUser }, { ensureSubscription }] = await Promise.all([
    import("@/lib/db/repos/usersRepo.js"),
    import("@/lib/db/repos/subscriptionsRepo.js"),
  ]);
  const user = await createUser({ email, password: "password123" });
  await ensureSubscription(user.id);
  return user;
}

async function createSaaSKey(user, name = "app") {
  const { createApiKey } = await import("@/lib/db/repos/apiKeysRepo.js");
  return createApiKey(name, null, user.id);
}

beforeEach(async () => {
  process.env.API_KEY_SECRET = TEST_SECRET;
  process.env.SAAS_MODE = "false";
  useFreshDatabase();
  const { createPackage } = await import("@/lib/db/repos/packagesRepo.js");
  await createPackage({ name: "Test package", tokenQuota: 100_000, maxKeys: 3 });
});

afterEach(() => {
  closeDatabase();
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  tempDir = undefined;
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
  if (originalApiKeySecret === undefined) delete process.env.API_KEY_SECRET;
  else process.env.API_KEY_SECRET = originalApiKeySecret;
  if (originalSaasMode === undefined) delete process.env.SAAS_MODE;
  else process.env.SAAS_MODE = originalSaasMode;
});

describe("persisted key material", () => {
  it("rejects swapped ciphertext and missing or rotated encryption secrets", async () => {
    const { findApiKeyRow, revealApiKey } = await import("@/lib/db/repos/apiKeysRepo.js");
    const user = await userWithPlan("swapped@example.com");
    const first = await createSaaSKey(user, "first");
    const second = await createSaaSKey(user, "second");

    const { getAdapter } = await import("@/lib/db/driver.js");
    (await getAdapter()).run(
      `UPDATE apiKeys SET keyEncrypted = (SELECT keyEncrypted FROM apiKeys WHERE id = ?) WHERE id = ?`,
      [second.id, first.id]
    );
    expect(await revealApiKey(first.id, user.id)).toBeNull();
    expect(await findApiKeyRow(second.key)).toBeTruthy();

    closeDatabase();
    vi.resetModules();
    process.env.API_KEY_SECRET = otherSecret;
    const rotated = await import("@/lib/db/repos/apiKeysRepo.js");
    expect(await rotated.revealApiKey(first.id, user.id)).toBeNull();
    expect(await rotated.findApiKeyRow(second.key)).toBeNull();

    closeDatabase();
    vi.resetModules();
    delete process.env.API_KEY_SECRET;
    const unconfigured = await import("@/lib/db/repos/apiKeysRepo.js");
    expect(await unconfigured.revealApiKey(first.id, user.id)).toBeNull();
    expect(await unconfigured.findApiKeyRow(second.key)).toBeNull();
  });

  it("adds keyEncrypted to a pre-encryption database on restart without rewriting legacy rows", async () => {
    await writeSchemaVersionOne();
    closeDatabase();
    vi.resetModules();
    const { getAdapter } = await import("@/lib/db/driver.js");
    const db = await getAdapter();
    const columns = db.all(`PRAGMA table_info(apiKeys)`).map((r) => r.name);
    expect(columns).toContain("keyEncrypted");
    const legacy = db.get(`SELECT * FROM apiKeys WHERE id = 'legacy-saas'`);
    expect(legacy.keyEncrypted).toBeNull();
    expect(legacy.key).toBe("legacy-hash");
    expect(db.get(`SELECT value FROM _meta WHERE key='schemaVersion'`).value).toBe("2");
  });

  it("restores key material through the JSON export/import round-trip", async () => {
    const { findApiKeyRow, revealApiKey, touchApiKey } = await import("@/lib/db/repos/apiKeysRepo.js");
    const { hashKey } = await import("@/lib/saas/keys.js");
    const { exportDb, importDb } = await import("@/lib/db/index.js");
    const user = await userWithPlan("backup@example.com");
    const key = await createSaaSKey(user);
    const legacy = await (await import("@/lib/db/repos/apiKeysRepo.js")).createApiKey("legacy", "machine-legacy");

    await touchApiKey(key.id);
    const { keyEncrypted: encrypted, lastUsedAt } = await findApiKeyRow(key.key);
    const payload = JSON.parse(JSON.stringify(await exportDb()));
    const exportedSaaS = payload.apiKeys.find((row) => row.id === key.id);
    const exportedLegacy = payload.apiKeys.find((row) => row.id === legacy.id);
    expect(exportedSaaS).toMatchObject({
      key: hashKey(key.key), userId: user.id, keyPrefix: key.key.slice(0, 12), keyEncrypted: encrypted, lastUsedAt,
    });
    expect(exportedSaaS).not.toHaveProperty("hasEncrypted");
    expect(exportedLegacy).toMatchObject({ key: legacy.key, userId: null, keyEncrypted: null });

    const tampered = structuredClone(payload);
    tampered.apiKeys.find((row) => row.id === key.id).keyEncrypted = "bogus";
    await importDb(tampered);
    expect(await revealApiKey(key.id, user.id)).toBeNull();
    await importDb(structuredClone(payload));
    expect(await findApiKeyRow(key.key)).toMatchObject({ userId: user.id, keyPrefix: key.keyPrefix, keyEncrypted: encrypted, lastUsedAt });
    expect(await revealApiKey(key.id, user.id)).toBe(key.key);
  });

  it("reveals and authenticates persisted keys after a full adapter/module restart", async () => {
    const user = await userWithPlan("restart@example.com");
    const key = await createSaaSKey(user);
    closeDatabase();
    vi.resetModules();
    const repo = await import("@/lib/db/repos/apiKeysRepo.js");
    expect(await repo.revealApiKey(key.id, user.id)).toBe(key.key);
    expect(await repo.revealApiKey(key.id, "foreign-user")).toBeNull();
    expect(await repo.validateApiKey(key.key)).toBe(true);
    const [listed] = await repo.getApiKeys(user.id);
    expect(listed).toMatchObject({ key: null, hasEncrypted: true, keyPrefix: key.keyPrefix });
    expect(listed).not.toHaveProperty("keyEncrypted");
  });

  it("imports an older backup without inventing ownership or ciphertext", async () => {
    const { importDb, validateApiKey, getApiKeyById } = await import("@/lib/db/index.js");
    await importDb({ apiKeys: [{ id: "legacy", key: "legacy-key", machineId: "machine", name: "old" }] });
    expect(await validateApiKey("legacy-key")).toBe(true);
    expect(await getApiKeyById("legacy")).toMatchObject({ userId: null, keyPrefix: null, hasEncrypted: false, lastUsedAt: null });
  });
});
