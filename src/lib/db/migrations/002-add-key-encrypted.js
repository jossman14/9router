// Migration 002: apiKeys.keyEncrypted for SaaS key re-display.
// Additive only — syncSchemaFromTables would add the column anyway, the
// PRAGMA guard keeps this idempotent when both paths run.
export default {
  version: 2,
  name: "add-key-encrypted",
  up(db) {
    const cols = db.all(`PRAGMA table_info(apiKeys)`).map((r) => r.name);
    if (!cols.includes("keyEncrypted")) {
      db.exec(`ALTER TABLE apiKeys ADD COLUMN keyEncrypted TEXT`);
    }
  },
};
