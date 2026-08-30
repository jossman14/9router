"use client";
import { useCallback, useEffect, useState } from "react";
import { IconCheck, IconWarning, IconCheckCircle } from "@/app/landing/components/Icons";
import { compactTokens, dateTime, rupiah, daysUntil } from "./format";

const STATUS_LABEL = { paid: "Lunas", pending: "Menunggu diproses", cancelled: "Dibatalkan" };

export default function BillingPanel({ subscriptions, onChange }) {
  const [packages, setPackages] = useState([]);
  const [orders, setOrders] = useState([]);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async (alive = () => true) => {
    const [p, o] = await Promise.all([
      fetch("/api/packages", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch("/api/me/orders", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).catch(() => null),
    ]);
    if (!alive()) return;
    setPackages(p?.packages ?? []);
    setOrders(o?.orders ?? []);
  }, []);

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(() => alive);
    return () => { alive = false; };
  }, [load]);

  async function selectSub(id) {
    setBusy(id);
    setMsg(null);
    const res = await fetch("/api/me/subscriptions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId: id }),
    }).catch(() => null);
    setBusy(null);
    if (!res || !res.ok) {
      setMsg({ tone: "error", text: "Gagal mengganti paket aktif." });
      return;
    }
    setMsg({ tone: "ok", text: "Paket aktif diganti. Permintaan berikutnya memakai kuota paket ini." });
    onChange?.();
  }

  async function buy(packageId) {
    setBusy(packageId);
    setMsg(null);
    const res = await fetch("/api/me/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageId }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(null);
    if (!res || !res.ok) {
      setMsg({ tone: "error", text: data.error || "Gagal mengirim permintaan." });
      return;
    }
    setMsg({ tone: "ok", text: "Permintaan terkirim. Paket aktif setelah admin menandai pembayaran lunas." });
    void load();
  }

  const pending = orders.find((o) => o.status === "pending");
  const active = subscriptions.filter((s) => s.status === "active");

  return (
    <>
      <section className="sd-panel" aria-labelledby="mypkg-title">
        <div className="sd-panel__head">
          <div>
            <h2 className="sd-panel__title" id="mypkg-title">Paket saya</h2>
            <p className="sd-panel__sub">Pilih paket mana yang dipakai untuk permintaan berikutnya</p>
          </div>
        </div>
        <div className="sd-panel__body">
          {msg && (
            <div className={`lp-alert ${msg.tone === "ok" ? "lp-alert--ok" : "lp-alert--error"}`} role="status">
              {msg.tone === "ok" ? <IconCheckCircle /> : <IconWarning />}
              <span>{msg.text}</span>
            </div>
          )}

          {active.length === 0 ? (
            <p className="lp-card__body">Belum ada paket aktif. Pilih salah satu paket di bawah.</p>
          ) : (
            <div className="lp-price-grid" style={{ marginTop: msg ? "1rem" : 0 }}>
              {active.map((s) => {
                const left = daysUntil(s.expiresAt);
                return (
                  <div className="lp-plan" key={s.id} data-featured={s.isSelected ? "true" : "false"}>
                    {s.isSelected && <span className="lp-plan__tag">Sedang dipakai</span>}
                    <span className="lp-plan__name">{s.packageName}</span>
                    <span className="lp-plan__price">
                      <b>{compactTokens(s.tokensRemaining)}</b>
                      <span>tersisa</span>
                    </span>
                    <div className="sd-quota__bar" style={{ height: 8 }}>
                      <span className="sd-quota__fill" style={{ width: `${Math.max(s.usedPercent, 1.5)}%` }} />
                    </div>
                    <ul className="lp-plan__list">
                      <li><IconCheck /> {compactTokens(s.tokensUsed)} / {compactTokens(s.tokenQuota)} terpakai</li>
                      <li><IconCheck /> {s.rpm} permintaan / menit</li>
                      <li>
                        <IconCheck />
                        {s.allowedModels.length === 0
                          ? "Semua model tersedia"
                          : `Model: ${s.allowedModels.join(", ")}`}
                      </li>
                      {left !== null && <li><IconCheck /> Berlaku {left} hari lagi</li>}
                    </ul>
                    <div className="lp-plan__cta">
                      <button
                        type="button"
                        className={`lp-btn ${s.isSelected ? "lp-btn--secondary" : "lp-btn--primary"}`}
                        disabled={s.isSelected || busy === s.id}
                        onClick={() => selectSub(s.id)}
                      >
                        {s.isSelected ? "Paket aktif" : busy === s.id ? "Mengganti…" : "Pakai paket ini"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="sd-panel" aria-labelledby="buy-title">
        <div className="sd-panel__head">
          <div>
            <h2 className="sd-panel__title" id="buy-title">Beli paket</h2>
            <p className="sd-panel__sub">Permintaan diproses admin, lalu paket langsung aktif</p>
          </div>
        </div>
        <div className="sd-panel__body">
          {pending && (
            <div className="lp-alert lp-alert--ok" role="status">
              <IconCheckCircle />
              <span>Permintaan paket <b>{pending.packageName}</b> sedang menunggu diproses admin.</span>
            </div>
          )}
          <div className="lp-price-grid" style={{ marginTop: pending ? "1rem" : 0 }}>
            {packages.map((p) => (
              <div className="lp-plan" key={p.id}>
                <span className="lp-plan__name">{p.name}</span>
                <span className="lp-plan__price">
                  <b>{p.priceIdr === 0 ? "Gratis" : rupiah(p.priceIdr)}</b>
                  {p.priceIdr > 0 && <span>/{p.durationDays} hari</span>}
                </span>
                <span className="lp-plan__quota">{compactTokens(p.tokenQuota)} token</span>
                <ul className="lp-plan__list">
                  <li><IconCheck /> {p.rpm} permintaan / menit</li>
                  <li><IconCheck /> {p.maxKeys} API key</li>
                  <li>
                    <IconCheck />
                    {p.allowedModels.length === 0 ? "Semua model" : p.allowedModels.join(", ")}
                  </li>
                </ul>
                <div className="lp-plan__cta">
                  <button
                    type="button"
                    className="lp-btn lp-btn--primary"
                    disabled={!!pending || busy === p.id}
                    onClick={() => buy(p.id)}
                  >
                    {busy === p.id ? "Mengirim…" : p.priceIdr === 0 ? "Ambil paket" : "Beli paket"}
                  </button>
                </div>
              </div>
            ))}
          </div>
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
            <p className="sd-empty__body">Riwayat akan muncul setelah Anda meminta paket.</p>
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
                    <td>{o.packageName || "—"}</td>
                    <td className="sd-num">{rupiah(o.amountIdr)}</td>
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
