import { NextResponse } from "next/server";
import { getInternalHeaders } from "../test/ping";
import { judgeMask } from "@/lib/modelMask.js";
import { SAAS_MODE } from "@/lib/saas/config.js";
import { getSessionUser } from "@/lib/saas/session.js";
import { UPDATER_CONFIG } from "@/shared/constants/config";

// Fixed wording on purpose: the tokenizer check compares prompt_tokens of the
// same input across two models, so this text must never vary between probes.
const PROBE_MESSAGES = [
  { role: "system", content: "Answer truthfully and briefly." },
  { role: "user", content: 'Which company created you, and what is your exact model name? Reply only as JSON: {"vendor":"...","model":"..."}' },
];

async function probe(model) {
  const baseUrl = `http://127.0.0.1:${process.env.PORT || UPDATER_CONFIG.appPort}`;
  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl}/api/v1/chat/completions`, {
      method: "POST",
      headers: await getInternalHeaders(),
      body: JSON.stringify({ model, stream: false, max_tokens: 1024, temperature: 0, messages: PROBE_MESSAGES }),
      signal: AbortSignal.timeout(60000),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = data?.error?.message || data?.error || `HTTP ${res.status}`;
      return { ok: false, requested: model, latencyMs: Date.now() - start, error: String(detail).slice(0, 300) };
    }
    const msg = data?.choices?.[0]?.message || {};
    return {
      ok: true,
      requested: model,
      latencyMs: Date.now() - start,
      returnedModel: data?.model || null,
      promptTokens: data?.usage?.prompt_tokens ?? null,
      reply: String(msg.content || msg.reasoning_content || "").slice(0, 1000),
    };
  } catch (err) {
    return { ok: false, requested: model, latencyMs: Date.now() - start, error: err.message };
  }
}

// POST /api/models/mask-check - { model, reference? } → verdict + per-signal checks
export async function POST(request) {
  if (SAAS_MODE) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { model, reference } = await request.json().catch(() => ({}));
  if (typeof model !== "string" || !model.trim()) return NextResponse.json({ error: "Model required" }, { status: 400 });

  const ref = typeof reference === "string" && reference.trim() ? reference.trim() : null;
  const [target, refProbe] = await Promise.all([probe(model.trim()), ref ? probe(ref) : null]);
  if (!target.ok) return NextResponse.json({ target, reference: refProbe, verdict: "error", checks: [] });

  const result = judgeMask(target, refProbe?.ok ? refProbe : null);
  return NextResponse.json({ target, reference: refProbe, ...result });
}
