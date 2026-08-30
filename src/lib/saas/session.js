import { cookies } from "next/headers";
import { getDashboardAuthSession } from "@/lib/auth/dashboardSession";
import { getUserById } from "@/lib/db/repos/usersRepo.js";
import { getActiveSubscription, listSubscriptions } from "@/lib/db/repos/subscriptionsRepo.js";

/**
 * Resolve the signed-in user from the auth cookie.
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

/** Shape sent to the browser. Never includes the password hash. */
export function publicUser(user, sub = null) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    subscription: sub
      ? {
          id: sub.id,
          packageId: sub.packageId,
          packageName: sub.packageName,
          tokenQuota: sub.tokenQuota,
          tokensUsed: sub.tokensUsed,
          tokensRemaining: sub.tokensRemaining,
          usedPercent: sub.usedPercent,
          allowedModels: sub.allowedModels,
          rpm: sub.rpm,
          maxKeys: sub.maxKeys,
          expiresAt: sub.expiresAt,
          startedAt: sub.startedAt,
        }
      : null,
  };
}

/** User plus their currently selected package, for dashboard rendering. */
export async function getSessionContext() {
  const user = await getSessionUser();
  if (!user) return null;
  const sub = await getActiveSubscription(user.id);
  return { user, subscription: sub, publicUser: publicUser(user, sub) };
}

export async function getUserSubscriptions(userId) {
  return listSubscriptions(userId);
}
