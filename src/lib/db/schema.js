// ⚠️ AGENT/DEV: Bump this by +1 EVERY TIME you change the schema below
// (add/remove/alter a table, column, or index in TABLES). It drives the
// pre-change safety backup in migrate.js: when the stored version is lower,
// one lightweight DB backup is taken before applying schema changes. Forgetting
// to bump only skips that backup — it does NOT break the additive auto-sync.
export const SCHEMA_VERSION = 5;

export const PRAGMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 30000000;
PRAGMA cache_size = -64000;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
`;

// Declarative current schema. Used by syncSchemaFromTables() to
// auto-add missing tables/columns/indexes after versioned migrations.
// For destructive changes (drop/rename/type-change), write a migration file.
export const TABLES = {
  _meta: {
    columns: {
      key: "TEXT PRIMARY KEY",
      value: "TEXT NOT NULL",
    },
  },
  settings: {
    columns: {
      id: "INTEGER PRIMARY KEY CHECK (id = 1)",
      data: "TEXT NOT NULL",
    },
  },
  providerConnections: {
    columns: {
      id: "TEXT PRIMARY KEY",
      provider: "TEXT NOT NULL",
      authType: "TEXT NOT NULL",
      name: "TEXT",
      email: "TEXT",
      priority: "INTEGER",
      isActive: "INTEGER DEFAULT 1",
      data: "TEXT NOT NULL",
      createdAt: "TEXT NOT NULL",
      updatedAt: "TEXT NOT NULL",
    },
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_pc_provider ON providerConnections(provider)",
      "CREATE INDEX IF NOT EXISTS idx_pc_provider_active ON providerConnections(provider, isActive)",
      "CREATE INDEX IF NOT EXISTS idx_pc_priority ON providerConnections(provider, priority)",
    ],
  },
  providerNodes: {
    columns: {
      id: "TEXT PRIMARY KEY",
      type: "TEXT",
      name: "TEXT",
      data: "TEXT NOT NULL",
      createdAt: "TEXT NOT NULL",
      updatedAt: "TEXT NOT NULL",
    },
    indexes: ["CREATE INDEX IF NOT EXISTS idx_pn_type ON providerNodes(type)"],
  },
  proxyPools: {
    columns: {
      id: "TEXT PRIMARY KEY",
      isActive: "INTEGER DEFAULT 1",
      testStatus: "TEXT",
      data: "TEXT NOT NULL",
      createdAt: "TEXT NOT NULL",
      updatedAt: "TEXT NOT NULL",
    },
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_pp_active ON proxyPools(isActive)",
      "CREATE INDEX IF NOT EXISTS idx_pp_status ON proxyPools(testStatus)",
    ],
  },
  apiKeys: {
    columns: {
      id: "TEXT PRIMARY KEY",
      // Holds the raw key for legacy single-user installs and the HMAC-SHA256
      // hash for SaaS keys. Lookups try both so both formats resolve.
      key: "TEXT UNIQUE NOT NULL",
      name: "TEXT",
      machineId: "TEXT",
      userId: "TEXT",
      keyPrefix: "TEXT",
      // AES-GCM ciphertext of the SaaS plaintext key, for owner re-display.
      // NULL for legacy rows. Never leaks: repo surfaces hasEncrypted only.
      keyEncrypted: "TEXT",
      lastUsedAt: "TEXT",
      isActive: "INTEGER DEFAULT 1",
      createdAt: "TEXT NOT NULL",
    },
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_ak_key ON apiKeys(key)",
      "CREATE INDEX IF NOT EXISTS idx_ak_user ON apiKeys(userId)",
    ],
  },
  users: {
    columns: {
      id: "TEXT PRIMARY KEY",
      email: "TEXT UNIQUE NOT NULL",
      passwordHash: "TEXT NOT NULL",
      name: "TEXT",
      role: "TEXT DEFAULT 'user'",
      tier: "TEXT DEFAULT 'free'",
      // Denormalised from the tier so an admin can grant a one-off quota
      // without inventing a tier.
      tokenQuota: "INTEGER DEFAULT 0",
      tokensUsed: "INTEGER DEFAULT 0",
      periodStart: "TEXT",
      // Bumped on password change so old JWTs stop verifying.
      tokenVersion: "INTEGER DEFAULT 1",
      isActive: "INTEGER DEFAULT 1",
      createdAt: "TEXT NOT NULL",
      updatedAt: "TEXT NOT NULL",
    },
    indexes: ["CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)"],
  },
  // Admin-defined plans. These replace the old hardcoded TIERS table: price,
  // quota and the allowed model list are all editable from the admin console.
  packages: {
    columns: {
      id: "TEXT PRIMARY KEY",
      name: "TEXT NOT NULL",
      description: "TEXT",
      // Rupiah, stored as a whole number — no float cents to round badly.
      priceIdr: "INTEGER DEFAULT 0",
      tokenQuota: "INTEGER DEFAULT 0",
      // JSON array of model ids. Empty array means "every routable model".
      allowedModels: "TEXT DEFAULT '[]'",
      rpm: "INTEGER DEFAULT 60",
      maxKeys: "INTEGER DEFAULT 3",
      durationDays: "INTEGER DEFAULT 30",
      isActive: "INTEGER DEFAULT 1",
      sortOrder: "INTEGER DEFAULT 0",
      createdAt: "TEXT NOT NULL",
      updatedAt: "TEXT NOT NULL",
    },
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_pkg_active ON packages(isActive, sortOrder)",
    ],
  },
  // One purchased package instance. Quota lives here, not on the user, so a
  // user can hold several and switch which one their traffic draws from.
  // Quota and model list are snapshotted at purchase: editing a package later
  // must not silently change what someone already paid for.
  subscriptions: {
    columns: {
      id: "TEXT PRIMARY KEY",
      userId: "TEXT NOT NULL",
      packageId: "TEXT",
      packageName: "TEXT",
      tokenQuota: "INTEGER DEFAULT 0",
      tokensUsed: "INTEGER DEFAULT 0",
      allowedModels: "TEXT DEFAULT '[]'",
      rpm: "INTEGER DEFAULT 60",
      maxKeys: "INTEGER DEFAULT 3",
      status: "TEXT DEFAULT 'active'",
      // Exactly one row per user carries isSelected = 1; that is the one the
      // gateway charges.
      isSelected: "INTEGER DEFAULT 0",
      orderId: "TEXT",
      startedAt: "TEXT NOT NULL",
      expiresAt: "TEXT",
      createdAt: "TEXT NOT NULL",
      updatedAt: "TEXT NOT NULL",
    },
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_sub_user ON subscriptions(userId, status)",
      "CREATE INDEX IF NOT EXISTS idx_sub_selected ON subscriptions(userId, isSelected)",
    ],
  },
  // Purchase records. There is no payment gateway wired up: an order is the
  // audit trail for a plan change, whether an admin granted it or a user
  // requested it. Marking one "paid" is what actually applies the tier.
  orders: {
    columns: {
      id: "TEXT PRIMARY KEY",
      userId: "TEXT NOT NULL",
      tier: "TEXT",
      packageId: "TEXT",
      packageName: "TEXT",
      amountUsd: "REAL DEFAULT 0",
      amountIdr: "INTEGER DEFAULT 0",
      // pending -> paid | cancelled. Only "paid" moves the user's tier.
      status: "TEXT DEFAULT 'pending'",
      note: "TEXT",
      createdBy: "TEXT",
      createdAt: "TEXT NOT NULL",
      updatedAt: "TEXT NOT NULL",
    },
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_ord_user ON orders(userId)",
      "CREATE INDEX IF NOT EXISTS idx_ord_status ON orders(status)",
      "CREATE INDEX IF NOT EXISTS idx_ord_created ON orders(createdAt DESC)",
    ],
  },
  combos: {
    columns: {
      id: "TEXT PRIMARY KEY",
      name: "TEXT UNIQUE NOT NULL",
      kind: "TEXT",
      models: "TEXT NOT NULL",
      createdAt: "TEXT NOT NULL",
      updatedAt: "TEXT NOT NULL",
    },
    indexes: ["CREATE INDEX IF NOT EXISTS idx_combo_name ON combos(name)"],
  },
  kv: {
    columns: {
      scope: "TEXT NOT NULL",
      key: "TEXT NOT NULL",
      value: "TEXT NOT NULL",
    },
    primaryKey: "PRIMARY KEY (scope, key)",
    indexes: ["CREATE INDEX IF NOT EXISTS idx_kv_scope ON kv(scope)"],
  },
  usageHistory: {
    columns: {
      id: "INTEGER PRIMARY KEY AUTOINCREMENT",
      timestamp: "TEXT NOT NULL",
      provider: "TEXT",
      model: "TEXT",
      connectionId: "TEXT",
      apiKey: "TEXT",
      endpoint: "TEXT",
      promptTokens: "INTEGER DEFAULT 0",
      completionTokens: "INTEGER DEFAULT 0",
      cost: "REAL DEFAULT 0",
      status: "TEXT",
      tokens: "TEXT",
      meta: "TEXT",
    },
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_uh_ts ON usageHistory(timestamp DESC)",
      "CREATE INDEX IF NOT EXISTS idx_uh_provider ON usageHistory(provider)",
      "CREATE INDEX IF NOT EXISTS idx_uh_model ON usageHistory(model)",
      "CREATE INDEX IF NOT EXISTS idx_uh_conn ON usageHistory(connectionId)",
    ],
  },
  usageDaily: {
    columns: {
      dateKey: "TEXT PRIMARY KEY",
      data: "TEXT NOT NULL",
    },
  },
  requestDetails: {
    columns: {
      id: "TEXT PRIMARY KEY",
      timestamp: "TEXT NOT NULL",
      provider: "TEXT",
      model: "TEXT",
      connectionId: "TEXT",
      status: "TEXT",
      data: "TEXT NOT NULL",
    },
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_rd_ts ON requestDetails(timestamp DESC)",
      "CREATE INDEX IF NOT EXISTS idx_rd_provider ON requestDetails(provider)",
      "CREATE INDEX IF NOT EXISTS idx_rd_model ON requestDetails(model)",
      "CREATE INDEX IF NOT EXISTS idx_rd_conn ON requestDetails(connectionId)",
    ],
  },
};

export function buildCreateTableSql(name, def) {
  const cols = Object.entries(def.columns).map(([k, v]) => `${k} ${v}`);
  if (def.primaryKey) cols.push(def.primaryKey);
  return `CREATE TABLE IF NOT EXISTS ${name} (${cols.join(", ")})`;
}
