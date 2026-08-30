import { NextResponse } from "next/server";
import { listPackages, seedPackagesIfEmpty } from "@/lib/db/repos/packagesRepo.js";

export const dynamic = "force-dynamic";

// Public catalogue — the landing page and the buy screen both read this.
// Only active packages, and never any internal fields.
export async function GET() {
  await seedPackagesIfEmpty();
  const packages = await listPackages({ activeOnly: true });
  return NextResponse.json({
    packages: packages.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      priceIdr: p.priceIdr,
      tokenQuota: p.tokenQuota,
      allowedModels: p.allowedModels,
      rpm: p.rpm,
      maxKeys: p.maxKeys,
      durationDays: p.durationDays,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}
