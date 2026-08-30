import { NextResponse } from "next/server";
import { getApiKeys, createApiKey } from "@/lib/localDb";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import { SAAS_MODE } from "@/lib/saas/config.js";
import { getSessionUser } from "@/lib/saas/session.js";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// GET /api/keys - List the caller's API keys
export async function GET() {
  try {
    if (SAAS_MODE) {
      const user = await getSessionUser();
      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
      return NextResponse.json({ keys: await getApiKeys(user.id) }, { headers: NO_STORE });
    }
    return NextResponse.json({ keys: await getApiKeys() }, { headers: NO_STORE });
  } catch (error) {
    console.log("Error fetching keys:", error);
    return NextResponse.json({ error: "Failed to fetch keys" }, { status: 500 });
  }
}

// POST /api/keys - Create a new API key. The plaintext is returned once.
export async function POST(request) {
  try {
    const { name } = await request.json();
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (SAAS_MODE) {
      const user = await getSessionUser();
      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
      try {
        const apiKey = await createApiKey(name.trim().slice(0, 60), null, user.id);
        return NextResponse.json(
          { key: apiKey.key, keyPrefix: apiKey.keyPrefix, name: apiKey.name, id: apiKey.id },
          { status: 201, headers: NO_STORE }
        );
      } catch (e) {
        if (e.code === "KEY_LIMIT") {
          return NextResponse.json({ error: e.message }, { status: 403, headers: NO_STORE });
        }
        throw e;
      }
    }

    const machineId = await getConsistentMachineId();
    const apiKey = await createApiKey(name, machineId);
    return NextResponse.json({
      key: apiKey.key, name: apiKey.name, id: apiKey.id, machineId: apiKey.machineId,
    }, { status: 201, headers: NO_STORE });
  } catch (error) {
    console.log("Error creating key:", error);
    return NextResponse.json({ error: "Failed to create key" }, { status: 500 });
  }
}
