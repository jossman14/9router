import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/db/driver.js";
import { getApiKeys } from "@/lib/db/repos/apiKeysRepo.js";
import { getSessionUser } from "@/lib/saas/session.js";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

const PERIODS = [7, 14, 30, 90];
const RECENT_LIMIT = 50;

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Usage for the signed-in tenant only. Rows carry their owner's userId; rows
 * written before that column existed are matched on the caller's own key
 * prefixes instead — never across tenants.
 */
export async function GET(request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });

  const asked = Number(new URL(request.url).searchParams.get("days"));
  const DAYS = PERIODS.includes(asked) ? asked : 14;

  const keys = await getApiKeys(user.id);
  const refs = keys.map((k) => k.keyPrefix || k.id).filter(Boolean);
  const owner = refs.length
    ? { sql: `(userId = ? OR apiKey IN (${refs.map(() => "?").join(",")}))`, args: [user.id, ...refs] }
    : { sql: `userId = ?`, args: [user.id] };

  const db = await getAdapter();
  const since = new Date(Date.now() - DAYS * 86400_000).toISOString();

  const rows = db.all(
    `SELECT timestamp, model, provider, apiKey, promptTokens, completionTokens, cost, status
     FROM usageHistory
     WHERE ${owner.sql} AND timestamp >= ?
     ORDER BY timestamp DESC`,
    [...owner.args, since]
  );

  // Dense day series so the chart has no gaps.
  const buckets = new Map();
  for (let i = DAYS - 1; i >= 0; i--) {
    buckets.set(dayKey(new Date(Date.now() - i * 86400_000)), { date: "", requests: 0, tokens: 0 });
  }
  for (const key of buckets.keys()) buckets.get(key).date = key;

  const totals = { requests: 0, promptTokens: 0, completionTokens: 0, cost: 0 };
  const byModel = new Map();
  for (const r of rows) {
    totals.requests += 1;
    totals.promptTokens += r.promptTokens || 0;
    totals.completionTokens += r.completionTokens || 0;
    totals.cost += r.cost || 0;

    const k = dayKey(new Date(r.timestamp));
    const bucket = buckets.get(k);
    const tokens = (r.promptTokens || 0) + (r.completionTokens || 0);
    if (bucket) { bucket.requests += 1; bucket.tokens += tokens; }

    const m = r.model || "unknown";
    const agg = byModel.get(m) || {
      model: m, provider: r.provider || "-", requests: 0, promptTokens: 0, completionTokens: 0, tokens: 0,
    };
    agg.requests += 1;
    agg.promptTokens += r.promptTokens || 0;
    agg.completionTokens += r.completionTokens || 0;
    agg.tokens += tokens;
    byModel.set(m, agg);
  }

  return NextResponse.json({
    series: [...buckets.values()],
    days: DAYS,
    totals,
    byModel: [...byModel.values()].sort((a, b) => b.tokens - a.tokens),
    recent: rows.slice(0, RECENT_LIMIT).map((r) => ({
      timestamp: r.timestamp,
      model: r.model,
      provider: r.provider,
      apiKey: r.apiKey,
      promptTokens: r.promptTokens || 0,
      completionTokens: r.completionTokens || 0,
      tokens: (r.promptTokens || 0) + (r.completionTokens || 0),
      status: r.status,
    })),
    keys,
  }, { headers: NO_STORE });
}
