import { NextResponse } from "next/server";
import { listPackages, createPackage, seedPackagesIfEmpty } from "@/lib/db/repos/packagesRepo.js";
import { SAAS_MODE } from "@/lib/saas/config.js";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

// Admin-gated by dashboardGuard (SAAS_ADMIN_ONLY covers /api/admin).
export async function GET() {
  if (!SAAS_MODE) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await seedPackagesIfEmpty();
  return NextResponse.json({ packages: await listPackages() }, { headers: NO_STORE });
}

export async function POST(request) {
  if (!SAAS_MODE) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  try {
    const pkg = await createPackage(body);
    return NextResponse.json({ package: pkg }, { status: 201, headers: NO_STORE });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400, headers: NO_STORE });
  }
}
