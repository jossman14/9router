import { NextResponse } from "next/server";
import { listSubscriptions, selectSubscription } from "@/lib/db/repos/subscriptionsRepo.js";
import { getSessionUser } from "@/lib/saas/session.js";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  return NextResponse.json({ subscriptions: await listSubscriptions(user.id) }, { headers: NO_STORE });
}

/**
 * Choose which purchased package this account's traffic draws from.
 * Scoped to the caller — selectSubscription matches on userId, so one tenant
 * cannot activate another's package.
 */
export async function PATCH(request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });

  const { subscriptionId } = await request.json().catch(() => ({}));
  if (!subscriptionId) {
    return NextResponse.json({ error: "subscriptionId wajib diisi" }, { status: 400, headers: NO_STORE });
  }
  const sub = await selectSubscription(user.id, subscriptionId);
  if (!sub) {
    return NextResponse.json(
      { error: "Paket tidak ditemukan atau sudah tidak aktif" },
      { status: 404, headers: NO_STORE }
    );
  }
  return NextResponse.json({ subscription: sub }, { headers: NO_STORE });
}
