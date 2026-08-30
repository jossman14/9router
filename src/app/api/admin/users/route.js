import { NextResponse } from "next/server";
import { listUsers } from "@/lib/db/repos/usersRepo.js";
import { SAAS_MODE } from "@/lib/saas/config.js";

export const dynamic = "force-dynamic";

// Admin-gated in dashboardGuard (SAAS_ADMIN_ONLY covers /api/admin).
export async function GET() {
  if (!SAAS_MODE) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ users: await listUsers() }, { headers: { "Cache-Control": "no-store" } });
}
