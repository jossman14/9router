"use client";
import { useEffect, useRef, useState } from "react";
import { IconKey, IconClose, IconCheck, IconWarning } from "@/app/landing/components/Icons";
import { dateTime } from "./format";

function CreateKeyModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function submit(e) {
    e.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Gagal membuat API key."); return; }
      setCreated(data);
      onCreated();
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(created.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Salin otomatis gagal. Salin manual dari kotak di atas.");
    }
  }

  return (
    <div className="sd-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sd-modal" role="dialog" aria-modal="true" aria-labelledby="key-modal-title">
        <div className="sd-modal__head">
          <h2 className="sd-panel__title" id="key-modal-title">
            {created ? "API key berhasil dibuat" : "Buat API key baru"}
          </h2>
          <button type="button" className="sd-iconbtn" onClick={onClose} aria-label="Tutup dialog">
            <IconClose />
          </button>
        </div>

        <div className="sd-modal__body">
          {created ? (
            <>
              <p className="lp-card__body">
                Salin sekarang — key ini hanya ditampilkan satu kali. Yang tersimpan di server
                hanyalah hash-nya, jadi kami tidak bisa menampilkannya lagi.
              </p>
              <div className="sd-reveal">
                <code>{created.key}</code>
                <button type="button" className="lp-btn lp-btn--secondary lp-btn--sm" onClick={copy}>
                  {copied ? <><IconCheck width="14" height="14" /> Tersalin</> : "Salin"}
                </button>
              </div>
              {error && <div className="lp-alert lp-alert--error" role="alert"><IconWarning /><span>{error}</span></div>}
              <div className="sd-modal__actions">
                <button type="button" className="lp-btn lp-btn--primary" onClick={onClose}>
                  Saya sudah menyimpannya
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={submit}>
              <p className="lp-card__body">
                Beri nama sesuai aplikasi yang akan memakainya, agar pemakaiannya mudah ditelusuri.
              </p>
              {error && <div className="lp-alert lp-alert--error" role="alert"><IconWarning /><span>{error}</span></div>}
              <div className="lp-field">
                <label className="lp-field__label" htmlFor="key-name">Nama key</label>
                <input
                  ref={inputRef}
                  id="key-name"
                  className="lp-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="produksi-web"
                  maxLength={60}
                  required
                />
              </div>
              <div className="sd-modal__actions">
                <button type="button" className="lp-btn lp-btn--secondary" onClick={onClose}>Batal</button>
                <button type="submit" className="lp-btn lp-btn--primary" disabled={busy || !name.trim()}>
                  {busy ? "Membuat…" : "Buat Key"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function KeysPanel({ keys, maxKeys, onChange }) {
  const [modal, setModal] = useState(false);
  const [pending, setPending] = useState(null);
  const atLimit = keys.length >= maxKeys;

  async function toggle(k) {
    setPending(k.id);
    await fetch(`/api/keys/${k.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !k.isActive }),
    }).catch(() => {});
    setPending(null);
    onChange();
  }

  async function remove(k) {
    if (!window.confirm(`Hapus key "${k.name}"? Aplikasi yang memakainya akan langsung berhenti bekerja.`)) return;
    setPending(k.id);
    await fetch(`/api/keys/${k.id}`, { method: "DELETE" }).catch(() => {});
    setPending(null);
    onChange();
  }

  return (
    <section className="sd-panel" aria-labelledby="keys-title">
      <div className="sd-panel__head">
        <div>
          <h2 className="sd-panel__title" id="keys-title">API key</h2>
          <p className="sd-panel__sub">{keys.length} dari {maxKeys} key terpakai pada paket Anda</p>
        </div>
        <button
          type="button"
          className="lp-btn lp-btn--primary lp-btn--sm"
          onClick={() => setModal(true)}
          disabled={atLimit}
          title={atLimit ? "Batas key paket Anda sudah tercapai" : undefined}
        >
          Buat Key
        </button>
      </div>

      {keys.length === 0 ? (
        <div className="sd-empty">
          <span className="sd-empty__icon" aria-hidden="true"><IconKey /></span>
          <p className="sd-empty__title">Belum ada API key</p>
          <p className="sd-empty__body">
            Buat key pertama Anda untuk mulai mengirim permintaan ke endpoint 9Router.
          </p>
          <button type="button" className="lp-btn lp-btn--primary lp-btn--sm" onClick={() => setModal(true)}>
            Buat Key
          </button>
        </div>
      ) : (
        <div className="sd-panel__body sd-panel__body--flush sd-tablewrap">
          <table className="sd-table">
            <thead>
              <tr>
                <th scope="col">Nama</th>
                <th scope="col">Key</th>
                <th scope="col">Dibuat</th>
                <th scope="col">Terakhir dipakai</th>
                <th scope="col">Status</th>
                <th scope="col"><span className="sr-only">Aksi</span></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id}>
                  <td style={{ fontWeight: 600 }}>{k.name}</td>
                  <td className="sd-mono">{k.keyPrefix ? `${k.keyPrefix}…` : "—"}</td>
                  <td>{dateTime(k.createdAt)}</td>
                  <td>{k.lastUsedAt ? dateTime(k.lastUsedAt) : "Belum pernah"}</td>
                  <td>
                    <span className="sd-badge" data-tone={k.isActive ? "ok" : "off"}>
                      {k.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td>
                    <div className="sd-rowactions">
                      <button
                        type="button"
                        className="lp-btn lp-btn--secondary lp-btn--sm"
                        onClick={() => toggle(k)}
                        disabled={pending === k.id}
                      >
                        {k.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                      <button
                        type="button"
                        className="lp-btn lp-btn--ghost lp-btn--sm"
                        onClick={() => remove(k)}
                        disabled={pending === k.id}
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && <CreateKeyModal onClose={() => setModal(false)} onCreated={onChange} />}
    </section>
  );
}
