"use client";

import { useEffect, useState } from "react";

// Shared USD→IDR rate. Fetched once per mount, cached module-wide so multiple
// components (OverviewCards, SourceBreakdown, …) don't hammer the endpoint.
let cached = null;
let inflight = null;

async function loadRate() {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = fetch("/api/currency/usd-idr")
    .then((r) => r.json())
    .then((j) => {
      if (j?.success && Number.isFinite(j.rate)) {
        cached = { rate: j.rate, source: j.source, updatedAt: j.updatedAt };
      }
      return cached;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useUsdIdr() {
  const [state, setState] = useState(cached || { rate: 0, source: null, updatedAt: 0 });

  useEffect(() => {
    let alive = true;
    loadRate().then((r) => {
      if (alive && r) setState(r);
    });
    return () => {
      alive = false;
    };
  }, []);

  const toIdr = (usd) => (Number.isFinite(state.rate) && state.rate > 0 ? (usd || 0) * state.rate : 0);

  const fmtIdr = (usd) => {
    const v = toIdr(usd);
    if (v === 0) return "Rp0";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(Math.round(v));
  };

  return { rate: state.rate, source: state.source, updatedAt: state.updatedAt, toIdr, fmtIdr };
}
