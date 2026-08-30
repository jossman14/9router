"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconWarning } from "@/app/landing/components/Icons";

export default function RegisterForm() {
  const router = useRouter();
  const [values, setValues] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Pendaftaran gagal. Coba lagi.");
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
        <label className="lp-field__label" htmlFor="reg-name">Nama</label>
        <input
          id="reg-name" className="lp-input" type="text" autoComplete="name"
          placeholder="Nama Anda" value={values.name} onChange={set("name")}
        />
      </div>

      <div className="lp-field">
        <label className="lp-field__label" htmlFor="reg-email">Email</label>
        <input
          id="reg-email" className="lp-input" type="email" autoComplete="email" required
          placeholder="nama@perusahaan.com" value={values.email} onChange={set("email")}
        />
      </div>

      <div className="lp-field">
        <label className="lp-field__label" htmlFor="reg-password">Kata sandi</label>
        <input
          id="reg-password" className="lp-input" type="password" autoComplete="new-password" required
          minLength={10} aria-describedby="reg-password-hint"
          placeholder="Minimal 10 karakter" value={values.password} onChange={set("password")}
        />
        <span className="lp-field__hint" id="reg-password-hint">
          Minimal 10 karakter, mengandung huruf dan angka.
        </span>
      </div>

      <button type="submit" className="lp-btn lp-btn--primary lp-btn--lg lp-auth__submit" disabled={busy}>
        {busy ? <><span className="lp-spinner" aria-hidden="true" /> Membuat akun…</> : "Buat Akun Gratis"}
      </button>

      <p className="lp-auth__alt">
        Sudah punya akun? <Link href="/login">Masuk di sini</Link>
      </p>
    </form>
  );
}
