import { headers } from "next/headers";
import { getMachineId } from "@/shared/utils/machine";
import { SAAS_MODE } from "@/lib/saas/config.js";
import { getSessionContext } from "@/lib/saas/session.js";
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
    const ctx = await getSessionContext();
    if (ctx && ctx.user.role !== "admin") {
      return <TenantDashboard initialUser={ctx.publicUser} baseUrl={await resolveBaseUrl()} />;
    }
  }
  const machineId = await getMachineId();
  return <EndpointPageClient machineId={machineId} />;
}
