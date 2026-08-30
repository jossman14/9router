import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createUser } from "@/lib/db/repos/usersRepo.js";
import { setDashboardAuthCookie } from "@/lib/auth/dashboardSession";
import { checkLock, recordFail, getClientIp } from "@/lib/auth/loginLimiter";
import { SAAS_MODE, DEFAULT_TIER } from "@/lib/saas/config.js";
import { publicUser } from "@/lib/saas/session.js";

const NO_STORE = { "Cache-Control": "no-store" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate({ email, password }) {
  if (!EMAIL_RE.test(String(email || "").trim())) return "Enter a valid email address";
  const pw = String(password || "");
  if (pw.length < 10) return "Password must be at least 10 characters";
  if (pw.length > 200) return "Password is too long";
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return "Password must contain both letters and numbers";
  return null;
}

export async function POST(request) {
  if (!SAAS_MODE) {
    return NextResponse.json({ error: "Registration is disabled" }, { status: 404 });
  }
  // Reuse the login limiter's IP buckets so signup floods get locked out too.
  const ip = getClientIp(request);
  const lock = checkLock(ip);
  if (lock.locked) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${lock.retryAfter}s.` },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(lock.retryAfter) } }
    );
  }

  let body;
  try { body = await request.json(); } catch { body = {}; }

  const invalid = validate(body);
  if (invalid) {
    recordFail(ip);
    return NextResponse.json({ error: invalid }, { status: 400, headers: NO_STORE });
  }

  try {
    const user = await createUser({
      email: body.email,
      password: body.password,
      name: String(body.name || "").slice(0, 100),
      tier: DEFAULT_TIER,
    });
    const cookieStore = await cookies();
    await setDashboardAuthCookie(cookieStore, request, {
      sub: user.id, ver: user.tokenVersion ?? 1, role: user.role, email: user.email,
    });
    return NextResponse.json({ success: true, user: publicUser(user) }, { status: 201, headers: NO_STORE });
  } catch (e) {
    if (e.code === "EMAIL_TAKEN") {
      recordFail(ip);
      return NextResponse.json({ error: "Email already registered" }, { status: 409, headers: NO_STORE });
    }
    return NextResponse.json({ error: "Registration failed" }, { status: 500, headers: NO_STORE });
  }
}
