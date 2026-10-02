"use client";
import { useEffect, useState } from "react";
import { IconLayers } from "@/app/landing/components/Icons";

/** The models the selected package can call, and how to call one. */
export default function ModelsPanel({ baseUrl }) {
  const [data, setData] = useState(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/me/models", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { models: [] }))
      .catch(() => ({ models: [], failed: true }))
      .then((d) => { if (alive) setData(d); });
    return () => { alive = false; };
  }, []);

  async function copy(id) {
    await navigator.clipboard.writeText(id).catch(() => {});
    setPicked(id);
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? "" : c)), 1500);
  }

  if (!data) return <div className="sd-skeleton" style={{ height: 320 }} aria-busy="true" />;

  const q = query.trim().toLowerCase();
  const models = q ? data.models.filter((m) => m.id.toLowerCase().includes(q)) : data.models;
  const example = picked || data.models[0]?.id || "nama-model";

  return (
    <>
      <section className="sd-panel" aria-labelledby="models-title">
        <div className="sd-panel__head">
          <div>
            <h2 className="sd-panel__title" id="models-title">Model tersedia</h2>
            <p className="sd-panel__sub">
              {data.packageName
                ? `${data.models.length} model ${data.restricted ? "dalam" : "bisa dipakai dengan"} paket ${data.packageName}`
                : "Tanpa paket aktif, belum ada model yang bisa dipakai"}
            </p>
          </div>
          <input
            className="lp-input" type="search" style={{ maxWidth: 260 }}
            placeholder="Cari model…" aria-label="Cari model"
            value={query} onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {models.length === 0 ? (
          <div className="sd-empty">
            <span className="sd-empty__icon" aria-hidden="true"><IconLayers /></span>
            <p className="sd-empty__title">{q ? "Tidak ada model yang cocok" : "Belum ada model"}</p>
            <p className="sd-empty__body">
              {data.failed ? "Gagal memuat daftar model. Muat ulang halaman."
                : q ? "Coba kata kunci lain." : "Pilih atau beli paket di tab Paket & Tagihan."}
            </p>
          </div>
        ) : (
          <div className="sd-panel__body sd-panel__body--flush sd-tablewrap" style={{ maxHeight: 440, overflowY: "auto" }}>
            <table className="sd-table">
              <thead>
                <tr>
                  <th scope="col">Model ID</th>
                  <th scope="col">Provider</th>
                  <th scope="col" className="sd-num">Pakai</th>
                </tr>
              </thead>
              <tbody>
                {models.map((m) => (
                  <tr key={m.id} aria-selected={picked === m.id}>
                    <td className="sd-mono">{m.id}</td>
                    <td>{m.owned_by || "—"}</td>
                    <td className="sd-num">
                      <button type="button" className="lp-btn lp-btn--secondary lp-btn--sm" onClick={() => copy(m.id)}>
                        {copied === m.id ? "Tersalin" : "Salin ID"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="sd-panel" aria-labelledby="models-example">
        <div className="sd-panel__head">
          <div>
            <h2 className="sd-panel__title" id="models-example">Cara memakai</h2>
            <p className="sd-panel__sub">Isi field <code>model</code> dengan ID di atas</p>
          </div>
        </div>
        <div className="sd-panel__body">
          <div className="lp-code">
            <div className="lp-code__row"><code>curl {baseUrl}/v1/chat/completions \</code></div>
            <div className="lp-code__row"><code>{"  "}-H &quot;Authorization: Bearer sk9r_…&quot; \</code></div>
            <div className="lp-code__row"><code>{"  "}-H &quot;Content-Type: application/json&quot; \</code></div>
            <div className="lp-code__row lp-code__row--add">
              <code>{"  "}-d &apos;{`{"model":"${example}","messages":[{"role":"user","content":"Halo"}]}`}&apos;</code>
            </div>
            <div className="lp-code__note">
              Klien seperti Cline, Cursor, atau Continue cukup diarahkan ke <b>{baseUrl}/v1</b>. Daftar model
              di klien otomatis hanya berisi model dari paket Anda.
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
