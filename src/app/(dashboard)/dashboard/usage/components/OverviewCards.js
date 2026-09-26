"use client";

import PropTypes from "prop-types";
import Card from "@/shared/components/Card";
import { useUsdIdr } from "@/shared/hooks/useUsdIdr";

const fmt = (n) => new Intl.NumberFormat().format(Math.round(n || 0));

const fmtCompact = (n) => {
  const v = n || 0;
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(Math.round(v));
};

const fmtCost = (n) => {
  const v = n || 0;
  if (v === 0) return "$0.00";
  if (v < 0.01) return `$${v.toFixed(4)}`;
  if (v < 1) return `$${v.toFixed(3)}`;
  return `$${v.toFixed(2)}`;
};

function MetricCard({ icon, iconClass, label, value, hint, sub, accent }) {
  return (
    <Card className="group relative flex min-w-0 flex-col gap-2 overflow-hidden px-3.5 py-3 transition-colors hover:border-border">
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-[0.07] blur-xl transition-opacity group-hover:opacity-[0.14]"
        style={{ backgroundColor: accent }}
      />
      <div className="flex items-center gap-2">
        <span
          className={`material-symbols-outlined text-[18px] ${iconClass}`}
          style={{ color: accent }}
        >
          {icon}
        </span>
        <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-text-muted">{label}</span>
      </div>
      <span className="w-full truncate font-mono text-xl font-bold tabular-nums text-text-main" title={fmt(value)}>
        {value}
      </span>
      {sub && <span className="w-full truncate font-mono text-sm font-semibold text-text-muted">{sub}</span>}
      {hint && <span className="text-[10px] leading-tight text-text-subtle">{hint}</span>}
    </Card>
  );
}

MetricCard.propTypes = {
  icon: PropTypes.string.isRequired,
  iconClass: PropTypes.string,
  label: PropTypes.string.isRequired,
  value: PropTypes.node.isRequired,
  hint: PropTypes.string,
  sub: PropTypes.node,
  accent: PropTypes.string,
};

export default function OverviewCards({ stats }) {
  const { rate, source, updatedAt, fmtIdr } = useUsdIdr();
  const totalTokens =
    (stats.totalPromptTokens || 0) + (stats.totalCompletionTokens || 0);
  const cachedShare = stats.totalPromptTokens > 0
    ? Math.round((stats.totalCachedTokens / stats.totalPromptTokens) * 100)
    : 0;
  const avgCost = stats.totalRequests > 0 ? stats.totalCost / stats.totalRequests : 0;
  const rateHint = rate > 0
    ? `Rp${new Intl.NumberFormat("id-ID").format(rate)}/USD · ${updatedAt ? new Date(updatedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-"}${source ? ` (${source})` : ""}`
    : "memuat kurs…";

  return (
    <div className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
      <MetricCard
        icon="bolt"
        label="Requests"
        accent="#3B76F6"
        value={fmt(stats.totalRequests)}
        hint={`${fmt(stats.totalRequests)} total calls`}
      />
      <MetricCard
        icon="toll"
        label="Total Tokens"
        accent="#3B76F6"
        value={fmtCompact(totalTokens)}
        hint={`${fmt(totalTokens)} tokens`}
      />
      <MetricCard
        icon="south_west"
        label="Input"
        accent="#6366f1"
        value={fmtCompact(stats.totalPromptTokens)}
        hint={`${fmt(stats.totalPromptTokens)} tokens`}
      />
      <MetricCard
        icon="bolt_boost"
        label="Cached"
        accent="#06b6d4"
        value={fmtCompact(stats.totalCachedTokens)}
        hint={`${cachedShare}% of input hit cache`}
      />
      <MetricCard
        icon="north_east"
        label="Output"
        accent="#10b981"
        value={fmtCompact(stats.totalCompletionTokens)}
        hint={`${fmt(stats.totalCompletionTokens)} tokens`}
      />
      <MetricCard
        icon="payments"
        label="Est. Cost"
        accent="#f59e0b"
        value={fmtCost(stats.totalCost)}
        sub={fmtIdr(stats.totalCost)}
        hint={`~${fmtCost(avgCost)} / req · ${rateHint}`}
      />
    </div>
  );
}

OverviewCards.propTypes = {
  stats: PropTypes.object.isRequired,
};
