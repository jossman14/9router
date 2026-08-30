import { guard } from "./dashboardGuard";

export default async function proxy(request) {
  return guard(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
