import { NextResponse } from "next/server";
import { getUserById, setUserTier, setUserActive } from "@/lib/db/repos/usersRepo.js";
import { SAAS_MODE, TIERS } from "@/lib/saas/config.js";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Assign a plan or suspend an account. Admin-only — enforced by the
 * SAAS_ADMIN_ONLY gate in dashboardGuard, which this route sits behind.
 */
export async function PATCH(request, { params }) {
  if (!SAAS_MODE) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { id } = await params;
  if (!(await getUserById(id))) {
    return NextResponse.json({ error: "User not found" }, { status: 404, headers: NO_STORE });
  }

  const { tier, isActive } = await request.json().catch(() => ({}));
  let user = null;

  if (tier !== undefined) {
    if (!TIERS[tier]) {
      return NextResponse.json(
        { error: `Unknown tier. Valid: ${Object.keys(TIERS).join(", ")}` },
        { status: 400, headers: NO_STORE }
      );
    }
    user = await setUserTier(id, tier);
  }
  if (isActive !== undefined) user = await setUserActive(id, !!isActive);

  if (!user) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400, headers: NO_STORE });
  }
  return NextResponse.json({ user }, { headers: NO_STORE });
}
