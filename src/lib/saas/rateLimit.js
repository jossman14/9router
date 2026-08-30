// Per-key sliding-window request limiter. In-memory: resets on restart and is
// per-process.
// ponytail: single-process ceiling. Move to Redis INCR+EXPIRE only when you
// actually run more than one node.
const windows = new Map(); // id → number[] (ms timestamps)
const WINDOW_MS = 60_000;

export function checkRate(id, rpm) {
  if (!rpm) return { ok: true };
  const now = Date.now();
  const hits = (windows.get(id) || []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= rpm) {
    return { ok: false, retryAfter: Math.ceil((WINDOW_MS - (now - hits[0])) / 1000) };
  }
  hits.push(now);
  windows.set(id, hits);
  return { ok: true };
}

// Drop cold buckets so a long-lived process doesn't grow unbounded.
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [id, hits] of windows) {
    if (!hits.some((t) => t > cutoff)) windows.delete(id);
  }
}, WINDOW_MS).unref?.();
