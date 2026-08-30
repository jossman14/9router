import Link from "next/link";
import Reveal from "./Reveal";
import { IconCheck, IconArrowRight } from "./Icons";

const nf = new Intl.NumberFormat("id-ID");

function formatQuota(n) {
  if (n >= 1_000_000) return `${nf.format(n / 1_000_000)} juta token`;
  if (n >= 1_000) return `${nf.format(n / 1_000)} ribu token`;
  return `${nf.format(n)} token`;
}

const EXTRA = {
  free: ["Akses seluruh provider yang terhubung", "Riwayat pemakaian 7 hari"],
  starter: ["Akses seluruh provider yang terhubung", "Riwayat pemakaian 30 hari", "Combo model dengan fallback"],
  pro: ["Semua fitur Starter", "Riwayat pemakaian 90 hari", "Prioritas antrean permintaan"],
  scale: ["Semua fitur Pro", "Riwayat pemakaian penuh", "Kuota khusus sesuai kebutuhan"],
};

/**
 * Plans are rendered from the same TIERS config the API enforces, so the page
 * can never advertise a quota the gateway does not honour.
 */
export default function Pricing({ tiers = [] }) {
  return (
    <section className="lp-section" id="harga" aria-labelledby="harga-heading">
      <div className="lp-container">
        <div className="lp-section-head">
          <Reveal as="p" className="lp-eyebrow">Harga</Reveal>
          <Reveal as="h2" id="harga-heading" className="lp-h2" delay={60}>
            Bayar sesuai <span className="lp-accent">kuota token</span> yang Anda butuhkan
          </Reveal>
          <Reveal as="p" className="lp-lead" delay={120}>
            Kuota dihitung dari total token masuk dan keluar per periode 30 hari. Saat kuota habis,
            permintaan berhenti — tidak ada tagihan kejutan di akhir bulan.
          </Reveal>
        </div>

        <div className="lp-price-grid">
          {tiers.map((t, i) => (
            <Reveal
              key={t.id}
              className="lp-plan"
              delay={i * 70}
              data-featured={t.id === "pro" ? "true" : "false"}
            >
              {t.id === "pro" && <span className="lp-plan__tag">Paling populer</span>}
              <span className="lp-plan__name">{t.label}</span>
              <span className="lp-plan__price">
                <b>{t.priceUsd === 0 ? "Gratis" : `$${t.priceUsd}`}</b>
                {t.priceUsd > 0 && <span>/bulan</span>}
              </span>
              <span className="lp-plan__quota">{formatQuota(t.tokenQuota)} / periode</span>
              <ul className="lp-plan__list">
                <li><IconCheck /> {t.rpm} permintaan per menit</li>
                <li><IconCheck /> {t.maxKeys} API key</li>
                {(EXTRA[t.id] || []).map((f) => <li key={f}><IconCheck /> {f}</li>)}
              </ul>
              <div className="lp-plan__cta">
                <Link
                  href="/register"
                  className={`lp-btn ${t.id === "pro" ? "lp-btn--primary" : "lp-btn--secondary"}`}
                >
                  {t.priceUsd === 0 ? "Mulai Gratis" : `Pilih ${t.label}`}
                  {t.id === "pro" && (
                    <span className="lp-btn__disc" aria-hidden="true"><IconArrowRight width="13" height="13" /></span>
                  )}
                </Link>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal as="p" className="lp-price-note" delay={200}>
          Butuh kuota di luar paket di atas? Hubungi kami untuk penyesuaian.
        </Reveal>
      </div>
    </section>
  );
}
