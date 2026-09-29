import { NextResponse } from "next/server";
import { getServedModels } from "@/lib/usageDb";
import { getProviderConnections, getProviderNodes, getSettings } from "@/lib/localDb";

const VALID_PERIODS = new Set(["today", "24h", "7d", "30d", "60d", "all"]);

export const dynamic = "force-dynamic";

// GET /api/usage/served-models?period=7d - requested vs actually-served model per connection
export async function GET(request) {
  try {
    const period = new URL(request.url).searchParams.get("period") || "7d";
    if (!VALID_PERIODS.has(period)) return NextResponse.json({ error: "Invalid period" }, { status: 400 });

    const [rows, connections, nodes, settings] = await Promise.all([
      getServedModels(period),
      getProviderConnections().catch(() => []),
      getProviderNodes().catch(() => []),
      getSettings().catch(() => ({})),
    ]);
    const connName = Object.fromEntries(connections.map((c) => [c.id, c.name]));
    const nodeName = Object.fromEntries(nodes.map((n) => [n.id, n.name]));
    const items = rows.map((r) => ({
      ...r,
      providerName: connName[r.connectionId] || nodeName[r.provider] || r.provider,
    }));
    return NextResponse.json({ items, maskChecks: settings.maskChecks || {} });
  } catch (error) {
    console.error("[API] Failed to get served models:", error);
    return NextResponse.json({ error: "Failed to fetch served models" }, { status: 500 });
  }
}
