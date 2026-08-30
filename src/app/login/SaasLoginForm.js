"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconWarning } from "@/app/landing/components/Icons";

export default function SaasLoginForm() {
  const router = useRouter();
  const [values, setValues] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(data.error || "Email atau kata sandi salah.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Tidak dapat terhubung ke server. Periksa koneksi Anda.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {error && (
        <div className="lp-alert lp-alert--error" role="alert">
          <IconWarning /> <span>{error}</span>
        </div>
      )}

      <div className="lp-field">
        <label className="lp-field__label" htmlFor="login-email">Email</label>
        <input
          id="login-email" className="lp-input" type="email" autoComplete="email" required
          placeholder="nama@perusahaan.com" value={values.email} onChange={set("email")}
        />
      </div>

      <div className="lp-field">
        <label className="lp-field__label" htmlFor="login-password">Kata sandi</label>
        <input
          id="login-password" className="lp-input" type="password" autoComplete="current-password" required
          placeholder="Kata sandi Anda" value={values.password} onChange={set("password")}
        />
      </div>

      <button type="submit" className="lp-btn lp-btn--primary lp-btn--lg lp-auth__submit" disabled={busy}>
        {busy ? <><span className="lp-spinner" aria-hidden="true" /> Memproses…</> : "Masuk"}
      </button>

      <p className="lp-auth__alt">
        Belum punya akun? <Link href="/register">Daftar gratis</Link>
      </p>
    </form>
  );
}
