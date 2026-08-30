import { NextResponse } from "next/server";
import { getPackageById, updatePackage, deletePackage } from "@/lib/db/repos/packagesRepo.js";
import { SAAS_MODE } from "@/lib/saas/config.js";

const NO_STORE = { "Cache-Control": "no-store" };

export async function PATCH(request, { params }) {
  if (!SAAS_MODE) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { id } = await params;
  if (!(await getPackageById(id))) {
    return NextResponse.json({ error: "Paket tidak ditemukan" }, { status: 404, headers: NO_STORE });
  }
  const body = await request.json().catch(() => ({}));
  try {
    return NextResponse.json({ package: await updatePackage(id, body) }, { headers: NO_STORE });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400, headers: NO_STORE });
  }
}

// Deactivates rather than deletes when subscriptions still reference it, so
// purchase history keeps its label.
export async function DELETE(request, { params }) {
  if (!SAAS_MODE) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { id } = await params;
  if (!(await getPackageById(id))) {
    return NextResponse.json({ error: "Paket tidak ditemukan" }, { status: 404, headers: NO_STORE });
  }
  const res = await deletePackage(id);
  return NextResponse.json(res, { headers: NO_STORE });
}
