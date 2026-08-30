"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  IconRoute, IconGauge, IconKey, IconChart, IconShield, IconBolt, IconTerminal, IconLayers,
} from "@/app/landing/components/Icons";
import QuotaCard from "./QuotaCard";
import UsageChart from "./UsageChart";
import KeysPanel from "./KeysPanel";
import SettingsPanel from "./SettingsPanel";
import BillingPanel from "./BillingPanel";
import { ModelBreakdown, RecentRequests } from "./UsagePanel";
import { compactTokens, num } from "./format";
import "./saas-dashboard.css";

const TABS = [
  { id: "ringkasan", label: "Ringkasan", Icon: IconGauge },
  { id: "keys", label: "API Key", Icon: IconKey },
  { id: "pemakaian", label: "Pemakaian", Icon: IconChart },
  { id: "paket", label: "Paket & Tagihan", Icon: IconLayers },
  { id: "pengaturan", label: "Pengaturan", Icon: IconShield },
];

function Tiles({ totals, keyCount }) {
  const items = [
    { label: "Permintaan", value: num(totals.requests), Icon: IconBolt },
    { label: "Token masuk", value: compactTokens(totals.promptTokens), Icon: IconChart },
    { label: "Token keluar", value: compactTokens(totals.completionTokens), Icon: IconChart },
    { label: "API key aktif", value: num(keyCount), Icon: IconKey },
  ];
  return (
    <div className="sd-tiles">
      {items.map(({ label, value, Icon }) => (
        <div className="sd-tile" key={label}>
          <span className="sd-tile__label"><Icon /> {label}</span>
          <span className="sd-tile__value">{value}</span>
        </div>
      ))}
    </div>
  );
}

function QuickStart({ baseUrl }) {
  return (
    <section className="sd-panel" aria-labelledby="qs-title">
      <div className="sd-panel__head">
        <div>
          <h2 className="sd-panel__title" id="qs-title">Mulai cepat</h2>
          <p className="sd-panel__sub">Arahkan klien apa pun yang kompatibel dengan OpenAI ke sini</p>
        </div>
      </div>
      <div className="sd-panel__body">
        <div className="lp-code">
          <div className="lp-code__row lp-code__row--add">
            <span className="lp-code__gutter" aria-hidden="true"><IconTerminal width="14" height="14" /></span>
            <code>OPENAI_BASE_URL={baseUrl}/v1</code>
          </div>
          <div className="lp-code__row lp-code__row--add">
            <span className="lp-code__gutter" aria-hidden="true">$</span>
            <code>OPENAI_API_KEY=sk9r_…</code>
          </div>
          <div className="lp-code__note">
            Pakai API key yang Anda buat di tab <b>API Key</b>. Sisa kode aplikasi tidak perlu diubah.
          </div>
        </div>
      </div>
    </section>
  );
}

// Only the usage-derived parts wait on the fetch. Quota comes from the server
// render, so the number that matters is on screen at first paint.
function UsageSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
      <span className="sr-only">Memuat data pemakaian…</span>
      <div className="sd-tiles">
        {[0, 1, 2, 3].map((i) => <div key={i} className="sd-skeleton" style={{ height: 92 }} />)}
      </div>
      <div className="sd-skeleton" style={{ height: 250 }} />
    </div>
  );
}

export default function TenantDashboard({ initialUser, baseUrl }) {
  const [tab, setTab] = useState("ringkasan");
  const [user, setUser] = useState(initialUser);
  const [usage, setUsage] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [error, setError] = useState("");

  // `alive` guards against writing state after unmount (fast tab switches, or
  // a logout landing mid-flight).
  const load = useCallback(async (alive = () => true) => {
    try {
      const [meRes, useRes] = await Promise.all([
        fetch("/api/me", { cache: "no-store" }),
        fetch("/api/me/usage", { cache: "no-store" }),
      ]);
      if (meRes.status === 401 || useRes.status === 401) {
        window.location.href = "/login";
        return;
      }
      const me = await meRes.json().catch(() => ({}));
      const u = await useRes.json().catch(() => ({}));
      if (!alive()) return;
      if (me.user) setUser(me.user);
      setSubscriptions(me.subscriptions ?? []);
      setUsage(u);
      setError("");
    } catch {
      if (alive()) setError("Gagal memuat data. Periksa koneksi Anda lalu muat ulang halaman.");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    // Fetch-on-mount: every setState here happens after an await, behind the
    // `alive` guard. The lint rule flags any effect that transitively reaches
    // setState and cannot see through the async boundary.
    // ponytail: drop this by fetching usage in the server component and
    // refreshing with router.refresh() — worth doing if this grows a second
    // data source.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(() => alive);
    return () => { alive = false; };
  }, [load]);

  const reload = useCallback(() => { void load(); }, [load]);

  const keys = usage?.keys ?? [];
  const activeKeys = keys.filter((k) => k.isActive).length;
  const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="lp sd">
      <header className="sd-top">
        <div className="sd-top__inner">
          <Link href="/" className="lp-brand">
            <span className="lp-brand__mark" aria-hidden="true"><IconRoute /></span>
            9Router
          </Link>

          <div className="sd-top__spacer" />
          <span className="sd-plan">{user.subscription ? user.subscription.packageName : "Tanpa paket"}</span>

          <div className="sd-user">
            <span className="sd-avatar" aria-hidden="true">{initial}</span>
            <span className="sd-user__meta">
              <span className="sd-user__name">{user.name || "Akun saya"}</span>
              <span className="sd-user__mail">{user.email}</span>
            </span>
          </div>

          <form action="/api/auth/logout" method="post" onSubmit={async (e) => {
            e.preventDefault();
            await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
            window.location.href = "/login";
          }}>
            <button type="submit" className="lp-btn lp-btn--secondary lp-btn--sm">Keluar</button>
          </form>
        </div>
      </header>

      <div className="sd-body">
        <nav className="sd-nav" aria-label="Navigasi dashboard">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className="sd-nav__item"
              aria-current={tab === id ? "page" : undefined}
              onClick={() => setTab(id)}
            >
              <Icon /> {label}
            </button>
          ))}
        </nav>

        <main className="sd-main">
          {error && <div className="lp-alert lp-alert--error" role="alert"><span>{error}</span></div>}

          {tab === "ringkasan" && (
            <>
              <div>
                <h1 className="sd-h1">Halo, {user.name || "selamat datang"}</h1>
                <p className="sd-sub">Ringkasan pemakaian dan kuota Anda pada periode berjalan.</p>
              </div>
              <QuotaCard user={user} />
              {usage ? (
                <>
                  <Tiles totals={usage.totals} keyCount={activeKeys} />
                  <UsageChart series={usage.series} />
                </>
              ) : <UsageSkeleton />}
              <QuickStart baseUrl={baseUrl} />
            </>
          )}

          {tab === "keys" && (
            <>
              <div>
                <h1 className="sd-h1">API key</h1>
                <p className="sd-sub">Terbitkan satu key per aplikasi agar pemakaiannya mudah ditelusuri.</p>
              </div>
              {usage ? <KeysPanel keys={keys} maxKeys={user.subscription?.maxKeys ?? 1} onChange={reload} /> : <UsageSkeleton />}
              <QuickStart baseUrl={baseUrl} />
            </>
          )}

          {tab === "pemakaian" && (
            <>
              <div>
                <h1 className="sd-h1">Pemakaian</h1>
                <p className="sd-sub">Rincian token yang terpakai per model dan per permintaan.</p>
              </div>
              {usage ? (
                <>
                  <UsageChart series={usage.series} />
                  <ModelBreakdown byModel={usage.byModel} />
                  <RecentRequests recent={usage.recent} />
                </>
              ) : <UsageSkeleton />}
            </>
          )}

          {tab === "paket" && (
            <>
              <div>
                <h1 className="sd-h1">Paket &amp; Tagihan</h1>
                <p className="sd-sub">Lihat paket aktif, ajukan perubahan, dan telusuri riwayat pembelian.</p>
              </div>
              <BillingPanel subscriptions={subscriptions} onChange={reload} />
            </>
          )}

          {tab === "pengaturan" && (
            <>
              <div>
                <h1 className="sd-h1">Pengaturan</h1>
                <p className="sd-sub">Detail akun dan keamanan.</p>
              </div>
              <SettingsPanel user={user} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
