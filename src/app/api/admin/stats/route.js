import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/db/driver.js";
import { getRevenueSummary } from "@/lib/db/repos/ordersRepo.js";
import { SAAS_MODE } from "@/lib/saas/config.js";
import { listPackages } from "@/lib/db/repos/packagesRepo.js";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };
const DAYS = 14;

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Platform-wide overview for the admin console. Admin-gated by dashboardGuard. */
export async function GET() {
  if (!SAAS_MODE) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const db = await getAdapter();

  const users = db.get(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN isActive = 1 THEN 1 ELSE 0 END), 0) AS active
     FROM users`
  ) || {};

  // Quota lives on subscriptions now, so totals aggregate the active ones.
  const quota = db.get(
    `SELECT COALESCE(SUM(tokensUsed), 0) AS tokensUsed,
            COALESCE(SUM(tokenQuota), 0) AS tokenQuota
     FROM subscriptions WHERE status = 'active'`
  ) || {};

  const packages = await listPackages();
  const byTier = packages.map((p) => ({
    tier: p.id,
    label: p.name,
    users: db.get(
      `SELECT COUNT(DISTINCT userId) AS n FROM subscriptions
       WHERE packageId = ? AND status = 'active' AND isSelected = 1`, [p.id]
    )?.n ?? 0,
  }));

  const since = new Date(Date.now() - DAYS * 86400_000).toISOString();
  const rows = db.all(
    `SELECT timestamp, promptTokens, completionTokens FROM usageHistory WHERE timestamp >= ?`,
    [since]
  );
  const buckets = new Map();
  for (let i = DAYS - 1; i >= 0; i--) {
    const k = dayKey(new Date(Date.now() - i * 86400_000));
    buckets.set(k, { date: k, requests: 0, tokens: 0 });
  }
  for (const r of rows) {
    const b = buckets.get(dayKey(new Date(r.timestamp)));
    if (b) { b.requests += 1; b.tokens += (r.promptTokens || 0) + (r.completionTokens || 0); }
  }

  const topUsers = db.all(
    `SELECT u.id, u.email, u.name,
            COALESCE(s.packageName, '—') AS tier,
            COALESCE(s.tokensUsed, 0) AS tokensUsed,
            COALESCE(s.tokenQuota, 0) AS tokenQuota
     FROM users u
     LEFT JOIN subscriptions s ON s.userId = u.id AND s.isSelected = 1 AND s.status = 'active'
     ORDER BY tokensUsed DESC LIMIT 10`
  );

  const totalRequests = db.get(`SELECT COUNT(*) AS n FROM usageHistory`)?.n ?? 0;
  const activeKeys = db.get(`SELECT COUNT(*) AS n FROM apiKeys WHERE userId IS NOT NULL AND isActive = 1`)?.n ?? 0;

  return NextResponse.json({
    users: {
      total: Number(users.total) || 0,
      active: Number(users.active) || 0,
      tokensUsed: Number(quota.tokensUsed) || 0,
      tokenQuota: Number(quota.tokenQuota) || 0,
    },
    byTier,
    series: [...buckets.values()],
    topUsers,
    totalRequests: Number(totalRequests) || 0,
    activeKeys: Number(activeKeys) || 0,
    revenue: await getRevenueSummary(),
  }, { headers: NO_STORE });
}
