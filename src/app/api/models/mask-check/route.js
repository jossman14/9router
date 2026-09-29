import { NextResponse } from "next/server";
import { getInternalHeaders } from "../test/ping";
import { judgeMask, clusterBackends } from "@/lib/modelMask.js";
import { BUFFER_TOKENS } from "open-sse/utils/usageTracking.js";
import { SAAS_MODE } from "@/lib/saas/config.js";
import { getSessionUser } from "@/lib/saas/session.js";
import { UPDATER_CONFIG } from "@/shared/constants/config";
import { getApiKeys, revealApiKey, getSettings, updateSettings } from "@/lib/localDb";
import { getModelInfo } from "@/sse/services/model.js";

// Fixed wording on purpose: the tokenizer check compares prompt_tokens of the
// same input across two models, so this text must never vary between probes.
const PROBE_MESSAGES = [
  { role: "system", content: "Answer truthfully and briefly." },
  { role: "user", content: 'Which company created you, and what is your exact model name? Reply only as JSON: {"vendor":"...","model":"..."}' },
];

async function probe(model, headers) {
  const baseUrl = `http://127.0.0.1:${process.env.PORT || UPDATER_CONFIG.appPort}`;
  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl}/api/v1/chat/completions`, {
      method: "POST",
      headers: { ...headers, "x-9r-no-skills": "1" },
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
      // The gateway pads client-facing usage by BUFFER_TOKENS; strip it or the
      // padding dilutes the tokenizer drift below the tolerance.
      promptTokens: typeof data?.usage?.prompt_tokens === "number" ? Math.max(0, data.usage.prompt_tokens - BUFFER_TOKENS) : null,
      reply: String(msg.content || msg.reasoning_content || "").slice(0, 1000),
    };
  } catch (err) {
    return { ok: false, requested: model, latencyMs: Date.now() - start, error: err.message };
  }
}

// In SaaS mode keys are hash-only, so the probe signs with the signed-in
// admin's own key (owner-only reveal). Its tokens bill to that admin's plan.
async function adminProbeHeaders(user) {
  const headers = await getInternalHeaders();
  const keys = await getApiKeys(user.id);
  for (const k of keys.filter((k) => k.isActive)) {
    const plaintext = await revealApiKey(k.id, user.id);
    if (plaintext) return { ...headers, Authorization: `Bearer ${plaintext}` };
  }
  return headers;
}

const MAX_SAMPLES = 10;
const SAMPLE_CONCURRENCY = 3;

// Repeat the probe to expose pooled aliases; a small worker pool keeps one
// check from flooding the upstream.
async function probeMany(model, headers, n) {
  const results = new Array(n);
  let next = 0;
  const worker = async () => {
    while (next < n) {
      const i = next++;
      results[i] = await probe(model, headers);
    }
  };
  await Promise.all(Array.from({ length: Math.min(SAMPLE_CONCURRENCY, n) }, worker));
  return results;
}

// Upstreams like srbyte echo the alias ("auto") as the served model, so the
// last sampled result is the only record of what actually sits behind it.
// Keyed like usage rows (`model|providerId`) so the Usage table can join it.
// ponytail: read-merge-write on one settings key; two checks finishing at the
// same instant can drop one result — rerun it.
async function saveMaskResult(requested, verdict, backends) {
  const info = await getModelInfo(requested).catch(() => null);
  if (!info?.provider) return;
  const { maskChecks = {} } = await getSettings();
  const entry = { checkedAt: new Date().toISOString(), verdict, backends: backends.map(({ vendor, count, models }) => ({ vendor, count, models })) };
  await updateSettings({ maskChecks: { ...maskChecks, [`${info.model}|${info.provider}`]: entry } });
}

// POST /api/models/mask-check - { model, reference?, samples? } → verdict + per-signal checks
export async function POST(request) {
  let headers;
  if (SAAS_MODE) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    headers = await adminProbeHeaders(user);
  } else {
    headers = await getInternalHeaders();
  }
  const { model, reference, samples } = await request.json().catch(() => ({}));
  const n = Math.min(MAX_SAMPLES, Math.max(1, Number.parseInt(samples, 10) || 1));
  if (typeof model !== "string" || !model.trim()) return NextResponse.json({ error: "Model required" }, { status: 400 });

  const ref = typeof reference === "string" && reference.trim() ? reference.trim() : null;
  const [runs, refProbe] = await Promise.all([probeMany(model.trim(), headers, n), ref ? probe(ref, headers) : null]);
  const target = runs.find((r) => r.ok) || runs[0];
  const sampleStats = { total: n, ok: runs.filter((r) => r.ok).length };
  if (!target.ok) return NextResponse.json({ target, reference: refProbe, samples: sampleStats, verdict: "error", checks: [] });

  const result = judgeMask(target, refProbe?.ok ? refProbe : null, n > 1 ? runs : null);
  const backends = n > 1 ? clusterBackends(runs) : [];
  if (backends.length) await saveMaskResult(model.trim(), result.verdict, backends).catch(() => {});
  return NextResponse.json({ target, reference: refProbe, samples: sampleStats, backends, ...result });
}
