import { NextResponse } from "next/server";
import { listOrders, createOrder } from "@/lib/db/repos/ordersRepo.js";
import { SAAS_MODE } from "@/lib/saas/config.js";
import { getSessionUser } from "@/lib/saas/session.js";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

// Admin-gated by dashboardGuard (SAAS_ADMIN_ONLY covers /api/admin).
export async function GET(request) {
  if (!SAAS_MODE) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { searchParams } = new URL(request.url);
  const orders = await listOrders({
    userId: searchParams.get("userId") || null,
    status: searchParams.get("status") || null,
  });
  return NextResponse.json({ orders }, { headers: NO_STORE });
}

export async function POST(request) {
  if (!SAAS_MODE) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const admin = await getSessionUser();
  const body = await request.json().catch(() => ({}));
  if (!body.userId || !body.packageId) {
    return NextResponse.json({ error: "userId dan packageId wajib diisi" }, { status: 400, headers: NO_STORE });
  }
  try {
    const order = await createOrder({
      userId: body.userId,
      packageId: body.packageId,
      amountIdr: body.amountIdr,
      note: String(body.note || "").slice(0, 300),
      status: body.status === "paid" ? "paid" : "pending",
      createdBy: admin?.email || "admin",
    });
    return NextResponse.json({ order }, { status: 201, headers: NO_STORE });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400, headers: NO_STORE });
  }
}
