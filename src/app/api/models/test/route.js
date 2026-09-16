import { NextResponse } from "next/server";
import { pingModelByKind } from "./ping";
import { SAAS_MODE } from "@/lib/saas/config.js";
import { getSessionUser } from "@/lib/saas/session.js";

// POST /api/models/test - Ping a single model via internal completions or embeddings
export async function POST(request) {
  try {
    if (SAAS_MODE) {
      const user = await getSessionUser();
      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { model, kind } = await request.json();
    if (typeof model !== "string" || !model.trim()) return NextResponse.json({ error: "Model required" }, { status: 400 });
    const result = await pingModelByKind(model, kind || "llm");
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
