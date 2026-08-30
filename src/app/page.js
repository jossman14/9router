import { redirect } from "next/navigation";
import { SAAS_MODE } from "@/lib/saas/config.js";
import LandingPage from "./landing/page";

export { metadata } from "./landing/page";

// SAAS_MODE is a runtime flag, so this route must not be prerendered — a static
// "/" would bake in whatever the flag was during `next build`.
export const dynamic = "force-dynamic";

export default function RootPage() {
  // Self-hosted single-user installs boot straight into the dashboard; the
  // SaaS deployment needs "/" to be the marketing page.
  if (!SAAS_MODE) redirect("/dashboard");
  return <LandingPage />;
}
