"use client";

import { useEffect, useState } from "react";
import { Card, Badge } from "@/shared/components";
import { expectedVendor } from "@/lib/modelMask.js";

// match: same vendor as requested · routed: alias (auto/combo) with no vendor
// in its name · mismatch: requested one vendor, a different one answered.
function classify(model, served) {
  const want = expectedVendor(model);
  const got = expectedVendor(served);
  if (!want) return { label: "routed", variant: "info" };
  if (!got || want === got) return { label: "match", variant: "success" };
  return { label: "mismatch", variant: "error" };
}

export default function ServedModels({ period }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/usage/served-models?period=${period}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setItems(d.items || []); setError(d.error || null); } })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [period]);

  return (
    <Card padding="md">
      <h2 className="text-sm font-semibold text-text-main">Served models</h2>
      <p className="text-xs text-text-muted mt-0.5">
        The model each provider says actually answered — useful for <code>auto</code> and combo aliases.
        Only requests made after this was enabled are recorded.
      </p>

      {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
      {!error && items === null && <p className="text-xs text-text-muted mt-3">Loading…</p>}
      {items?.length === 0 && <p className="text-xs text-text-muted mt-3">No requests with a reported model in this period.</p>}

      {items?.length > 0 && (
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-xs">
            <thead className="text-text-muted text-left">
              <tr>
                <th className="py-1.5 pr-3 font-medium">Provider</th>
                <th className="py-1.5 pr-3 font-medium">Requested</th>
                <th className="py-1.5 pr-3 font-medium">Served</th>
                <th className="py-1.5 pr-3 font-medium text-right">Requests</th>
                <th className="py-1.5 pr-3 font-medium text-right">Tokens</th>
                <th className="py-1.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => {
                const c = classify(r.model, r.servedModel);
                return (
                  <tr key={`${r.connectionId}|${r.provider}|${r.model}|${r.servedModel}`} className="border-t border-border-subtle">
                    <td className="py-1.5 pr-3 text-text-main">{r.providerName}</td>
                    <td className="py-1.5 pr-3 font-mono">{r.model}</td>
                    <td className="py-1.5 pr-3 font-mono text-text-main">{r.servedModel}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{r.requests.toLocaleString()}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{r.totalTokens.toLocaleString()}</td>
                    <td className="py-1.5"><Badge variant={c.variant} size="sm">{c.label}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
