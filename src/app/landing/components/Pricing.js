import Link from "next/link";
import Reveal from "./Reveal";
import { IconCheck, IconArrowRight } from "./Icons";

const nf = new Intl.NumberFormat("id-ID");
const IDR = new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0,
});

function formatQuota(n) {
  if (n >= 1_000_000) return `${nf.format(+(n / 1_000_000).toFixed(1))} juta token`;
  if (n >= 1_000) return `${nf.format(Math.round(n / 1_000))} ribu token`;
  return `${nf.format(n)} token`;
}

/**
 * Plans render from the same package rows the gateway enforces, so the page can
 * never advertise a quota or a model the router will not honour.
 */
export default function Pricing({ tiers = [] }) {
  // Feature the middle paid plan; with an admin-editable catalogue there is no
  // fixed "pro" id to hardcode.
  const paid = tiers.filter((t) => t.priceIdr > 0);
  const featured = paid.length ? paid[Math.floor((paid.length - 1) / 2)].id : null;

  return (
    <section className="lp-section" id="harga" aria-labelledby="harga-heading">
      <div className="lp-container">
        <div className="lp-section-head">
          <Reveal as="p" className="lp-eyebrow">Harga</Reveal>
          <Reveal as="h2" id="harga-heading" className="lp-h2" delay={60}>
            Bayar sesuai <span className="lp-accent">kuota token</span> yang Anda butuhkan
          </Reveal>
          <Reveal as="p" className="lp-lead" delay={120}>
            Kuota dihitung dari total token masuk dan keluar. Saat kuota habis, permintaan berhenti —
            tidak ada tagihan kejutan di akhir bulan.
          </Reveal>
        </div>

        <div className="lp-price-grid">
          {tiers.map((t, i) => (
            <Reveal
              key={t.id}
              className="lp-plan"
              delay={i * 70}
              data-featured={featured === t.id ? "true" : "false"}
            >
              {featured === t.id && <span className="lp-plan__tag">Paling populer</span>}
              <span className="lp-plan__name">{t.name}</span>
              <span className="lp-plan__price">
                <b>{t.priceIdr === 0 ? "Gratis" : IDR.format(t.priceIdr)}</b>
                {t.priceIdr > 0 && <span>/{t.durationDays} hari</span>}
              </span>
              <span className="lp-plan__quota">{formatQuota(t.tokenQuota)}</span>
              <ul className="lp-plan__list">
                <li><IconCheck /> {t.rpm} permintaan per menit</li>
                <li><IconCheck /> {t.maxKeys} API key</li>
                <li>
                  <IconCheck />
                  {t.allowedModels?.length
                    ? `Model: ${t.allowedModels.join(", ")}`
                    : "Semua model yang tersedia"}
                </li>
                {t.description && <li><IconCheck /> {t.description}</li>}
              </ul>
              <div className="lp-plan__cta">
                <Link
                  href="/register"
                  className={`lp-btn ${featured === t.id ? "lp-btn--primary" : "lp-btn--secondary"}`}
                >
                  {t.priceIdr === 0 ? "Mulai Gratis" : `Pilih ${t.name}`}
                  {featured === t.id && (
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
