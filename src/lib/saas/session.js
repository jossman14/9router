import { cookies } from "next/headers";
import { getDashboardAuthSession } from "@/lib/auth/dashboardSession";
import { getUserById } from "@/lib/db/repos/usersRepo.js";
import { getTier } from "./config.js";

/**
 * Resolve the signed-in SaaS user from the auth cookie.
 * Returns null when there is no session, the user is gone/suspended, or the
 * token predates a password change (tokenVersion mismatch).
 */
export async function getSessionUser() {
  const cookieStore = await cookies();
  const session = await getDashboardAuthSession(cookieStore.get("auth_token")?.value);
  if (!session?.sub) return null;
  const user = await getUserById(session.sub);
  if (!user || !user.isActive) return null;
  if (Number(session.ver ?? 0) !== Number(user.tokenVersion ?? 1)) return null;
  return user;
}

export function publicUser(user) {
  if (!user) return null;
  const tier = getTier(user.tier);
  const remaining = Math.max(0, user.tokenQuota - user.tokensUsed);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tier: user.tier,
    tierLabel: tier.label,
    tokenQuota: user.tokenQuota,
    tokensUsed: user.tokensUsed,
    tokensRemaining: remaining,
    usedPercent: user.tokenQuota ? Math.min(100, (user.tokensUsed / user.tokenQuota) * 100) : 0,
    rpm: tier.rpm,
    maxKeys: tier.maxKeys,
    periodStart: user.periodStart,
    createdAt: user.createdAt,
  };
}
