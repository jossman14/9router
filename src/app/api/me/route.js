import { NextResponse } from "next/server";
import { getSessionUser, publicUser } from "@/lib/saas/session.js";
import { setUserPassword, verifyUserPassword } from "@/lib/db/repos/usersRepo.js";

const NO_STORE = { "Cache-Control": "no-store" };

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  return NextResponse.json({ user: publicUser(user) }, { headers: NO_STORE });
}

// Password change. Re-auth with the current password, which also bumps
// tokenVersion and invalidates every existing session.
export async function PATCH(request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });

  const { currentPassword, newPassword } = await request.json().catch(() => ({}));
  if (!(await verifyUserPassword(user.email, currentPassword))) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 403, headers: NO_STORE });
  }
  const pw = String(newPassword || "");
  if (pw.length < 10 || !/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) {
    return NextResponse.json(
      { error: "Password must be at least 10 characters and contain letters and numbers" },
      { status: 400, headers: NO_STORE }
    );
  }
  await setUserPassword(user.id, pw);
  return NextResponse.json({ success: true, reauth: true }, { headers: NO_STORE });
}
