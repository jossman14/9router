/**
 * Structured request-event recorder.
 *
 * The console log buffer only keeps formatted strings (and truncates at 200
 * lines), which is fine for tailing but useless for aggregation. This module
 * keeps a larger ring of structured records so the console-log page can show
 * grouped counts, success/failure rates, top error reasons and where each
 * error came from (model server / RTK / Headroom / auth / network / combo).
 */

const MAX_EVENTS = Number(process.env.CONSOLE_EVENT_MAX) || 5000;

if (!global._consoleEventState) {
  global._consoleEventState = { events: [], seq: 0 };
}
const state = global._consoleEventState;
if (!Array.isArray(state.events)) state.events = [];

// Component that produced an event. This is the "source of the error".
export const COMPONENTS = {
  MODEL: "model",       // upstream model server / provider API
  RTK: "rtk",           // local tool-result compression
  HEADROOM: "headroom", // external compression proxy
  COMBO: "combo",       // combo routing / fallback chain
  AUTH: "auth",         // credential / account lock
  NETWORK: "network",   // socket / aborted / timeout at transport layer
  CLIENT: "client",     // caller aborted / malformed request
  SERVER: "server",     // 9router itself (db, internal)
  OTHER: "other",
};

const COMPONENT_LABELS = {
  model: "Model Server",
  rtk: "RTK (local compress)",
  headroom: "Headroom (proxy compress)",
  combo: "Combo / Fallback",
  auth: "Auth / Account",
  network: "Network / Transport",
  client: "Client",
  server: "9router Server",
  other: "Other",
};

export function componentLabel(id) {
  return COMPONENT_LABELS[id] || COMPONENT_LABELS.other;
}

/**
 * Map a raw log tag (as emitted by the logger) to an error/source component.
 */
export function tagToComponent(tag) {
  const t = String(tag || "").toLowerCase();
  if (t.includes("headroom")) return COMPONENTS.HEADROOM;
  if (t.includes("rtk") || t.includes("token-saver")) return COMPONENTS.RTK;
  if (t.includes("combo")) return COMPONENTS.COMBO;
  if (t.includes("fallback")) return COMPONENTS.COMBO;
  if (t.includes("auth") || t.includes("account")) return COMPONENTS.AUTH;
  if (t.includes("chat") || t.includes("request") || t.includes("response")) return COMPONENTS.MODEL;
  if (t.includes("db") || t.includes("usage")) return COMPONENTS.SERVER;
  return COMPONENTS.OTHER;
}

// Classify an error/warn message body into a component when the tag is generic.
const BODY_COMPONENT_RULES = [
  [/\b(headroom|v1\/compress|:8787)\b/i, COMPONENTS.HEADROOM],
  [/\brtk\b/i, COMPONENTS.RTK],
  [/\b(combo|fallback|sticky|trying model)\b/i, COMPONENTS.COMBO],
  [/\b(unauthorized|forbidden|401|403|api key|account locked|all \d+ accounts)\b/i, COMPONENTS.AUTH],
  [/\b(econnrefused|econnreset|socket|und_err|aborted|timeout|terminated|enotfound|eai_again|fetch failed)\b/i, COMPONENTS.NETWORK],
  [/\bconcurrent_limit|rate.?limit|429|too many requests\b/i, COMPONENTS.MODEL],
  [/\b(sqlite|database|db |migration)\b/i, COMPONENTS.SERVER],
];

export function classifyComponent(tag, message) {
  const byTag = tagToComponent(tag);
  if (byTag !== COMPONENTS.OTHER) return byTag;
  const msg = String(message || "");
  for (const [re, comp] of BODY_COMPONENT_RULES) {
    if (re.test(msg)) return comp;
  }
  return COMPONENTS.OTHER;
}

// Normalize a message into a stable "reason" key for top-N grouping.
export function normalizeReason(message, code) {
  const raw = String(message || "").split("\n")[0].trim();
  if (!raw) return code || "unknown";
  let s = raw
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/\b\d{4}-\d{2}-\d{2}[t ]\d{2}:\d{2}:\d{2}[.\d]*z?/gi, "<ts>")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "<date>")
    .replace(/\b\d+ms\b/g, "<n>ms")
    // Collapse standalone numbers but keep version/model tokens like kimi-k2.5.
    .replace(/(?<![\w.\-])\d+(?![\w.])/g, "<n>")
    .replace(/http:\/\/[^\s)]+/g, "<url>")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length > 160) s = s.slice(0, 160) + "…";
  return s;
}

/**
 * Record one structured event. Safe to call from hot paths: it only pushes to a
 * bounded array.
 */
export function recordEvent({
  level = "info",
  tag = "",
  provider = null,
  model = null,
  source = null,
  apiKey = null,
  phase = null,      // "start" | "done" | "error"
  status = null,     // "ok" | "error" | ...
  code = null,       // HTTP status or symbol
  message = "",
  ts = Date.now(),
} = {}) {
  const component = level === "error" || level === "warn"
    ? classifyComponent(tag, message)
    : tagToComponent(tag);

  const ev = {
    id: ++state.seq,
    ts,
    level,
    tag: tag || null,
    component,
    provider: provider || null,
    model: model || null,
    source: source || null,
    apiKey: apiKey || null,
    phase,
    status,
    code: code != null ? String(code) : null,
    reason: level === "error" || level === "warn" ? normalizeReason(message, code) : null,
    message: String(message || "").slice(0, 500),
  };

  state.events.push(ev);
  if (state.events.length > MAX_EVENTS) {
    state.events.splice(0, state.events.length - MAX_EVENTS);
  }
  return ev;
}

export function getEvents() {
  return state.events;
}

export function clearEvents() {
  state.events = [];
}
