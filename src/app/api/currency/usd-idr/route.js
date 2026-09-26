import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// USD → IDR exchange rate with caching. Free, no-key sources; first one that
// answers wins. The rate refreshes at most every 30 minutes (or on demand via
// ?force=1). Falls back to the last known good value, then a sane default, so
// the UI never shows a broken number.
const CACHE_TTL_MS = 30 * 60 * 1000;
const DEFAULT_RATE = 16000;

const SOURCES = [
  {
    name: "open.er-api.com",
    url: "https://open.er-api.com/v6/latest/USD",
    pick: (j) => j?.rates?.IDR,
  },
  {
    name: "frankfurter.dev",
    url: "https://api.frankfurter.dev/v1/latest?base=USD&symbols=IDR",
    pick: (j) => j?.rates?.IDR,
  },
  {
    name: "exchangerate.host",
    url: "https://api.exchangerate.host/latest?base=USD&symbols=IDR",
    pick: (j) => j?.rates?.IDR,
  },
];

if (!global._idrRateCache) {
  global._idrRateCache = { rate: DEFAULT_RATE, at: 0, source: "default" };
}
const cache = global._idrRateCache;

async function fetchRate() {
  for (const src of SOURCES) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(src.url, { signal: ctrl.signal, cache: "no-store" });
      clearTimeout(t);
      if (!res.ok) continue;
      const json = await res.json();
      const rate = Number(src.pick(json));
      if (Number.isFinite(rate) && rate > 1000 && rate < 100000) {
        return { rate, source: src.name };
      }
    } catch {
      // try next source
    }
  }
  return null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "1";
  const fresh = Date.now() - cache.at < CACHE_TTL_MS;

  if (!force && fresh && cache.at > 0) {
    return NextResponse.json({
      success: true,
      base: "USD",
      quote: "IDR",
      rate: cache.rate,
      source: cache.source,
      updatedAt: cache.at,
      cached: true,
    });
  }

  const result = await fetchRate();
  if (result) {
    cache.rate = result.rate;
    cache.source = result.source;
    cache.at = Date.now();
  } else if (cache.at === 0) {
    // Never had a good rate: keep the default but mark it.
    cache.at = Date.now();
    cache.source = "default";
  }

  return NextResponse.json({
    success: true,
    base: "USD",
    quote: "IDR",
    rate: cache.rate,
    source: cache.source,
    updatedAt: cache.at,
    cached: false,
    stale: !result && cache.at > 0,
  });
}
