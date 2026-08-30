import { headers } from "next/headers";
import { getMachineId } from "@/shared/utils/machine";
import { SAAS_MODE, TIERS } from "@/lib/saas/config.js";
import { getSessionUser, publicUser } from "@/lib/saas/session.js";
import EndpointPageClient from "./endpoint/EndpointPageClient";
import TenantDashboard from "./saas/TenantDashboard";

export const dynamic = "force-dynamic";

async function resolveBaseUrl() {
  const configured = process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:20128";
  const proto = h.get("x-forwarded-proto") || "http";
  return `${proto}://${host}`;
}

export default async function DashboardPage() {
  if (SAAS_MODE) {
    const user = await getSessionUser();
    if (user && user.role !== "admin") {
      const tiers = Object.entries(TIERS).map(([id, t]) => ({ id, ...t }));
      return (
        <TenantDashboard
          initialUser={publicUser(user)}
          baseUrl={await resolveBaseUrl()}
          tiers={tiers}
        />
      );
    }
  }
  const machineId = await getMachineId();
  return <EndpointPageClient machineId={machineId} />;
}
