"use client";
import { useCallback, useEffect, useState } from "react";
import { compactTokens, num, dateTime, rupiah } from "../saas/format";
import PackagesTab from "./PackagesTab";

const TABS = [
  { id: "ringkasan", label: "Ringkasan" },
  { id: "packages", label: "Paket" },
  { id: "users", label: "Pengguna" },
  { id: "orders", label: "Pembelian" },
];

const STATUS_TONE = { paid: "ok", pending: "warn", cancelled: "off" };
const STATUS_LABEL = { paid: "Lunas", pending: "Menunggu", cancelled: "Dibatalkan" };

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-xs text-text-subtle">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight text-text">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-text-muted">{sub}</div>}
    </div>
  );
}

function Bars({ series }) {
  const max = Math.max(1, ...series.map((d) => d.tokens));
  return (
    <div className="flex h-32 items-end gap-[3px]">
      {series.map((d) => (
        <div
          key={d.date}
          className="flex-1 rounded bg-surface-2"
          title={`${d.date} · ${compactTokens(d.tokens)} token · ${d.requests} permintaan`}
        >
          <div
            className="w-full rounded bg-primary"
            style={{ height: `${d.tokens ? Math.max(4, (d.tokens / max) * 128) : 0}px` }}
          />
        </div>
      ))}
    </div>
  );
}

function Overview({ stats }) {
  if (!stats) return <div className="text-sm text-text-muted">Memuat…</div>;
  const { users, revenue, byTier, series, topUsers } = stats;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pengguna" value={num(users.total)} sub={`${num(users.active)} aktif`} />
        <Stat label="Pendapatan" value={rupiah(revenue.revenueIdr)} sub={`${num(revenue.paidOrders)} order lunas`} />
        <Stat label="Menunggu proses" value={num(revenue.pendingOrders)} sub="permintaan paket" />
        <Stat label="Token terpakai" value={compactTokens(users.tokensUsed)} sub={`dari ${compactTokens(users.tokenQuota)} kuota`} />
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="mb-3 text-sm font-semibold text-text">Pemakaian platform · 14 hari</div>
        <Bars series={series} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 text-sm font-semibold text-text">Sebaran paket</div>
          <div className="flex flex-col gap-2">
            {byTier.map((t) => (
              <div key={t.tier} className="flex items-center justify-between text-sm">
                <span className="text-text-muted">{t.label}</span>
                <span className="font-semibold text-text">{num(t.users)} pengguna</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 text-sm font-semibold text-text">Pemakaian tertinggi</div>
          <div className="flex flex-col gap-2">
            {topUsers.length === 0 && <span className="text-sm text-text-muted">Belum ada data.</span>}
            {topUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-text-muted">{u.email}</span>
                <span className="whitespace-nowrap font-semibold text-text">
                  {compactTokens(u.tokensUsed)} / {compactTokens(u.tokenQuota)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function UsersTab({ users, packages, onChange, busy, setBusy }) {
  async function patch(id, body) {
    setBusy(id);
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
    setBusy(null);
    onChange();
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2 text-left text-xs uppercase tracking-wide text-text-subtle">
            <th className="px-4 py-3">Pengguna</th>
            <th className="px-4 py-3">Paket</th>
            <th className="px-4 py-3">Pemakaian</th>
            <th className="px-4 py-3">Peran</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3">
                <div className="font-medium text-text">{u.name || "—"}</div>
                <div className="text-xs text-text-subtle">{u.email}</div>
              </td>
              <td className="px-4 py-3">
                <select
                  className="rounded-lg border border-border bg-surface px-2 py-1 text-sm"
                  value=""
                  disabled={busy === u.id}
                  onChange={(e) => e.target.value && patch(u.id, { packageId: e.target.value })}
                >
                  <option value="">{u.packageName || "— belum ada paket —"}</option>
                  {packages.filter((p) => p.isActive).map((p) => (
                    <option key={p.id} value={p.id}>Beri paket: {p.name}</option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-text-muted">
                {compactTokens(u.tokensUsed)} / {compactTokens(u.tokenQuota)}
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
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  className="rounded-lg border border-border px-3 py-1 text-xs font-medium hover:bg-surface-2 disabled:opacity-50"
                  disabled={busy === u.id}
                  onClick={() => patch(u.id, { isActive: !u.isActive })}
                >
                  {u.isActive ? "Tangguhkan" : "Aktifkan"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrdersTab({ orders, users, packages, onChange, busy, setBusy }) {
  const [form, setForm] = useState({ userId: "", packageId: "", amountIdr: "", note: "" });
  const [error, setError] = useState("");

  async function create(e) {
    e.preventDefault();
    if (!form.userId || !form.packageId) return;
    setBusy("new");
    setError("");
    const res = await fetch("/api/admin/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        amountIdr: form.amountIdr === "" ? undefined : Number(form.amountIdr),
      }),
    }).catch(() => null);
    setBusy(null);
    if (!res || !res.ok) {
      setError((await res?.json().catch(() => ({})))?.error || "Gagal membuat order.");
      return;
    }
    setForm({ userId: "", packageId: "", amountIdr: "", note: "" });
    onChange();
  }

  async function setStatus(id, status) {
    setBusy(id);
    await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => {});
    setBusy(null);
    onChange();
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={create} className="rounded-xl border border-border bg-surface p-4">
        <div className="mb-3 text-sm font-semibold text-text">Catat pembelian</div>
        {error && <div className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}
        <div className="grid gap-3 md:grid-cols-4">
          <select
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            value={form.userId}
            onChange={(e) => setForm({ ...form, userId: e.target.value })}
            required
          >
            <option value="">Pilih pengguna…</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
          </select>
          <select
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            value={form.packageId}
            onChange={(e) => setForm({ ...form, packageId: e.target.value })}
            required
          >
            <option value="">Pilih paket…</option>
            {packages.filter((p) => p.isActive).map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {rupiah(p.priceIdr)}</option>
            ))}
          </select>
          <input
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            type="number" min="0" placeholder="Jumlah Rp (opsional)"
            value={form.amountIdr}
            onChange={(e) => setForm({ ...form, amountIdr: e.target.value })}
          />
          <input
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            placeholder="Catatan" maxLength={300}
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </div>
        <p className="mt-2 text-xs text-text-subtle">
          Order dibuat berstatus <b>Menunggu</b>. Menandainya lunas akan menerbitkan langganan
          baru dengan jatah token paket tersebut, dan langsung mengaktifkannya untuk pengguna.
        </p>
        <button
          type="submit"
          className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          disabled={busy === "new" || !form.userId || !form.packageId}
        >
          {busy === "new" ? "Menyimpan…" : "Buat Order"}
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left text-xs uppercase tracking-wide text-text-subtle">
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Pengguna</th>
              <th className="px-4 py-3">Paket</th>
              <th className="px-4 py-3">Jumlah</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-text-muted">Belum ada pembelian.</td></tr>
            )}
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 whitespace-nowrap text-text-muted">{dateTime(o.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="text-text">{o.userEmail || o.userId}</div>
                  {o.note && <div className="text-xs text-text-subtle">{o.note}</div>}
                </td>
                <td className="px-4 py-3 text-text">{o.packageName || "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap text-text">{rupiah(o.amountIdr)}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      STATUS_TONE[o.status] === "ok" ? "text-success font-semibold"
                        : STATUS_TONE[o.status] === "warn" ? "text-warning font-semibold"
                        : "text-text-subtle"
                    }
                  >
                    {STATUS_LABEL[o.status] || o.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {o.status !== "paid" && (
                      <button
                        type="button"
                        className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                        disabled={busy === o.id}
                        onClick={() => setStatus(o.id, "paid")}
                      >
                        Tandai Lunas
                      </button>
                    )}
                    {o.status === "pending" && (
                      <button
                        type="button"
                        className="rounded-lg border border-border px-3 py-1 text-xs hover:bg-surface-2 disabled:opacity-50"
                        disabled={busy === o.id}
                        onClick={() => setStatus(o.id, "cancelled")}
                      >
                        Batalkan
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminConsole({ adminEmail }) {
  const [tab, setTab] = useState("ringkasan");
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [packages, setPackages] = useState([]);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async (alive = () => true) => {
    try {
      const [s, u, o, p] = await Promise.all([
        fetch("/api/admin/stats", { cache: "no-store" }).then((r) => r.ok ? r.json() : null),
        fetch("/api/admin/users", { cache: "no-store" }).then((r) => r.ok ? r.json() : null),
        fetch("/api/admin/orders", { cache: "no-store" }).then((r) => r.ok ? r.json() : null),
        fetch("/api/admin/packages", { cache: "no-store" }).then((r) => r.ok ? r.json() : null),
      ]);
      if (!alive()) return;
      setStats(s);
      setUsers(u?.users ?? []);
      setOrders(o?.orders ?? []);
      setPackages(p?.packages ?? []);
      setError("");
    } catch {
      if (alive()) setError("Gagal memuat data admin.");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(() => alive);
    return () => { alive = false; };
  }, [load]);

  const reload = useCallback(() => { void load(); }, [load]);

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text">Users &amp; Billing</h1>
        <p className="mt-1 text-sm text-text-muted">
          Kelola pengguna, paket, dan pembelian. Masuk sebagai {adminEmail}.
        </p>
      </div>

      {error && <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}

      <div className="flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={
              "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition " +
              (tab === t.id ? "bg-primary/10 text-primary" : "text-text-muted hover:bg-surface-2")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "ringkasan" && <Overview stats={stats} />}
      {tab === "packages" && <PackagesTab onChange={reload} />}
      {tab === "users" && (
        <UsersTab users={users} packages={packages} onChange={reload} busy={busy} setBusy={setBusy} />
      )}
      {tab === "orders" && (
        <OrdersTab orders={orders} users={users} packages={packages} onChange={reload} busy={busy} setBusy={setBusy} />
      )}
    </div>
  );
}
