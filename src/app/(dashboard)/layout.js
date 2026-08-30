import { DashboardLayout } from "@/shared/components";
import { SAAS_MODE } from "@/lib/saas/config.js";
import { getSessionUser } from "@/lib/saas/session.js";

export default async function DashboardRootLayout({ children }) {
  // Tenants get a bare shell — the operator console (providers, proxy pools,
  // upstream credentials) is not theirs to see. Admins and self-hosted installs
  // keep the full sidebar layout unchanged.
  if (SAAS_MODE) {
    const user = await getSessionUser();
    if (user && user.role !== "admin") return children;
  }
  return <DashboardLayout>{children}</DashboardLayout>;
}
