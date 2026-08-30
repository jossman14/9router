import { NextResponse } from "next/server";
import { getOrderById, setOrderStatus, deleteOrder } from "@/lib/db/repos/ordersRepo.js";
import { SAAS_MODE } from "@/lib/saas/config.js";

const NO_STORE = { "Cache-Control": "no-store" };

// PATCH — flip status. "paid" is what actually applies the plan to the user.
export async function PATCH(request, { params }) {
  if (!SAAS_MODE) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { id } = await params;
  if (!(await getOrderById(id))) {
    return NextResponse.json({ error: "Order not found" }, { status: 404, headers: NO_STORE });
  }
  const { status } = await request.json().catch(() => ({}));
  try {
    const order = await setOrderStatus(id, status);
    return NextResponse.json({ order }, { headers: NO_STORE });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400, headers: NO_STORE });
  }
}

export async function DELETE(request, { params }) {
  if (!SAAS_MODE) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { id } = await params;
  const ok = await deleteOrder(id);
  if (!ok) return NextResponse.json({ error: "Order not found" }, { status: 404, headers: NO_STORE });
  return NextResponse.json({ success: true }, { headers: NO_STORE });
}
