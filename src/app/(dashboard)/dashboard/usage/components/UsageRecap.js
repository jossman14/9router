"use client";

import PropTypes from "prop-types";
import Card from "@/shared/components/Card";
import { buildUsageBreakdown } from "@/shared/utils/usagePresentation";

const GROUPS = [
  { key: "endpoints", label: "Endpoint sumber", icon: "link" },
  { key: "apiKeys", label: "API key", icon: "key" },
  { key: "providers", label: "Provider tujuan", icon: "cloud" },
  { key: "models", label: "Model", icon: "smart_toy" },
  { key: "accounts", label: "Account", icon: "account_circle" },
  { key: "sources", label: "Asal request", icon: "public" },
];

const fmt = (value) => new Intl.NumberFormat("id-ID").format(value || 0);

function UsageSourceList({ title, icon, items, totalRequests }) {
  const visible = items.slice(0, 5);

  return (
    <div className="min-w-0 rounded-xl border border-border bg-bg-subtle/35 p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px] text-primary">{icon}</span>
        <h3 className="truncate text-sm font-semibold text-text-main">{title}</h3>
      </div>
      <div className="space-y-2.5">
        {visible.length === 0 ? (
          <div className="py-5 text-center text-xs text-text-muted">Belum ada data</div>
        ) : visible.map((item) => {
          const percentage = totalRequests > 0 ? Math.min(100, (item.requests / totalRequests) * 100) : 0;
          return (
            <div key={`${item.label}-${item.detail}`} className="min-w-0">
              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <div className="truncate font-medium text-text-main" title={item.label}>{item.label}</div>
                  {item.detail && <div className="truncate text-[10px] text-text-muted" title={item.detail}>{item.detail}</div>}
                </div>
                <span className="shrink-0 font-mono font-semibold text-text-main">{fmt(item.requests)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-border/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400 transition-[width] duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

UsageSourceList.propTypes = {
  title: PropTypes.string.isRequired,
  icon: PropTypes.string.isRequired,
  items: PropTypes.array.isRequired,
  totalRequests: PropTypes.number.isRequired,
};

export default function UsageRecap({ stats }) {
  const breakdown = buildUsageBreakdown(stats);
  const totalRequests = stats.totalRequests || 0;
  const sourceCount = breakdown.sources.length;

  return (
    <Card className="overflow-hidden p-3 sm:p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">account_tree</span>
            <h2 className="text-base font-bold text-text-main">Rekap alur request</h2>
          </div>
          <p className="text-xs text-text-muted">Sumber request → 9Router → provider, model, dan account tujuan.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right">
          <div className="rounded-lg border border-border bg-bg-subtle px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-text-muted">Request</div>
            <div className="font-mono text-lg font-bold text-text-main">{fmt(totalRequests)}</div>
          </div>
          <div className="rounded-lg border border-border bg-bg-subtle px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-text-muted">Sumber</div>
            <div className="font-mono text-lg font-bold text-text-main">{fmt(sourceCount)}</div>
          </div>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {GROUPS.map((group) => (
          <UsageSourceList
            key={group.key}
            title={group.label}
            icon={group.icon}
            items={breakdown[group.key]}
            totalRequests={totalRequests}
          />
        ))}
      </div>
    </Card>
  );
}
