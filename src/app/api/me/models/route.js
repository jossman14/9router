import { NextResponse } from "next/server";
import { buildModelsList } from "@/app/api/v1/models/route.js";
import { getActiveSubscription } from "@/lib/db/repos/subscriptionsRepo.js";
import { getSessionUser } from "@/lib/saas/session.js";
import { isModelAllowed } from "@/lib/saas/quota.js";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

/**
 * The model ids this gateway can actually route — the same list /v1/models
 * serves. A tenant sees only what their selected package allows; an admin sees
 * everything, because the package editor picks its allow-list from here.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });

  const all = (await buildModelsList(["llm"])).map((m) => ({ id: m.id, owned_by: m.owned_by }));
  if (user.role === "admin") return NextResponse.json({ models: all, restricted: false }, { headers: NO_STORE });

  const sub = await getActiveSubscription(user.id);
  const allowed = sub?.allowedModels ?? [];
  return NextResponse.json({
    models: sub ? all.filter((m) => isModelAllowed(allowed, m.id)) : [],
    restricted: allowed.length > 0,
    packageName: sub?.packageName ?? null,
  }, { headers: NO_STORE });
}
