"use client";
import { useCallback, useEffect, useState } from "react";
import { IconCheck, IconWarning, IconCheckCircle } from "@/app/landing/components/Icons";
import { compactTokens, dateTime } from "./format";

const STATUS_LABEL = { paid: "Lunas", pending: "Menunggu diproses", cancelled: "Dibatalkan" };

export default function BillingPanel({ user, tiers }) {
  const [orders, setOrders] = useState([]);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async (alive = () => true) => {
    const res = await fetch("/api/me/orders", { cache: "no-store" }).catch(() => null);
    const data = res && res.ok ? await res.json().catch(() => ({})) : {};
    if (alive()) setOrders(data.orders ?? []);
  }, []);

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(() => alive);
    return () => { alive = false; };
  }, [load]);

  async function request(tier) {
    setBusy(tier);
    setMsg(null);
    const res = await fetch("/api/me/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(null);
    if (!res || !res.ok) {
      setMsg({ tone: "error", text: data.error || "Gagal mengirim permintaan." });
      return;
    }
    setMsg({ tone: "ok", text: "Permintaan terkirim. Admin akan memprosesnya." });
    void load();
  }

  const pending = orders.find((o) => o.status === "pending");

  return (
    <>
      <section className="sd-panel" aria-labelledby="plan-title">
        <div className="sd-panel__head">
          <div>
            <h2 className="sd-panel__title" id="plan-title">Paket Anda</h2>
            <p className="sd-panel__sub">
              {user.tierLabel} · {compactTokens(user.tokenQuota)} token / periode
            </p>
          </div>
          <span className="sd-plan">{user.tierLabel}</span>
        </div>

        <div className="sd-panel__body">
          {msg && (
            <div className={`lp-alert ${msg.tone === "ok" ? "lp-alert--ok" : "lp-alert--error"}`} role="status">
              {msg.tone === "ok" ? <IconCheckCircle /> : <IconWarning />}
              <span>{msg.text}</span>
            </div>
          )}
          {pending && (
            <div className="lp-alert lp-alert--ok" role="status" style={{ marginTop: msg ? ".8rem" : 0 }}>
              <IconCheckCircle />
              <span>
                Permintaan paket <b>{pending.tier}</b> sedang menunggu diproses admin.
              </span>
            </div>
          )}

          <div className="lp-price-grid" style={{ marginTop: "1.1rem" }}>
            {tiers.map((t) => {
              const current = t.id === user.tier;
              return (
                <div className="lp-plan" key={t.id} data-featured={current ? "true" : "false"}>
                  {current && <span className="lp-plan__tag">Paket aktif</span>}
                  <span className="lp-plan__name">{t.label}</span>
                  <span className="lp-plan__price">
                    <b>{t.priceUsd === 0 ? "Gratis" : `$${t.priceUsd}`}</b>
                    {t.priceUsd > 0 && <span>/bulan</span>}
                  </span>
                  <span className="lp-plan__quota">{compactTokens(t.tokenQuota)} token / periode</span>
                  <ul className="lp-plan__list">
                    <li><IconCheck /> {t.rpm} permintaan / menit</li>
                    <li><IconCheck /> {t.maxKeys} API key</li>
                  </ul>
                  <div className="lp-plan__cta">
                    <button
                      type="button"
                      className={`lp-btn ${current ? "lp-btn--secondary" : "lp-btn--primary"}`}
                      disabled={current || !!pending || busy === t.id}
                      onClick={() => request(t.id)}
                    >
                      {current ? "Paket aktif" : busy === t.id ? "Mengirim…" : "Minta paket ini"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="lp-price-note">
            Permintaan paket diproses manual oleh admin. Paket berubah setelah pembayaran ditandai lunas.
          </p>
        </div>
      </section>

      <section className="sd-panel" aria-labelledby="orders-title">
        <div className="sd-panel__head">
          <div>
            <h2 className="sd-panel__title" id="orders-title">Riwayat pembelian</h2>
            <p className="sd-panel__sub">Semua permintaan dan pembelian paket Anda</p>
          </div>
        </div>
        {orders.length === 0 ? (
          <div className="sd-empty">
            <p className="sd-empty__title">Belum ada pembelian</p>
            <p className="sd-empty__body">Riwayat akan muncul setelah Anda meminta paket berbayar.</p>
          </div>
        ) : (
          <div className="sd-panel__body sd-panel__body--flush sd-tablewrap">
            <table className="sd-table">
              <thead>
                <tr>
                  <th scope="col">Tanggal</th>
                  <th scope="col">Paket</th>
                  <th scope="col" className="sd-num">Jumlah</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>{dateTime(o.createdAt)}</td>
                    <td style={{ textTransform: "capitalize" }}>{o.tier}</td>
                    <td className="sd-num">${o.amountUsd.toFixed(2)}</td>
                    <td>
                      <span className="sd-badge" data-tone={o.status === "paid" ? "ok" : o.status === "cancelled" ? "off" : "bad"}>
                        {STATUS_LABEL[o.status] || o.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
