import { NextResponse } from "next/server";
import { deleteApiKey, getApiKeyById, updateApiKey } from "@/lib/localDb";
import { SAAS_MODE } from "@/lib/saas/config.js";
import { getSessionUser } from "@/lib/saas/session.js";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Load a key the caller is actually allowed to touch. In SaaS mode a key that
 * belongs to someone else reads as "not found" — never confirm it exists.
 */
async function loadOwnedKey(id) {
  const key = await getApiKeyById(id);
  if (!SAAS_MODE) return { key, userId: null };
  const user = await getSessionUser();
  if (!user) return { unauthorized: true };
  if (!key || key.userId !== user.id) return { key: null, userId: user.id };
  return { key, userId: user.id };
}

// GET /api/keys/[id]
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { key, unauthorized } = await loadOwnedKey(id);
    if (unauthorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
    if (!key) return NextResponse.json({ error: "Key not found" }, { status: 404, headers: NO_STORE });
    return NextResponse.json({ key }, { headers: NO_STORE });
  } catch (error) {
    console.log("Error fetching key:", error);
    return NextResponse.json({ error: "Failed to fetch key" }, { status: 500 });
  }
}

// PUT /api/keys/[id] - enable/disable or rename
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const { key, unauthorized } = await loadOwnedKey(id);
    if (unauthorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
    if (!key) return NextResponse.json({ error: "Key not found" }, { status: 404, headers: NO_STORE });

    const body = await request.json();
    const updateData = {};
    if (body.isActive !== undefined) updateData.isActive = !!body.isActive;
    if (typeof body.name === "string" && body.name.trim()) updateData.name = body.name.trim().slice(0, 60);

    return NextResponse.json({ key: await updateApiKey(id, updateData) }, { headers: NO_STORE });
  } catch (error) {
    console.log("Error updating key:", error);
    return NextResponse.json({ error: "Failed to update key" }, { status: 500 });
  }
}

// DELETE /api/keys/[id]
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { key, userId, unauthorized } = await loadOwnedKey(id);
    if (unauthorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
    if (!key) return NextResponse.json({ error: "Key not found" }, { status: 404, headers: NO_STORE });

    const deleted = await deleteApiKey(id, userId);
    if (!deleted) return NextResponse.json({ error: "Key not found" }, { status: 404, headers: NO_STORE });
    return NextResponse.json({ message: "Key deleted successfully" }, { headers: NO_STORE });
  } catch (error) {
    console.log("Error deleting key:", error);
    return NextResponse.json({ error: "Failed to delete key" }, { status: 500 });
  }
}
