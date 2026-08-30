"use client";
import { useState } from "react";
import { IconWarning, IconCheckCircle } from "@/app/landing/components/Icons";
import { compactTokens, dateTime } from "./format";

function PasswordForm() {
  const [values, setValues] = useState({ currentPassword: "", newPassword: "" });
  const [state, setState] = useState({ busy: false, error: "", ok: false });
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (state.busy) return;
    setState({ busy: true, error: "", ok: false });
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setState({ busy: false, error: data.error || "Gagal mengganti kata sandi.", ok: false }); return; }
      setState({ busy: false, error: "", ok: true });
      setValues({ currentPassword: "", newPassword: "" });
      // Changing the password invalidates every session, this one included.
      setTimeout(() => { window.location.href = "/login"; }, 1800);
    } catch {
      setState({ busy: false, error: "Tidak dapat terhubung ke server.", ok: false });
    }
  }

  return (
    <form onSubmit={submit} style={{ maxWidth: "22rem" }}>
      {state.error && (
        <div className="lp-alert lp-alert--error" role="alert"><IconWarning /><span>{state.error}</span></div>
      )}
      {state.ok && (
        <div className="lp-alert lp-alert--ok" role="status">
          <IconCheckCircle />
          <span>Kata sandi diperbarui. Anda akan diarahkan untuk masuk kembali.</span>
        </div>
      )}
      <div className="lp-field">
        <label className="lp-field__label" htmlFor="pw-current">Kata sandi saat ini</label>
        <input id="pw-current" className="lp-input" type="password" autoComplete="current-password"
          required value={values.currentPassword} onChange={set("currentPassword")} />
      </div>
      <div className="lp-field">
        <label className="lp-field__label" htmlFor="pw-new">Kata sandi baru</label>
        <input id="pw-new" className="lp-input" type="password" autoComplete="new-password"
          required minLength={10} aria-describedby="pw-hint"
          value={values.newPassword} onChange={set("newPassword")} />
        <span className="lp-field__hint" id="pw-hint">Minimal 10 karakter, huruf dan angka.</span>
      </div>
      <button type="submit" className="lp-btn lp-btn--primary" style={{ marginTop: "1.25rem" }} disabled={state.busy}>
        {state.busy ? "Menyimpan…" : "Ganti Kata Sandi"}
      </button>
    </form>
  );
}

export default function SettingsPanel({ user }) {
  const rows = [
    ["Email", user.email],
    ["Nama", user.name || "—"],
    ["Paket", user.tierLabel],
    ["Kuota token", `${compactTokens(user.tokenQuota)} / periode`],
    ["Batas laju", `${user.rpm} permintaan / menit`],
    ["Batas API key", `${user.maxKeys} key`],
    ["Bergabung", dateTime(user.createdAt)],
  ];

  return (
    <>
      <section className="sd-panel" aria-labelledby="acct-title">
        <div className="sd-panel__head">
          <div>
            <h2 className="sd-panel__title" id="acct-title">Detail akun</h2>
            <p className="sd-panel__sub">Untuk mengubah paket, hubungi kami.</p>
          </div>
        </div>
        <div className="sd-panel__body sd-panel__body--flush sd-tablewrap">
          <table className="sd-table">
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}>
                  <th scope="row" style={{ background: "transparent", textTransform: "none", letterSpacing: 0, fontSize: ".82rem", width: "40%" }}>
                    {k}
                  </th>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="sd-panel" aria-labelledby="pw-title">
        <div className="sd-panel__head">
          <div>
            <h2 className="sd-panel__title" id="pw-title">Keamanan</h2>
            <p className="sd-panel__sub">Mengganti kata sandi akan mengakhiri semua sesi aktif.</p>
          </div>
        </div>
        <div className="sd-panel__body"><PasswordForm /></div>
      </section>
    </>
  );
}
