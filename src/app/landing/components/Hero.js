import Link from "next/link";
import RoutingDiagram from "./RoutingDiagram";
import Reveal from "./Reveal";
import { IconArrowRight, IconCheckCircle } from "./Icons";

const CUES = [
  "Kompatibel penuh dengan OpenAI API",
  "Tanpa kartu kredit",
  "Ganti provider tanpa ubah kode",
];

export default function Hero() {
  return (
    <section className="lp-hero" aria-labelledby="hero-heading">
      <div className="lp-container">
        <div className="lp-hero__inner">
          <Reveal className="lp-hero__badge" as="p">
            <b>Baru</b> Kuota token per paket, langsung dari dashboard
          </Reveal>

          <Reveal as="h1" id="hero-heading" className="lp-display" delay={60}>
            Satu endpoint untuk <span className="lp-accent">semua model AI</span> yang Anda pakai
          </Reveal>

          <Reveal as="p" className="lp-lead" delay={120}>
            9Router menyatukan 40+ provider AI di balik satu API yang kompatibel dengan OpenAI.
            Arahkan aplikasi Anda sekali, lalu ganti model, tambah akun cadangan, dan pantau
            pemakaian token tanpa menyentuh kode lagi.
          </Reveal>

          <Reveal className="lp-hero__cta" delay={180}>
            <Link href="/register" className="lp-btn lp-btn--primary lp-btn--lg">
              Mulai Gratis
              <span className="lp-btn__disc" aria-hidden="true"><IconArrowRight width="14" height="14" /></span>
            </Link>
            <a href="#cara-kerja" className="lp-btn lp-btn--secondary lp-btn--lg">Lihat Cara Kerja</a>
          </Reveal>

          <Reveal as="ul" className="lp-hero__cues" delay={240}>
            {CUES.map((c) => (
              <li key={c} className="lp-hero__cue">
                <IconCheckCircle /> {c}
              </li>
            ))}
          </Reveal>
        </div>

        <Reveal delay={300}>
          <RoutingDiagram />
        </Reveal>
      </div>
    </section>
  );
}
