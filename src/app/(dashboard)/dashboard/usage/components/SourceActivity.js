"use client";

import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import Card from "@/shared/components/Card";

const fmtTokens = (n) => {
  const v = n || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
};

const wibTime = (iso) => (iso
  ? new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(iso))
  : "—");

const TOOLTIP_STYLE = {
  backgroundColor: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  borderRadius: "8px",
  fontSize: "12px",
};

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface-2/50 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-text-subtle">{label}</div>
      <div className="font-mono text-base font-bold text-text-main">{value}</div>
      {sub && <div className="text-[11px] text-text-subtle">{sub}</div>}
    </div>
  );
}

Stat.propTypes = { label: PropTypes.string, value: PropTypes.node, sub: PropTypes.node };

function Bars({ data, xKey, metric, height = 180, tickFormatter }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: "currentColor", fillOpacity: 0.6 }} tickLine={false} axisLine={false}
          minTickGap={12} tickFormatter={tickFormatter} />
        <YAxis tick={{ fontSize: 10, fill: "currentColor", fillOpacity: 0.5 }} tickLine={false} axisLine={false} width={48}
          tickFormatter={metric === "tokens" ? fmtTokens : undefined} allowDecimals={false} />
        <Tooltip cursor={{ fill: "currentColor", fillOpacity: 0.04 }} contentStyle={TOOLTIP_STYLE}
          labelFormatter={tickFormatter}
          formatter={(v) => [metric === "tokens" ? fmtTokens(v) : v, metric === "tokens" ? "Tokens" : "Requests"]} />
        <Bar dataKey={metric} fill="#3B76F6" fillOpacity={0.85} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

Bars.propTypes = {
  data: PropTypes.array.isRequired, xKey: PropTypes.string.isRequired, metric: PropTypes.string.isRequired,
  height: PropTypes.number, tickFormatter: PropTypes.func,
};

// City-level guess from an IP database: a radius of tens of km, often the ISP's
// hub rather than the caller. The bbox pads the pin so the map shows that.
const MAP_PAD_DEG = 0.6;

function GeoCard({ geo, type }) {
  if (!geo) {
    return (
      <div className="rounded-xl border border-border/60 bg-surface-2/50 px-3 py-2 text-xs text-text-muted">
        {type === "public" ? "Lokasi belum tersedia." : "Alamat lokal/privat — tidak punya lokasi publik."}
      </div>
    );
  }
  if (geo.error) {
    return <div className="rounded-xl border border-border/60 bg-surface-2/50 px-3 py-2 text-xs text-warning">Lokasi gagal dimuat: {geo.error}</div>;
  }
  const place = [geo.city, geo.region, geo.country].filter(Boolean).join(", ") || "Tidak diketahui";
  const hasPin = geo.lat !== null && geo.lon !== null;
  const bbox = hasPin
    ? [geo.lon - MAP_PAD_DEG, geo.lat - MAP_PAD_DEG / 2, geo.lon + MAP_PAD_DEG, geo.lat + MAP_PAD_DEG / 2].map((n) => n.toFixed(4)).join(",")
    : "";
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_1.4fr]">
      <div className="flex flex-col gap-2 text-sm">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-text-subtle">Perkiraan lokasi</div>
          <div className="font-medium text-text-main">{place}</div>
          {hasPin && <div className="font-mono text-[11px] text-text-subtle">{geo.lat.toFixed(4)}, {geo.lon.toFixed(4)}{geo.timezone ? ` · ${geo.timezone}` : ""}</div>}
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-text-subtle">Provider / ISP</div>
          <div className="font-medium text-text-main">{geo.isp || geo.org || "Tidak diketahui"}</div>
          {(geo.org && geo.org !== geo.isp) && <div className="text-[11px] text-text-subtle">{geo.org}</div>}
          {geo.asn && <div className="font-mono text-[11px] text-text-subtle">AS{geo.asn}</div>}
        </div>
        <p className="text-[11px] text-text-subtle">
          Perkiraan dari database IP, akurat sampai level kota (radius puluhan km), bukan alamat penelepon.
          Sering menunjuk lokasi pusat jaringan ISP. VPN/proxy menampilkan lokasi servernya.
        </p>
        {hasPin && (
          <a className="text-xs font-medium text-primary hover:underline" target="_blank" rel="noopener noreferrer"
            href={`https://www.google.com/maps?q=${geo.lat},${geo.lon}`}>
            Buka di Google Maps ↗
          </a>
        )}
      </div>
      {hasPin && (
        <iframe
          title={`Peta perkiraan lokasi ${geo.ip}`}
          className="h-52 w-full rounded-xl border border-border/60"
          loading="lazy" referrerPolicy="no-referrer"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${geo.lat},${geo.lon}`}
        />
      )}
    </div>
  );
}

GeoCard.propTypes = {
  geo: PropTypes.object,
  type: PropTypes.string,
};

/** One client IP over time: when it called, at what hours, and with what. */
export default function SourceActivity({ sources, selected, onSelect, period }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [metric, setMetric] = useState("requests");

  useEffect(() => {
    if (!selected) return undefined;
    let alive = true;
    fetch(`/api/usage/source?source=${encodeURIComponent(selected)}&period=${period}`, { cache: "no-store" })
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`))))
      .then((d) => { if (alive) { setData(d); setError(""); } })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [selected, period]);

  if (!selected) return null;
  const current = data?.source === selected && data?.period === period ? data : null;
  const peak = current ? current.byHour.reduce((a, b) => (b.requests > a.requests ? b : a), current.byHour[0]) : null;

  return (
    <Card className="flex min-w-0 flex-col gap-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-sm font-semibold uppercase tracking-wide text-text-muted">Aktivitas IP</span>
          <span className="text-xs text-text-subtle">Waktu dalam WIB · periode {period}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-lg border border-border bg-surface px-2 py-1 font-mono text-sm"
            value={selected} onChange={(e) => onSelect(e.target.value)} aria-label="Filter IP sumber"
          >
            {sources.map((s) => <option key={s.source} value={s.source}>{s.ip} ({s.label})</option>)}
          </select>
          <div className="grid grid-cols-2 items-center gap-1 rounded-lg border border-border bg-bg-subtle p-1">
            {["requests", "tokens"].map((m) => (
              <button key={m} type="button" onClick={() => setMetric(m)} aria-pressed={metric === m}
                className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition-colors ${metric === m ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-text hover:bg-bg-hover"}`}>
                {m === "requests" ? "Request" : "Token"}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => onSelect(null)} aria-label="Tutup aktivitas IP"
            className="rounded-lg border border-border px-2 py-1 text-xs text-text-muted hover:bg-bg-hover">Tutup</button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">Gagal memuat: {error}</div>}
      {!current && !error && <div className="flex h-44 items-center justify-center text-sm text-text-muted" aria-busy="true">Memuat…</div>}

      {current && <GeoCard geo={current.geo} type={current.type} />}

      {current && (current.totals.requests === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-text-muted">IP ini tidak punya request pada periode ini.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Request" value={new Intl.NumberFormat("id-ID").format(current.totals.requests)}
              sub={current.totals.errors ? `${current.totals.errors} gagal` : "semua berhasil"} />
            <Stat label="Token" value={fmtTokens(current.totals.promptTokens + current.totals.completionTokens)}
              sub={`↑ ${fmtTokens(current.totals.promptTokens)} · ↓ ${fmtTokens(current.totals.completionTokens)}`} />
            <Stat label="Pertama / terakhir" value={<span className="text-xs">{wibTime(current.firstSeen)}</span>}
              sub={wibTime(current.lastSeen)} />
            <Stat label="Jam tersibuk" value={`${String(peak.hour).padStart(2, "0")}:00`} sub={`${peak.requests} request`} />
          </div>
          {current.truncated && (
            <div className="text-xs text-warning">Data terlalu banyak; hanya request terbaru yang dihitung. Persempit periode.</div>
          )}

          <div>
            <div className="mb-1 text-xs font-semibold text-text-muted">
              Linimasa per {current.granularity === "hour" ? "jam" : "hari"}
            </div>
            <Bars data={current.timeline} xKey="label" metric={metric} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-semibold text-text-muted">Pola jam aktif (00–23 WIB)</div>
              <Bars data={current.byHour} xKey="hour" metric={metric} height={150}
                tickFormatter={(h) => `${String(h).padStart(2, "0")}:00`} />
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold text-text-muted">Model yang dipakai</div>
              <div className="flex flex-col gap-1.5">
                {current.byModel.map((m) => (
                  <div key={m.model} className="flex items-center justify-between gap-3 text-xs">
                    <span className="min-w-0 truncate font-mono text-text-main" title={m.model}>{m.model}</span>
                    <span className="shrink-0 tabular-nums text-text-muted">{m.requests} req · {fmtTokens(m.tokens)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs font-semibold text-text-muted">{current.recent.length} request terakhir</div>
            <div className="max-h-72 overflow-auto rounded-lg border border-border/60">
              <table className="w-full min-w-[640px] text-xs">
                <thead className="sticky top-0 bg-surface-2 text-left text-text-subtle">
                  <tr>
                    <th className="px-2 py-1.5">Waktu (WIB)</th>
                    <th className="px-2 py-1.5">Model</th>
                    <th className="px-2 py-1.5">Key</th>
                    <th className="px-2 py-1.5 text-right">Masuk</th>
                    <th className="px-2 py-1.5 text-right">Keluar</th>
                    <th className="px-2 py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {current.recent.map((r, i) => (
                    <tr key={`${r.timestamp}-${i}`} className="border-t border-border/40">
                      <td className="whitespace-nowrap px-2 py-1 tabular-nums">{wibTime(r.timestamp)}</td>
                      <td className="px-2 py-1 font-mono">{r.model || "—"}</td>
                      <td className="px-2 py-1 font-mono text-text-muted">{r.apiKey || "—"}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmtTokens(r.promptTokens)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmtTokens(r.completionTokens)}</td>
                      <td className={`px-2 py-1 ${r.status && r.status !== "ok" ? "text-danger" : "text-success"}`}>{r.status || "ok"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ))}
    </Card>
  );
}

SourceActivity.propTypes = {
  sources: PropTypes.arrayOf(PropTypes.shape({ source: PropTypes.string, ip: PropTypes.string, label: PropTypes.string })).isRequired,
  selected: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  period: PropTypes.string.isRequired,
};
