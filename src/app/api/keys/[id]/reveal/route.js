import { NextResponse } from "next/server";
import { revealApiKey } from "@/lib/localDb";
import { getSessionUser } from "@/lib/saas/session.js";
import { checkRate } from "@/lib/saas/rateLimit.js";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// POST /api/keys/[id]/reveal - Return the plaintext key to its owner only.
// SaaS mode only. Rate-limited (10/min per user) and never cached; a foreign
// key id reads as "not found" so ids can't be probed across tenants.
export async function POST(request, { params }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
    // Compare the browser origin with Host, not forwarded headers. Host remains
    // the public host when a reverse proxy terminates TLS ahead of Next.
    let sameOrigin = false;
    try {
      const origin = new URL(request.headers.get("origin"));
      const host = request.headers.get("host") || new URL(request.url).host;
      sameOrigin = ["http:", "https:"].includes(origin.protocol) && origin.host === host;
    } catch { /* absent or malformed Origin is not a browser reveal */ }
    if (!sameOrigin || request.headers.get("sec-fetch-site") === "cross-site") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
    }
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Key not found" }, { status: 404, headers: NO_STORE });

    const rate = checkRate(`reveal:${user.id}`, 10);
    if (!rate.ok) {
      return NextResponse.json({ error: "Terlalu sering. Coba lagi sebentar." }, { status: 429, headers: { ...NO_STORE, "Retry-After": String(rate.retryAfter || 60) } });
    }

    const key = await revealApiKey(id, user.id);
    if (!key) return NextResponse.json({ error: "Key not found" }, { status: 404, headers: NO_STORE });
    return NextResponse.json({ key }, { headers: NO_STORE });
  } catch {
    console.error("Error revealing API key");
    return NextResponse.json({ error: "Failed to reveal key" }, { status: 500, headers: NO_STORE });
  }
}
