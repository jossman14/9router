import Link from "next/link";
import Reveal from "./Reveal";
import { IconArrowRight } from "./Icons";

export default function FinalCta() {
  return (
    <section className="lp-section lp-section--tight" aria-labelledby="cta-heading">
      <div className="lp-container">
        <Reveal className="lp-final">
          <div className="lp-section-head" style={{ marginBottom: 0 }}>
            <h2 id="cta-heading" className="lp-h2">Arahkan aplikasi Anda hari ini</h2>
            <p className="lp-lead">
              Buat akun, terbitkan satu API key, dan ganti base URL. Paket Free aktif seketika
              tanpa kartu kredit.
            </p>
            <div className="lp-hero__cta">
              <Link href="/register" className="lp-btn lp-btn--primary lp-btn--lg">
                Mulai Gratis
                <span className="lp-btn__disc" aria-hidden="true"><IconArrowRight width="14" height="14" /></span>
              </Link>
              <a href="#harga" className="lp-btn lp-btn--secondary lp-btn--lg">Lihat Harga</a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
