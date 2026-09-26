"use client";

import { useState, useMemo } from "react";
import PropTypes from "prop-types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import Card from "@/shared/components/Card";
import { useUsdIdr } from "@/shared/hooks/useUsdIdr";

const COLORS = ["#3B76F6", "#14b8a6", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#10b981", "#f97316"];

const fmtTokens = (n) => {
  const v = n || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
};

const fmtCost = (n) => {
  const v = n || 0;
  if (v === 0) return "$0.00";
  if (v < 0.01) return `$${v.toFixed(4)}`;
  if (v < 1) return `$${v.toFixed(3)}`;
  return `$${v.toFixed(2)}`;
};

// Normalize a raw source (IPv4 / ::ffff: IPv4 / "local") to a short display label.
function shortIp(source) {
  if (!source || source === "local") return "local";
  return source.startsWith("::ffff:") ? source.slice(7) : source;
}

const TYPE_META = {
  local: { icon: "computer", tint: "text-text-muted", chip: "bg-surface-2 text-text-muted border-border" },
  private: { icon: "lan", tint: "text-info", chip: "bg-info/10 text-info border-info/25" },
  public: { icon: "public", tint: "text-warning", chip: "bg-warning/10 text-warning border-warning/25" },
};

function SourceRow({ entry, maxTokens, index, fmtIdr }) {
  const meta = TYPE_META[entry.type] || TYPE_META.local;
  const tokens = entry.tokens || 0;
  const pct = maxTokens > 0 ? Math.max(2, Math.round((tokens / maxTokens) * 100)) : 0;
  const cachedShare = entry.promptTokens > 0 ? Math.min(100, Math.round((entry.cachedTokens / entry.promptTokens) * 100)) : 0;

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-surface px-3 py-2.5 transition-colors hover:border-border hover:bg-surface-2/60">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`material-symbols-outlined text-[16px] ${meta.tint}`}>{meta.icon}</span>
          <span className="truncate font-mono text-sm font-medium text-text-main" title={entry.source}>
            {entry.ip}
          </span>
          <span className={`hidden shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:inline ${meta.chip}`}>
            {entry.label}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className="font-mono text-sm font-semibold tabular-nums text-text-main">{fmtCost(entry.cost)}</span>
          {fmtIdr && <span className="font-mono text-[11px] tabular-nums text-text-subtle">{fmtIdr(entry.cost)}</span>}
        </div>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3/60">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: COLORS[index % COLORS.length] }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted">
        <span title="Requests">{new Intl.NumberFormat().format(entry.requests || 0)} req</span>
        <span title="Input tokens">↑ {fmtTokens(entry.promptTokens)}</span>
        <span className="text-info" title={`Cached tokens (${cachedShare}% of input)`}>⚡ {fmtTokens(entry.cachedTokens)}</span>
        <span className="text-success" title="Output tokens">↓ {fmtTokens(entry.completionTokens)}</span>
      </div>
    </div>
  );
}

SourceRow.propTypes = {
  entry: PropTypes.object.isRequired,
  maxTokens: PropTypes.number.isRequired,
  index: PropTypes.number.isRequired,
  fmtIdr: PropTypes.func,
};

/**
 * Per-source (client IP) usage: tokens and cost, split into input/cached/output.
 * Data comes from getUsageStats().bySource.
 */
export default function SourceBreakdown({ bySource }) {
  const [metric, setMetric] = useState("cost");
  const { rate, fmtIdr } = useUsdIdr();

  const entries = useMemo(() => {
    return Object.values(bySource || {})
      .map((d) => ({
        source: d.source,
        ip: shortIp(d.source),
        label: d.sourceLabel || "Local",
        type: d.sourceType || "local",
        requests: d.requests || 0,
        promptTokens: d.promptTokens || 0,
        cachedTokens: d.cachedTokens || 0,
        completionTokens: d.completionTokens || 0,
        tokens: (d.promptTokens || 0) + (d.completionTokens || 0),
        cost: d.cost || 0,
        inputCost: d.inputCost || 0,
        cachedCost: d.cachedCost || 0,
        outputCost: d.outputCost || 0,
      }))
      .filter((d) => d.tokens > 0 || d.requests > 0)
      .sort((a, b) => (metric === "cost" ? b.cost - a.cost : b.tokens - a.tokens));
  }, [bySource, metric]);

  const totals = useMemo(() => {
    return entries.reduce(
      (acc, e) => ({
        tokens: acc.tokens + e.tokens,
        cost: acc.cost + e.cost,
        requests: acc.requests + e.requests,
        inputCost: acc.inputCost + e.inputCost,
        cachedCost: acc.cachedCost + e.cachedCost,
        outputCost: acc.outputCost + e.outputCost,
      }),
      { tokens: 0, cost: 0, requests: 0, inputCost: 0, cachedCost: 0, outputCost: 0 }
    );
  }, [entries]);

  const chartData = useMemo(
    () => entries.slice(0, 8).map((e) => ({ name: e.ip, tokens: e.tokens, cost: e.cost })),
    [entries]
  );

  const maxTokens = chartData.length ? Math.max(...chartData.map((d) => d.tokens)) : 0;
  const isCost = metric === "cost";

  return (
    <Card className="flex min-w-0 flex-col gap-4 p-3 sm:p-4">
      <div className="flex flex-row items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-sm font-semibold uppercase tracking-wide text-text-muted">Usage by Source</span>
          <span className="text-xs text-text-subtle">
            {entries.length} IP{entries.length === 1 ? "" : "s"} · {new Intl.NumberFormat().format(totals.requests)} requests
          </span>
        </div>
        <div className="grid grid-cols-2 items-center gap-1 rounded-lg border border-border bg-bg-subtle p-1">
          <button
            onClick={() => setMetric("cost")}
            className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition-colors ${isCost ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-text hover:bg-bg-hover"}`}
          >
            Cost
          </button>
          <button
            onClick={() => setMetric("tokens")}
            className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition-colors ${!isCost ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-text hover:bg-bg-hover"}`}
          >
            Tokens
          </button>
        </div>
      </div>

      {!entries.length ? (
        <div className="flex h-44 items-center justify-center text-sm text-text-muted">No source usage yet</div>
      ) : (
        <>
          {/* Totals strip with token-cost split */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-border/60 bg-surface-2/50 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-text-subtle">Total</div>
              <div className="font-mono text-base font-bold text-text-main">{isCost ? fmtCost(totals.cost) : fmtTokens(totals.tokens)}</div>
              {isCost && rate > 0 && <div className="font-mono text-[11px] text-text-subtle">{fmtIdr(totals.cost)}</div>}
            </div>
            <div className="rounded-xl border border-border/60 bg-surface-2/50 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-text-subtle">Input</div>
              <div className="font-mono text-base font-bold text-primary">{isCost ? fmtCost(totals.inputCost) : fmtTokens(entries.reduce((s, e) => s + Math.max(0, e.promptTokens - e.cachedTokens), 0))}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-surface-2/50 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-text-subtle">Cached</div>
              <div className="font-mono text-base font-bold text-info">{isCost ? fmtCost(totals.cachedCost) : fmtTokens(entries.reduce((s, e) => s + e.cachedTokens, 0))}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-surface-2/50 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-text-subtle">Output</div>
              <div className="font-mono text-base font-bold text-success">{isCost ? fmtCost(totals.outputCost) : fmtTokens(entries.reduce((s, e) => s + e.completionTokens, 0))}</div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "currentColor", fillOpacity: 0.6 }}
                tickLine={false}
                axisLine={false}
                interval={0}
                tickFormatter={(v) => (v.length > 12 ? v.slice(0, 12) + "…" : v)}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "currentColor", fillOpacity: 0.5 }}
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={isCost ? (v) => fmtCost(v) : fmtTokens}
              />
              <Tooltip
                cursor={{ fill: "currentColor", fillOpacity: 0.04 }}
                contentStyle={{
                  backgroundColor: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value) => [isCost ? fmtCost(value) : fmtTokens(value), isCost ? "Cost" : "Tokens"]}
              />
              <Bar dataKey={isCost ? "cost" : "tokens"} radius={[4, 4, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Detailed per-IP list */}
          <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-0.5">
            {entries.map((entry, i) => (
              <SourceRow key={entry.source} entry={entry} maxTokens={maxTokens} index={i} fmtIdr={isCost ? fmtIdr : null} />
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

SourceBreakdown.propTypes = {
  bySource: PropTypes.object,
};
