import { NextResponse } from "next/server";
import { getUserById, setUserActive } from "@/lib/db/repos/usersRepo.js";
import {
  createSubscription, listSubscriptions, adjustSubscriptionQuota, setSubscriptionStatus,
} from "@/lib/db/repos/subscriptionsRepo.js";
import { getPackageById } from "@/lib/db/repos/packagesRepo.js";
import { SAAS_MODE } from "@/lib/saas/config.js";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request, { params }) {
  if (!SAAS_MODE) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { id } = await params;
  const user = await getUserById(id);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404, headers: NO_STORE });
  return NextResponse.json({ user, subscriptions: await listSubscriptions(id) }, { headers: NO_STORE });
}

/**
 * Admin actions on one account. Granting a package issues a fresh subscription
 * (a gift, distinct from a paid order); quota adjustment and suspension act on
 * the existing one.
 */
export async function PATCH(request, { params }) {
  if (!SAAS_MODE) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { id } = await params;
  if (!(await getUserById(id))) {
    return NextResponse.json({ error: "User not found" }, { status: 404, headers: NO_STORE });
  }

  const body = await request.json().catch(() => ({}));
  let touched = false;

  if (body.packageId) {
    const pkg = await getPackageById(body.packageId);
    if (!pkg) {
      return NextResponse.json({ error: "Paket tidak ditemukan" }, { status: 400, headers: NO_STORE });
    }
    await createSubscription({ userId: id, packageId: pkg.id, select: true });
    touched = true;
  }

  if (body.subscriptionId && body.tokenQuota !== undefined) {
    const subs = await listSubscriptions(id);
    if (!subs.some((s) => s.id === body.subscriptionId)) {
      return NextResponse.json({ error: "Langganan tidak ditemukan" }, { status: 400, headers: NO_STORE });
    }
    await adjustSubscriptionQuota(body.subscriptionId, body.tokenQuota);
    touched = true;
  }

  if (body.subscriptionId && body.status) {
    const subs = await listSubscriptions(id);
    if (!subs.some((s) => s.id === body.subscriptionId)) {
      return NextResponse.json({ error: "Langganan tidak ditemukan" }, { status: 400, headers: NO_STORE });
    }
    await setSubscriptionStatus(body.subscriptionId, body.status);
    touched = true;
  }

  if (body.isActive !== undefined) {
    await setUserActive(id, !!body.isActive);
    touched = true;
  }

  if (!touched) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400, headers: NO_STORE });
  }
  return NextResponse.json({
    user: await getUserById(id),
    subscriptions: await listSubscriptions(id),
  }, { headers: NO_STORE });
}
