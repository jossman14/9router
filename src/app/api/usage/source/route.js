import { NextResponse } from "next/server";
import { getSourceActivity } from "@/lib/db/repos/usageRepo.js";
import { lookupIpGeo } from "@/lib/ipGeo.js";

const VALID_PERIODS = new Set(["today", "24h", "7d", "30d", "60d", "all"]);
// An IPv4/IPv6 literal or "local". Also keeps LIKE wildcards out of the query.
const SOURCE_RE = /^(?:local|[0-9a-fA-F:.]{2,45})$/;

export const dynamic = "force-dynamic";

// GET /api/usage/source?source=<ip>&period=7d — one client IP's activity over time,
// plus its approximate location and ISP for public addresses.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source") || "";
  const period = searchParams.get("period") || "7d";
  if (!SOURCE_RE.test(source)) return NextResponse.json({ error: "Invalid source" }, { status: 400 });
  if (!VALID_PERIODS.has(period)) return NextResponse.json({ error: "Invalid period" }, { status: 400 });

  try {
    const [activity, geo] = await Promise.all([getSourceActivity(source, period), lookupIpGeo(source)]);
    return NextResponse.json({ ...activity, geo }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[API] Failed to get source activity:", error);
    return NextResponse.json({ error: "Failed to fetch source activity" }, { status: 500 });
  }
}
