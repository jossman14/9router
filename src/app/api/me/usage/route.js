import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/db/driver.js";
import { getApiKeys } from "@/lib/db/repos/apiKeysRepo.js";
import { getSessionUser } from "@/lib/saas/session.js";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

const DAYS = 14;
const RECENT_LIMIT = 25;

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Usage for the signed-in tenant only. Rows are matched on the caller's own
 * key references (prefix, or id as fallback) — never across tenants.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });

  const keys = await getApiKeys(user.id);
  const refs = keys.map((k) => k.keyPrefix || k.id).filter(Boolean);

  const empty = {
    series: [], totals: { requests: 0, promptTokens: 0, completionTokens: 0, cost: 0 },
    byModel: [], recent: [], keys,
  };
  if (!refs.length) return NextResponse.json(empty, { headers: NO_STORE });

  const db = await getAdapter();
  const ph = refs.map(() => "?").join(",");
  const since = new Date(Date.now() - DAYS * 86400_000).toISOString();

  const rows = db.all(
    `SELECT timestamp, model, provider, apiKey, promptTokens, completionTokens, cost, status
     FROM usageHistory
     WHERE apiKey IN (${ph}) AND timestamp >= ?
     ORDER BY timestamp DESC`,
    [...refs, since]
  );

  const totalsRow = db.get(
    `SELECT COUNT(*) AS requests,
            COALESCE(SUM(promptTokens), 0) AS promptTokens,
            COALESCE(SUM(completionTokens), 0) AS completionTokens,
            COALESCE(SUM(cost), 0) AS cost
     FROM usageHistory WHERE apiKey IN (${ph})`,
    refs
  ) || {};

  // Dense day series so the chart has no gaps.
  const buckets = new Map();
  for (let i = DAYS - 1; i >= 0; i--) {
    buckets.set(dayKey(new Date(Date.now() - i * 86400_000)), { date: "", requests: 0, tokens: 0 });
  }
  for (const key of buckets.keys()) buckets.get(key).date = key;

  const byModel = new Map();
  for (const r of rows) {
    const k = dayKey(new Date(r.timestamp));
    const bucket = buckets.get(k);
    const tokens = (r.promptTokens || 0) + (r.completionTokens || 0);
    if (bucket) { bucket.requests += 1; bucket.tokens += tokens; }

    const m = r.model || "unknown";
    const agg = byModel.get(m) || { model: m, provider: r.provider || "-", requests: 0, tokens: 0 };
    agg.requests += 1;
    agg.tokens += tokens;
    byModel.set(m, agg);
  }

  return NextResponse.json({
    series: [...buckets.values()],
    totals: {
      requests: Number(totalsRow.requests) || 0,
      promptTokens: Number(totalsRow.promptTokens) || 0,
      completionTokens: Number(totalsRow.completionTokens) || 0,
      cost: Number(totalsRow.cost) || 0,
    },
    byModel: [...byModel.values()].sort((a, b) => b.tokens - a.tokens).slice(0, 8),
    recent: rows.slice(0, RECENT_LIMIT).map((r) => ({
      timestamp: r.timestamp,
      model: r.model,
      provider: r.provider,
      apiKey: r.apiKey,
      tokens: (r.promptTokens || 0) + (r.completionTokens || 0),
      status: r.status,
    })),
    keys,
  }, { headers: NO_STORE });
}
