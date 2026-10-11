// Model masking = a provider advertises model X but serves something else.
// No single probe proves it, so three independent signals are combined:
// the `model` field the upstream echoes, the vendor the model claims to be,
// and (optionally) the prompt-token count against a trusted reference model —
// identical input tokenized by a different family gives a different count.

const VENDORS = [
  { id: "anthropic", re: /claude|anthropic/i },
  { id: "openai", re: /chatgpt|\bgpt|openai|codex|^o[134](-|$)/i },
  { id: "google", re: /gemini|gemma|google|bard/i },
  { id: "xai", re: /grok|\bxai\b|x\.ai/i },
  { id: "deepseek", re: /deepseek|深度求索/i },
  { id: "alibaba", re: /qwen|qwq|tongyi|通义|alibaba|阿里/i },
  { id: "zhipu", re: /\bglm|zhipu|智谱/i },
  { id: "moonshot", re: /kimi|moonshot|月之暗面/i },
  { id: "meta", re: /llama|meta ai/i },
  { id: "mistral", re: /mistral|mixtral|codestral|devstral/i },
  { id: "minimax", re: /minimax|abab/i },
  { id: "xiaomi", re: /mimo/i },
  { id: "shanghai-ai-lab", re: /internlm|intern-s\d|shanghai (?:ai|artificial intelligence) lab|上海人工智能实验室/i },
];

// Same tokenizer + same input should land within a couple of tokens; the slack
// absorbs chat-template differences between providers of the same family.
const TOKENIZER_TOLERANCE = 0.03;
const HIDDEN_PROMPT_RATIO = 1.5;

const baseName = (model) => String(model || "").split("/").pop().toLowerCase();

export function expectedVendor(model) {
  const name = baseName(model);
  return VENDORS.find((v) => v.re.test(name))?.id || null;
}

// Earliest mention wins, so "I'm Claude, not ChatGPT" reads as anthropic.
export function detectVendor(text) {
  let best = null;
  for (const v of VENDORS) {
    const idx = String(text || "").search(v.re);
    if (idx >= 0 && (!best || idx < best.idx)) best = { id: v.id, idx };
  }
  return best?.id || null;
}

function returnedCheck(probe, expected) {
  const returned = probe.returnedModel;
  let pass = null;
  if (expected && returned) {
    const got = expectedVendor(returned);
    pass = baseName(returned).includes(baseName(probe.requested)) || (got ? got === expected : null);
  }
  return { id: "returned", label: "Model field from upstream", pass, detail: returned || "(not reported)" };
}

function identityCheck(probe, expected) {
  const claimed = detectVendor(probe.reply);
  const pass = expected && claimed ? claimed === expected : null;
  return { id: "identity", label: "Self-reported vendor", pass, detail: `expected ${expected || "?"}, claims ${claimed || "?"}` };
}

function tokenizerCheck(probe, reference) {
  const a = probe.promptTokens;
  const b = reference?.promptTokens;
  if (!reference || typeof a !== "number" || typeof b !== "number") {
    return { id: "tokenizer", label: "Tokenizer fingerprint", pass: null, detail: reference ? "usage not reported" : "no reference model" };
  }
  const drift = Math.abs(a - b) / Math.max(a, b, 1);
  // Far more tokens than any tokenizer explains means the upstream wraps the
  // prompt in its own hidden system prompt — itself a sign of a disguised model.
  const hidden = a > b * HIDDEN_PROMPT_RATIO ? ` — ~${a - b} extra tokens: upstream injects a hidden prompt` : "";
  return { id: "tokenizer", label: "Tokenizer fingerprint", pass: drift <= TOKENIZER_TOLERANCE, detail: `${a} vs reference ${b} prompt tokens${hidden}` };
}

// Earliest knowledge cutoff each family's vendor publishes. A reply claiming a
// much older cutoff than the name implies is the classic tell of an older,
// cheaper model served under a newer name. Only "too old" is judged: models
// under-report their cutoff, and a lower bound stays valid for later versions
// of a family. Unlisted models are not judged.
// ponytail: hand-kept table — add a row when a new family ships.
const KNOWN_CUTOFFS = [
  { re: /claude-(?:opus|sonnet|haiku)-4|claude-4/, cutoff: "2025-01" },
  { re: /claude-3[.-]7/, cutoff: "2024-10" },
  { re: /claude-3[.-]5/, cutoff: "2024-04" },
  { re: /gpt-5/, cutoff: "2024-09" },
  { re: /gpt-4\.1/, cutoff: "2024-06" },
  { re: /gpt-4o/, cutoff: "2023-10" },
  { re: /gemini-2\.5/, cutoff: "2025-01" },
  { re: /gemini-2\.0/, cutoff: "2024-08" },
];
const CUTOFF_SLACK_MONTHS = 12;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_ALIASES = { mei: 4, agu: 7, agt: 7, okt: 9, des: 11 };

const toMonths = (label) => {
  const [y, m] = label.split("-").map(Number);
  return y * 12 + (m || 1) - 1;
};

export function expectedCutoff(model) {
  const name = baseName(model);
  return KNOWN_CUTOFFS.find((c) => c.re.test(name))?.cutoff || null;
}

// The knowledge cutoff a probe reply claims, as "YYYY-MM" (or "YYYY" when no
// month is given), or null. Prefers the JSON `cutoff` field over free text.
export function claimedCutoff(reply) {
  const text = String(reply || "");
  const field = text.match(/"cutoff"\s*:\s*"([^"]{1,60})"/)?.[1] ?? text;
  const iso = field.match(/\b(20\d{2})[-/.](0?[1-9]|1[0-2])\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}`;
  for (const [, word, year] of field.matchAll(/\b([a-z]{3})[a-z]*\.?\s+(20\d{2})\b/gi)) {
    const key = word.toLowerCase();
    const idx = MONTHS.includes(key) ? MONTHS.indexOf(key) : MONTH_ALIASES[key];
    if (idx !== undefined) return `${year}-${String(idx + 1).padStart(2, "0")}`;
  }
  return field.match(/\b(20\d{2})\b/)?.[1] ?? null;
}

function cutoffCheck(probe) {
  const expected = expectedCutoff(probe.requested) || expectedCutoff(probe.returnedModel);
  const claimed = claimedCutoff(probe.reply);
  if (!expected || !claimed) {
    return { id: "cutoff", label: "Knowledge cutoff", pass: null, detail: `claims ${claimed || "?"}${expected ? `, expected ≥ ${expected}` : ", no published cutoff for this model"}` };
  }
  const gap = toMonths(expected) - toMonths(claimed);
  const pass = gap <= CUTOFF_SLACK_MONTHS;
  return { id: "cutoff", label: "Knowledge cutoff", pass, detail: `claims ${claimed}, expected ≥ ${expected}${pass ? "" : ` — ${gap} months older: likely an older model`}` };
}

const UNDISCLOSED = /^(?:unknown|not? ?(?:disclosed|specified|available|provided|sure)|n\/?a|none|null|undisclosed|-|\?+)$/i;

// The model name a probe reply claims (`{"model":"..."}`), or null when the
// model declined to say.
export function claimedModel(reply) {
  const name = String(reply || "").match(/"model"\s*:\s*"([^"]{1,80})"/)?.[1]?.trim();
  return name && !UNDISCLOSED.test(name) ? name : null;
}

const tally = (counts, name) => (name ? { ...counts, [name]: (counts[name] || 0) + 1 } : counts);

// A pooled alias (e.g. "srb/auto") answers each request from a different
// backend. Samples split on the vendor a model claims and, within a vendor,
// on hidden-prompt size (a 1.5× jump in prompt tokens for the same input).
// Unanswered or vendorless samples are left out: they carry no signal.
export function clusterBackends(samples) {
  const groups = [];
  for (const s of samples || []) {
    const vendor = s?.ok ? detectVendor(s.reply) : null;
    if (!vendor || typeof s.promptTokens !== "number") continue;
    const t = s.promptTokens;
    const g = groups.find((x) => x.vendor === vendor
      && Math.max(t, x.promptTokens.min) <= Math.min(t, x.promptTokens.min) * HIDDEN_PROMPT_RATIO);
    if (g) {
      g.count++;
      g.models = tally(g.models, claimedModel(s.reply));
      g.cutoffs = tally(g.cutoffs, claimedCutoff(s.reply));
      g.promptTokens = { min: Math.min(g.promptTokens.min, t), max: Math.max(g.promptTokens.max, t) };
    } else {
      groups.push({ vendor, count: 1, promptTokens: { min: t, max: t }, models: tally({}, claimedModel(s.reply)), cutoffs: tally({}, claimedCutoff(s.reply)), reply: s.reply });
    }
  }
  return groups.sort((a, b) => b.count - a.count);
}

// "GPT-5 ×2, undisclosed ×1": what each sample in a backend cluster said it was.
export function modelClaims(backend) {
  const named = Object.entries(backend.models || {});
  const unnamed = backend.count - named.reduce((n, [, c]) => n + c, 0);
  const parts = named.sort((a, b) => b[1] - a[1]).map(([m, c]) => `${m} ×${c}`);
  if (unnamed > 0) parts.push(`undisclosed ×${unnamed}`);
  return parts.join(", ");
}

function consistencyCheck(samples) {
  if (!samples || samples.length < 2) return null;
  const backends = clusterBackends(samples);
  const detail = backends.length
    ? backends.map((b) => `${b.vendor} ×${b.count} (${b.promptTokens.min}${b.promptTokens.max !== b.promptTokens.min ? `–${b.promptTokens.max}` : ""} tok)`).join(", ")
    : "no sample named a vendor";
  const pass = backends.length ? backends.length === 1 : null;
  return { id: "consistency", label: `Backend consistency (${samples.length} samples)`, pass, detail: pass === false ? `${backends.length} different backends: ${detail}` : detail };
}

export function judgeMask(probe, reference = null, samples = null) {
  // Router aliases like "srb/auto" name no vendor; then the upstream's echoed
  // model is the claim to verify, so only the identity check can judge it.
  const named = expectedVendor(probe.requested);
  const expected = named || expectedVendor(probe.returnedModel);
  const checks = [returnedCheck(probe, named), identityCheck(probe, expected), cutoffCheck(probe), tokenizerCheck(probe, reference), consistencyCheck(samples)].filter(Boolean);
  const fails = checks.filter((c) => c.pass === false);
  const passes = checks.filter((c) => c.pass === true);

  let verdict = "unknown";
  // A pool of backends behind one name is masking by definition.
  if (fails.some((c) => c.id === "tokenizer" || c.id === "consistency") || fails.length >= 2) verdict = "masked";
  else if (fails.length === 1) verdict = "suspicious";
  else if (passes.length) verdict = "genuine";

  return { verdict, expectedVendor: expected, checks };
}
