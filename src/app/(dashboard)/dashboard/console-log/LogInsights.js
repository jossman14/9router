"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/shared/components";

const WINDOWS = [
  { value: "15m", label: "15m" },
  { value: "1h", label: "1h" },
  { value: "6h", label: "6h" },
  { value: "24h", label: "24h" },
  { value: "all", label: "All" },
];

const GROUPINGS = [
  { value: "byProvider", label: "Provider" },
  { value: "bySource", label: "Source (IP)" },
  { value: "byModel", label: "Model" },
  { value: "byComponent", label: "Error Source" },
];

const COMPONENT_META = {
  model: { label: "Model Server", icon: "cloud", chip: "bg-primary/10 text-primary border-primary/25" },
  rtk: { label: "RTK (local)", icon: "compress", chip: "bg-info/10 text-info border-info/25" },
  headroom: { label: "Headroom", icon: "memory", chip: "bg-warning/10 text-warning border-warning/25" },
  combo: { label: "Combo/Fallback", icon: "alt_route", chip: "bg-purple-500/10 text-purple-400 border-purple-500/25" },
  auth: { label: "Auth/Account", icon: "key", chip: "bg-danger/10 text-danger border-danger/25" },
  network: { label: "Network", icon: "wifi_off", chip: "bg-orange-500/10 text-orange-400 border-orange-500/25" },
  client: { label: "Client", icon: "person", chip: "bg-surface-2 text-text-muted border-border" },
  server: { label: "9router Server", icon: "dns", chip: "bg-success/10 text-success border-success/25" },
  other: { label: "Other", icon: "help", chip: "bg-surface-2 text-text-muted border-border" },
};

const SOURCE_TYPE_META = {
  local: { icon: "computer", chip: "bg-surface-2 text-text-muted border-border" },
  private: { icon: "lan", chip: "bg-info/10 text-info border-info/25" },
  public: { icon: "public", chip: "bg-warning/10 text-warning border-warning/25" },
};

function componentMeta(id) {
  return COMPONENT_META[id] || COMPONENT_META.other;
}

function RateBar({ value, tone }) {
  const pct = Math.max(0, Math.min(100, value || 0));
  const color = tone === "ok" ? "bg-success" : tone === "err" ? "bg-danger" : "bg-primary";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3/60">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatPill({ icon, label, value, tone }) {
  const tones = {
    ok: "text-success",
    err: "text-danger",
    warn: "text-warning",
    neutral: "text-text-muted",
  };
  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      <span className={`material-symbols-outlined text-[14px] ${tones[tone] || tones.neutral}`}>{icon}</span>
      <span className="text-text-subtle">{label}</span>
      <span className="font-mono font-semibold tabular-nums text-text-main">{value}</span>
    </div>
  );
}

function GroupCard({ row, grouping }) {
  const [open, setOpen] = useState(false);
  const key = row.key;
  const meta = grouping === "byComponent" ? componentMeta(row.key) : null;
  const srcMeta = grouping === "bySource" ? (SOURCE_TYPE_META[row.sourceType] || SOURCE_TYPE_META.local) : null;

  return (
    <div className="rounded-xl border border-border/60 bg-surface px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-2">
            {meta && <span className={`material-symbols-outlined text-[15px] ${meta.chip.split(" ")[1]}`}>{meta.icon}</span>}
            {srcMeta && <span className={`material-symbols-outlined text-[15px] ${srcMeta.chip.split(" ")[1]}`}>{srcMeta.icon}</span>}
            <span className="truncate font-mono text-sm font-medium text-text-main" title={row.key}>{key}</span>
            {grouping === "bySource" && row.sourceLabel && (
              <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${srcMeta.chip}`}>{row.sourceLabel}</span>
            )}
            {grouping === "byModel" && row.model && (
              <span className="hidden shrink-0 rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] text-text-muted sm:inline">{row.model}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatPill icon="bolt" label="req" value={row.requests} tone="neutral" />
            <StatPill icon="check_circle" label="ok" value={row.ok} tone="ok" />
            <StatPill icon="error" label="err" value={row.error} tone="err" />
            {row.warn > 0 && <StatPill icon="warning" label="warn" value={row.warn} tone="warn" />}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-mono text-sm font-bold tabular-nums text-success">{row.successRate}%</span>
          <span className="text-[10px] uppercase tracking-wide text-text-subtle">success</span>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="flex-1">
          <RateBar value={row.successRate} tone="ok" />
        </div>
        {row.error > 0 && (
          <>
            <div className="flex-1">
              <RateBar value={row.failureRate} tone="err" />
            </div>
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex shrink-0 items-center gap-0.5 rounded-md border border-border px-1.5 py-0.5 text-[10px] text-text-muted hover:bg-bg-alt"
            >
              <span className="material-symbols-outlined text-[13px]">{open ? "expand_less" : "expand_more"}</span>
              top errors
            </button>
          </>
        )}
      </div>

      {open && row.topErrors?.length > 0 && (
        <div className="mt-2 flex flex-col gap-1 border-t border-border/50 pt-2">
          {row.topErrors.map((err, i) => {
            const cm = componentMeta(err.component);
            return (
              <div key={i} className="flex items-start gap-2 text-[11px]">
                <span className="mt-0.5 shrink-0 font-mono text-text-subtle">{i + 1}.</span>
                <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] ${cm.chip}`}>{cm.label}</span>
                <span className="min-w-0 flex-1 break-words text-text-muted" title={err.reason}>{err.reason}</span>
                <span className="shrink-0 font-mono font-semibold text-danger">{err.count}×</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function LogInsights() {
  const [win, setWin] = useState("all");
  const [grouping, setGrouping] = useState("byProvider");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const load = (signal) =>
    fetch(`/api/translator/console-logs/insights?window=${win}`, { signal })
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) throw new Error(json.error || "failed");
        setData(json);
        setErr(null);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setErr(e.message);
          setLoading(false);
        }
      });

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    const t = setInterval(() => load(), 10000);
    return () => { ac.abort(); clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win]);

  const rows = useMemo(() => (data?.[grouping] || []).slice(0, 30), [data, grouping]);
  const totals = data?.totals;

  return (
    <div className="flex flex-col gap-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-bg-alt p-1">
          {WINDOWS.map((w) => (
            <button
              key={w.value}
              onClick={() => setWin(w.value)}
              className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition-colors ${win === w.value ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-text hover:bg-bg-alt"}`}
            >
              {w.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-bg-alt p-1">
          {GROUPINGS.map((g) => (
            <button
              key={g.value}
              onClick={() => setGrouping(g.value)}
              className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition-colors ${grouping === g.value ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-text hover:bg-bg-alt"}`}
            >
              {g.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[11px] text-text-subtle">
          {loading ? "memuat…" : `auto-refresh 10s · ${totals?.events ?? 0} events`}
        </span>
      </div>

      {err && <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">Gagal memuat insights: {err}</div>}

      {/* Totals */}
      {totals && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          <Card className="flex flex-col gap-1 px-3.5 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Requests</span>
            <span className="font-mono text-xl font-bold text-text-main">{totals.requests}</span>
          </Card>
          <Card className="flex flex-col gap-1 px-3.5 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Berhasil</span>
            <span className="font-mono text-xl font-bold text-success">{totals.done}</span>
            <RateBar value={totals.successRate} tone="ok" />
            <span className="text-[10px] text-text-subtle">{totals.successRate}% sukses</span>
          </Card>
          <Card className="flex flex-col gap-1 px-3.5 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Gagal</span>
            <span className="font-mono text-xl font-bold text-danger">{totals.error}</span>
            <RateBar value={totals.failureRate} tone="err" />
            <span className="text-[10px] text-text-subtle">{totals.failureRate}% gagal</span>
          </Card>
          <Card className="flex flex-col gap-1 px-3.5 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Warning</span>
            <span className="font-mono text-xl font-bold text-warning">{totals.warn}</span>
          </Card>
          <Card className="flex flex-col gap-1 px-3.5 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Finished</span>
            <span className="font-mono text-xl font-bold text-text-main">{totals.finished}</span>
            <span className="text-[10px] text-text-subtle">ok + error</span>
          </Card>
        </div>
      )}

      {/* Top-5 error reasons globally, with origin */}
      {data?.topErrors?.length > 0 && (
        <Card className="flex flex-col gap-2 p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-danger">report</span>
            <span className="text-sm font-semibold uppercase tracking-wide text-text-muted">Top 5 Error + Sumbernya</span>
          </div>
          <div className="flex flex-col gap-2">
            {data.topErrors.map((e, i) => {
              const cm = componentMeta(e.component);
              return (
                <div key={i} className="flex flex-col gap-1 rounded-xl border border-border/60 bg-surface px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="shrink-0 rounded-lg bg-danger/10 px-2 py-0.5 font-mono text-sm font-bold text-danger">{e.count}×</span>
                    <span className="truncate text-[12px] text-text-main" title={e.reason}>{e.reason}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${cm.chip}`}>
                      <span className="material-symbols-outlined text-[13px]">{cm.icon}</span>
                      {cm.label}
                    </span>
                    {e.providersCount > 0 && (
                      <span className="text-[10px] text-text-subtle" title={e.providers.join(", ")}>
                        {e.providersCount} provider{e.providersCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Grouped breakdown */}
      <div className="flex flex-col gap-2">
        {rows.length === 0 && !loading && (
          <div className="rounded-xl border border-border/60 bg-surface px-3 py-6 text-center text-sm text-text-muted">
            Belum ada event. Jalankan beberapa request agar statistik terkumpul.
          </div>
        )}
        {rows.map((row) => (
          <GroupCard key={row.key} row={row} grouping={grouping} />
        ))}
      </div>
    </div>
  );
}
