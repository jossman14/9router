import { redirect } from "next/navigation";
import { SAAS_MODE, TIERS } from "@/lib/saas/config.js";
import { getSessionUser } from "@/lib/saas/session.js";
import AdminConsole from "./AdminConsole";

export const dynamic = "force-dynamic";

export const metadata = { title: "Users & Billing — 9Router" };

export default async function AdminPage() {
  // Belt and braces: dashboardGuard already gates /api/admin, but the page
  // itself must not render for a tenant who guesses the URL.
  if (!SAAS_MODE) redirect("/dashboard");
  const user = await getSessionUser();
  if (!user || user.role !== "admin") redirect("/dashboard");

  const tiers = Object.entries(TIERS).map(([id, t]) => ({ id, ...t }));
  return <AdminConsole tiers={tiers} adminEmail={user.email} />;
}
