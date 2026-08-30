import { NextResponse } from "next/server";
import { listOrders, createOrder } from "@/lib/db/repos/ordersRepo.js";
import { getSessionUser } from "@/lib/saas/session.js";
import { TIERS } from "@/lib/saas/config.js";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

// A tenant's own purchase history.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  return NextResponse.json({ orders: await listOrders({ userId: user.id }) }, { headers: NO_STORE });
}

/**
 * Request an upgrade. This only ever files a *pending* order — a user can never
 * grant themselves a plan; an admin has to mark it paid.
 */
export async function POST(request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });

  const { tier } = await request.json().catch(() => ({}));
  if (!TIERS[tier]) {
    return NextResponse.json({ error: "Paket tidak dikenal" }, { status: 400, headers: NO_STORE });
  }

  const open = (await listOrders({ userId: user.id, status: "pending" }))[0];
  if (open) {
    return NextResponse.json(
      { error: "Anda masih punya permintaan yang belum diproses." },
      { status: 409, headers: NO_STORE }
    );
  }

  const order = await createOrder({
    userId: user.id,
    tier,
    note: "Diminta oleh pengguna dari dashboard",
    status: "pending",
    createdBy: user.email,
  });
  return NextResponse.json({ order }, { status: 201, headers: NO_STORE });
}
