"use client";
import { Fragment, useEffect, useState } from "react";
import { compactTokens, dateTime, num } from "../saas/format";

const input = "rounded-lg border border-border bg-surface px-2 py-1 text-sm text-text";
const SUB_STATUS = { active: "Aktif", expired: "Kedaluwarsa", cancelled: "Dicabut" };

async function send(url, body) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (res?.ok) return null;
  return (await res?.json().catch(() => ({})))?.error || "Gagal menyimpan perubahan.";
}

function UsageBar({ used, quota }) {
  const pct = quota ? Math.min(100, (used / quota) * 100) : 0;
  return (
    <div className="h-1.5 w-28 overflow-hidden rounded bg-surface-2" title={`${pct.toFixed(1)}%`}>
      <div
        className={"h-full " + (pct >= 100 ? "bg-danger" : pct >= 80 ? "bg-warning" : "bg-primary")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** One user's subscriptions: top up, revoke, or gift a package. */
function UserDetail({ user, packages, onChange }) {
  const [subs, setSubs] = useState(null);
  const [topUp, setTopUp] = useState({});
  const [gift, setGift] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch(`/api/admin/users/${user.id}`, { cache: "no-store" }).catch(() => null);
    const data = res?.ok ? await res.json().catch(() => ({})) : {};
    setSubs(data.subscriptions ?? []);
  }

  // Fetch-on-mount; setState lands after an await, which the lint rule cannot see.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [user.id]);

  async function act(body, confirmText) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError((await send(`/api/admin/users/${user.id}`, body)) || "");
    await load();
    setBusy(false);
    onChange();
  }

  return (
    <div className="flex flex-col gap-3 bg-bg-alt px-4 py-4">
      {error && <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}

      {subs === null ? <span className="text-sm text-text-muted">Memuat langganan…</span>
        : subs.length === 0 ? <span className="text-sm text-text-muted">Belum punya langganan.</span>
        : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-text-subtle">
                <th className="py-1 pr-3">Paket</th>
                <th className="py-1 pr-3">Token</th>
                <th className="py-1 pr-3">Berlaku sampai</th>
                <th className="py-1 pr-3">Status</th>
                <th className="py-1 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="py-2 pr-3">
                    <span className="font-medium text-text">{s.packageName}</span>
                    {s.isSelected && <span className="ml-2 text-xs font-semibold text-primary">dipakai</span>}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap text-text-muted">
                    {num(s.tokensUsed)} / {num(s.tokenQuota)}
                    <UsageBar used={s.tokensUsed} quota={s.tokenQuota} />
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap text-text-muted">{s.expiresAt ? dateTime(s.expiresAt) : "—"}</td>
                  <td className="py-2 pr-3">{SUB_STATUS[s.status] || s.status}</td>
                  <td className="py-2">
                    <div className="flex items-center justify-end gap-2">
                      <input
                        className={`${input} w-32`} type="number" placeholder="+ token"
                        aria-label={`Tambah token untuk ${s.packageName}`}
                        value={topUp[s.id] ?? ""}
                        onChange={(e) => setTopUp({ ...topUp, [s.id]: e.target.value })}
                      />
                      <button
                        type="button" disabled={busy || !Number(topUp[s.id])}
                        className="rounded-lg border border-border px-3 py-1 text-xs hover:bg-surface-2 disabled:opacity-50"
                        onClick={() => {
                          const add = Math.round(Number(topUp[s.id]));
                          setTopUp({ ...topUp, [s.id]: "" });
                          void act(
                            { subscriptionId: s.id, tokenQuota: s.tokenQuota + add },
                            `${add > 0 ? "Tambah" : "Kurangi"} ${num(Math.abs(add))} token pada ${s.packageName}?`
                          );
                        }}
                      >
                        Simpan
                      </button>
                      {s.status === "active" ? (
                        <button
                          type="button" disabled={busy}
                          className="rounded-lg border border-border px-3 py-1 text-xs text-danger hover:bg-danger/10 disabled:opacity-50"
                          onClick={() => act({ subscriptionId: s.id, status: "cancelled" },
                            `Cabut langganan ${s.packageName}? Permintaan dari paket ini langsung ditolak.`)}
                        >
                          Cabut
                        </button>
                      ) : s.status === "cancelled" && (
                        <button
                          type="button" disabled={busy}
                          className="rounded-lg border border-border px-3 py-1 text-xs hover:bg-surface-2 disabled:opacity-50"
                          onClick={() => act({ subscriptionId: s.id, status: "active" })}
                        >
                          Aktifkan
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <select className={input} value={gift} onChange={(e) => setGift(e.target.value)} aria-label="Paket hadiah">
          <option value="">Beri paket tanpa pembayaran…</option>
          {packages.filter((p) => p.isActive).map((p) => (
            <option key={p.id} value={p.id}>{p.name} — {compactTokens(p.tokenQuota)} token</option>
          ))}
        </select>
        <button
          type="button" disabled={busy || !gift}
          className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
          onClick={() => {
            const pkg = packages.find((p) => p.id === gift);
            setGift("");
            void act({ packageId: gift },
              `Beri paket ${pkg?.name} ke ${user.email} tanpa order? Paket ini langsung jadi paket aktifnya. ` +
              `Untuk pembelian berbayar, catat lewat tab Pembelian agar masuk laporan pendapatan.`);
          }}
        >
          Beri paket
        </button>
      </div>
    </div>
  );
}

export default function UsersTab({ users, packages, onChange }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  async function toggleActive(u) {
    if (u.isActive && !window.confirm(`Tangguhkan ${u.email}? Semua API key-nya langsung ditolak.`)) return;
    setBusy(u.id);
    setError((await send(`/api/admin/users/${u.id}`, { isActive: !u.isActive })) || "");
    setBusy(null);
    onChange();
  }

  const q = query.trim().toLowerCase();
  const shown = q
    ? users.filter((u) => `${u.email} ${u.name || ""} ${u.packageName || ""}`.toLowerCase().includes(q))
    : users;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          className="w-full max-w-xs rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          type="search" placeholder="Cari email, nama, atau paket…" aria-label="Cari pengguna"
          value={query} onChange={(e) => setQuery(e.target.value)}
        />
        <span className="text-xs text-text-subtle">{num(shown.length)} dari {num(users.length)} pengguna</span>
      </div>
      {error && <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left text-xs uppercase tracking-wide text-text-subtle">
              <th className="px-4 py-3">Pengguna</th>
              <th className="px-4 py-3">Paket aktif</th>
              <th className="px-4 py-3">Pemakaian</th>
              <th className="px-4 py-3">Peran</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-text-muted">Tidak ada pengguna yang cocok.</td></tr>
            )}
            {shown.map((u) => (
              <Fragment key={u.id}>
                <tr className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-text">{u.name || "—"}</div>
                    <div className="text-xs text-text-subtle">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {u.packageName
                      ? <span className="text-text">{u.packageName}</span>
                      : <span className="text-danger">Tanpa paket</span>}
                    {u.expiresAt && <div className="text-xs text-text-subtle">s.d. {dateTime(u.expiresAt)}</div>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-text-muted">
                    {compactTokens(u.tokensUsed)} / {compactTokens(u.tokenQuota)}
                    <UsageBar used={u.tokensUsed} quota={u.tokenQuota} />
                  </td>
                  <td className="px-4 py-3">
                    <span className={u.role === "admin" ? "font-semibold text-primary" : "text-text-muted"}>
                      {u.role === "admin" ? "Admin" : "Pengguna"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={u.isActive ? "text-success" : "text-text-subtle"}>
                      {u.isActive ? "Aktif" : "Ditangguhkan"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button" aria-expanded={open === u.id}
                        className="rounded-lg border border-border px-3 py-1 text-xs font-medium hover:bg-surface-2"
                        onClick={() => setOpen(open === u.id ? null : u.id)}
                      >
                        {open === u.id ? "Tutup" : "Kelola"}
                      </button>
                      <button
                        type="button" disabled={busy === u.id}
                        className="rounded-lg border border-border px-3 py-1 text-xs font-medium hover:bg-surface-2 disabled:opacity-50"
                        onClick={() => toggleActive(u)}
                      >
                        {u.isActive ? "Tangguhkan" : "Aktifkan"}
                      </button>
                    </div>
                  </td>
                </tr>
                {open === u.id && (
                  <tr className="border-b border-border">
                    <td colSpan={6} className="p-0">
                      <UserDetail user={u} packages={packages} onChange={onChange} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
