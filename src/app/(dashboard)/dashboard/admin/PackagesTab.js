"use client";
import { useEffect, useState } from "react";
import { compactTokens, rupiah } from "../saas/format";

const BLANK = {
  name: "", description: "", priceIdr: "", tokenQuota: "",
  allowedModels: "", rpm: 60, maxKeys: 3, durationDays: 30, isActive: true,
};

function toForm(pkg) {
  return {
    name: pkg.name,
    description: pkg.description || "",
    priceIdr: String(pkg.priceIdr),
    tokenQuota: String(pkg.tokenQuota),
    allowedModels: (pkg.allowedModels || []).join(", "),
    rpm: pkg.rpm,
    maxKeys: pkg.maxKeys,
    durationDays: pkg.durationDays,
    isActive: pkg.isActive,
  };
}

function toPayload(form) {
  return {
    name: form.name,
    description: form.description,
    priceIdr: Number(form.priceIdr) || 0,
    tokenQuota: Number(form.tokenQuota) || 0,
    // Comma or newline separated; "qwen/*" allows a whole provider.
    allowedModels: String(form.allowedModels)
      .split(/[\n,]/).map((m) => m.trim()).filter(Boolean),
    rpm: Number(form.rpm) || 60,
    maxKeys: Number(form.maxKeys) || 3,
    durationDays: Number(form.durationDays) || 30,
    isActive: !!form.isActive,
  };
}

function Field({ label, hint, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-text-muted">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-text-subtle">{hint}</span>}
    </label>
  );
}

const input = "rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text";

export default function PackagesTab({ onChange }) {
  const [packages, setPackages] = useState([]);
  const [models, setModels] = useState([]);
  const [editing, setEditing] = useState(null); // package id, or "new"
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/admin/packages", { cache: "no-store" }).catch(() => null);
    const data = res && res.ok ? await res.json().catch(() => ({})) : {};
    setPackages(data.packages ?? []);
  }

  useEffect(() => {
    // Fetch-on-mount; every setState lands after an await. The lint rule cannot
    // see through the async boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // Model ids for the allow-list picker come from the gateway's own catalogue,
    // so an admin cannot type a model this router cannot actually route.
    fetch("/api/models", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        const list = Array.isArray(d?.data) ? d.data : Array.isArray(d?.models) ? d.models : [];
        setModels(list.map((m) => (typeof m === "string" ? m : m.id)).filter(Boolean));
      })
      .catch(() => {});
  }, []);

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  function startNew() { setEditing("new"); setForm(BLANK); setError(""); }
  function startEdit(pkg) { setEditing(pkg.id); setForm(toForm(pkg)); setError(""); }
  function cancel() { setEditing(null); setForm(BLANK); setError(""); }

  function toggleModel(id) {
    const cur = String(form.allowedModels).split(/[\n,]/).map((m) => m.trim()).filter(Boolean);
    const next = cur.includes(id) ? cur.filter((m) => m !== id) : [...cur, id];
    setForm((f) => ({ ...f, allowedModels: next.join(", ") }));
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const isNew = editing === "new";
    const res = await fetch(isNew ? "/api/admin/packages" : `/api/admin/packages/${editing}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toPayload(form)),
    }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) {
      setError((await res?.json().catch(() => ({})))?.error || "Gagal menyimpan paket.");
      return;
    }
    cancel();
    await load();
    onChange?.();
  }

  async function remove(pkg) {
    if (!window.confirm(`Hapus paket "${pkg.name}"?`)) return;
    const res = await fetch(`/api/admin/packages/${pkg.id}`, { method: "DELETE" }).catch(() => null);
    const data = res && res.ok ? await res.json().catch(() => ({})) : {};
    if (data.deactivated) {
      window.alert("Paket masih dipakai pelanggan, jadi dinonaktifkan (bukan dihapus) agar riwayat pembelian tetap utuh.");
    }
    await load();
    onChange?.();
  }

  const selectedModels = String(form.allowedModels)
    .split(/[\n,]/).map((m) => m.trim()).filter(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-muted">
          Paket menentukan harga, jatah token, dan model apa saja yang boleh dipakai.
        </p>
        <button
          type="button"
          onClick={startNew}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
        >
          Paket Baru
        </button>
      </div>

      {editing && (
        <form onSubmit={save} className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 text-sm font-semibold text-text">
            {editing === "new" ? "Paket baru" : "Ubah paket"}
          </div>
          {error && <div className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}

          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Nama paket">
              <input className={input} value={form.name} onChange={set("name")} required placeholder="Hemat 10rb" />
            </Field>
            <Field label="Harga (Rupiah)" hint={form.priceIdr ? rupiah(form.priceIdr) : "0 = gratis"}>
              <input className={input} type="number" min="0" value={form.priceIdr} onChange={set("priceIdr")} placeholder="10000" />
            </Field>
            <Field label="Jatah token" hint={form.tokenQuota ? compactTokens(form.tokenQuota) : "mis. 10000000"}>
              <input className={input} type="number" min="0" value={form.tokenQuota} onChange={set("tokenQuota")} placeholder="10000000" />
            </Field>
            <Field label="Batas laju (per menit)">
              <input className={input} type="number" min="1" value={form.rpm} onChange={set("rpm")} />
            </Field>
            <Field label="Maksimum API key">
              <input className={input} type="number" min="1" value={form.maxKeys} onChange={set("maxKeys")} />
            </Field>
            <Field label="Masa aktif (hari)">
              <input className={input} type="number" min="1" value={form.durationDays} onChange={set("durationDays")} />
            </Field>
          </div>

          <div className="mt-3">
            <Field label="Deskripsi">
              <input className={input} value={form.description} onChange={set("description")} maxLength={300} />
            </Field>
          </div>

          <div className="mt-3">
            <Field
              label="Model yang diizinkan"
              hint="Pisahkan dengan koma. Kosongkan agar semua model boleh dipakai. Gunakan qwen/* untuk seluruh model satu provider."
            >
              <textarea className={`${input} min-h-[64px]`} value={form.allowedModels} onChange={set("allowedModels")}
                placeholder="deepseek-v3, glm-4.6, qwen/*" />
            </Field>
            {models.length > 0 && (
              <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-border bg-bg-alt p-2">
                {models.slice(0, 200).map((m) => {
                  const on = selectedModels.includes(m);
                  return (
                    <button
                      key={m} type="button" onClick={() => toggleModel(m)}
                      className={
                        "rounded-full border px-2 py-0.5 text-[11px] transition " +
                        (on ? "border-primary bg-primary/10 text-primary font-semibold"
                            : "border-border text-text-muted hover:border-primary/50")
                      }
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm text-text-muted">
            <input type="checkbox" checked={!!form.isActive} onChange={set("isActive")} />
            Aktif (tampil di halaman harga dan bisa dibeli)
          </label>

          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={busy}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? "Menyimpan…" : "Simpan"}
            </button>
            <button type="button" onClick={cancel}
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-2">
              Batal
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left text-xs uppercase tracking-wide text-text-subtle">
              <th className="px-4 py-3">Paket</th>
              <th className="px-4 py-3">Harga</th>
              <th className="px-4 py-3">Token</th>
              <th className="px-4 py-3">Model</th>
              <th className="px-4 py-3">Batas</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {packages.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">Belum ada paket.</td></tr>
            )}
            {packages.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-text">{p.name}</div>
                  {p.description && <div className="text-xs text-text-subtle">{p.description}</div>}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-text">{rupiah(p.priceIdr)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-text-muted">{compactTokens(p.tokenQuota)}</td>
                <td className="px-4 py-3 text-xs text-text-muted">
                  {p.allowedModels.length === 0
                    ? <span className="text-text-subtle">Semua model</span>
                    : p.allowedModels.slice(0, 3).join(", ") + (p.allowedModels.length > 3 ? ` +${p.allowedModels.length - 3}` : "")}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-xs text-text-muted">
                  {p.rpm}/mnt · {p.maxKeys} key · {p.durationDays} hari
                </td>
                <td className="px-4 py-3">
                  <span className={p.isActive ? "text-success" : "text-text-subtle"}>
                    {p.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => startEdit(p)}
                      className="rounded-lg border border-border px-3 py-1 text-xs hover:bg-surface-2">Ubah</button>
                    <button type="button" onClick={() => remove(p)}
                      className="rounded-lg border border-border px-3 py-1 text-xs text-danger hover:bg-danger/10">Hapus</button>
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
