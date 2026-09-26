// Logger utility for cloud

import { recordEvent } from "@/lib/consoleEventBuffer";

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const LEVEL = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase?.()] ?? LOG_LEVELS.INFO;

function formatTime() {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

// Colored-dot tags to correlate request lines by session (same session → same color)
const REQ_TAGS = ["🟢", "🔵", "🟣", "🟡", "🟠", "🔴", "⚪", "🟤"];
let tagCursor = 0;

// Allocate next rotating tag (fallback when no session seed available)
export function nextTag() {
  const tag = REQ_TAGS[tagCursor % REQ_TAGS.length];
  tagCursor++;
  return tag;
}

// Stable tag derived from a session/connection seed: same seed always maps to the same color
export function tagForSession(seed) {
  if (!seed) return nextTag();
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return REQ_TAGS[Math.abs(h) % REQ_TAGS.length];
}

// Print one correlated line: [time] tag symbol message
export function line(tag, symbol, message) {
  if (LEVEL > LOG_LEVELS.INFO) return;
  console.log(`[${formatTime()}] ${tag} ${symbol} ${message}`);
}

// Like line() but always printed regardless of LOG_LEVEL (errors must never be hidden)
export function errorLine(tag, symbol, message) {
  console.log(`[${formatTime()}] ${tag} ${symbol} ${message}`);
  try {
    const isError = symbol === "✗" || /\bERROR\b/.test(String(message));
    recordEvent({
      level: isError ? "error" : "warn",
      tag: "CHAT",
      message,
      phase: "error",
      status: "error",
      code: extractStatus(message),
    });
  } catch { /* recording must never break a request */ }
}

// Pull a numeric HTTP status out of an "ERROR 502 …" / "BLOCKED 400 …" line.
function extractStatus(message) {
  const m = String(message || "").match(/\b(?:ERROR|BLOCKED)\s+(\d{3})/);
  return m ? m[1] : null;
}

// Format thinking intent for the request line ("high(10k)" / "off" / "auto")
export function fmtThink(intent) {
  if (!intent || !intent.mode) return null;
  if (intent.mode === "none") return "off";
  if (intent.mode === "auto") return "auto";
  if (intent.mode === "budget") {
    const k = intent.budget >= 1000 ? `${Math.round(intent.budget / 1000)}k` : `${intent.budget}`;
    return k;
  }
  if (intent.mode === "level") return intent.level;
  return null;
}

function formatData(data) {
  if (!data) return "";
  if (typeof data === "string") return data;
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}

export function debug(tag, message, data) {
  if (LEVEL <= LOG_LEVELS.DEBUG) {
    const dataStr = data ? ` ${formatData(data)}` : "";
    console.log(`[${formatTime()}] 🔍 [${tag}] ${message}${dataStr}`);
  }
}

export function info(tag, message, data) {
  if (LEVEL <= LOG_LEVELS.INFO) {
    const dataStr = data ? ` ${formatData(data)}` : "";
    console.log(`[${formatTime()}] ℹ️  [${tag}] ${message}${dataStr}`);
  }
}

// HEADROOM warns are emitted with source context directly from chatCore, so
// recording them here too would double-count. COMBO has no source context at
// its call sites, so it is still recorded generically (grouped by component).
const EVENT_TAG_EXCLUDES = new Set(["HEADROOM"]);

export function warn(tag, message, data) {
  if (LEVEL <= LOG_LEVELS.WARN) {
    const dataStr = data ? ` ${formatData(data)}` : "";
    console.warn(`[${formatTime()}] ⚠️  [${tag}] ${message}${dataStr}`);
    if (!EVENT_TAG_EXCLUDES.has(tag)) {
      try {
        recordEvent({ level: "warn", tag, message, phase: "warn", status: "warn" });
      } catch { /* never break a request */ }
    }
  }
}

export function error(tag, message, data) {
  if (LEVEL <= LOG_LEVELS.ERROR) {
    const dataStr = data ? ` ${formatData(data)}` : "";
    console.log(`[${formatTime()}] ❌ [${tag}] ${message}${dataStr}`);
    try {
      recordEvent({ level: "error", tag, message, phase: "error", status: "error" });
    } catch { /* never break a request */ }
  }
}

export function request(method, path, extra) {
  const dataStr = extra ? ` ${formatData(extra)}` : "";
  console.log(`\x1b[36m[${formatTime()}] 📥 ${method} ${path}${dataStr}\x1b[0m`);
}

export function response(status, duration, extra) {
  const icon = status < 400 ? "📤" : "💥";
  const dataStr = extra ? ` ${formatData(extra)}` : "";
  console.log(`[${formatTime()}] ${icon} ${status} (${duration}ms)${dataStr}`);
}

export function stream(event, data) {
  const dataStr = data ? ` ${formatData(data)}` : "";
  console.log(`[${formatTime()}] 🌊 [STREAM] ${event}${dataStr}`);
}

// Mask sensitive data
export function maskKey(key) {
  if (!key || key.length < 8) return "***";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}
