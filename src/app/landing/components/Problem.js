import Reveal from "./Reveal";
import { IconWarning, IconSwap, IconGauge } from "./Icons";

const PAINS = [
  {
    Icon: IconSwap,
    title: "Setiap provider punya format sendiri",
    body:
      "OpenAI, Anthropic, dan Gemini memakai skema request, tool call, dan streaming yang berbeda. Pindah model berarti menulis ulang lapisan integrasi.",
  },
  {
    Icon: IconWarning,
    title: "Satu akun kena limit, layanan ikut mati",
    body:
      "Rate limit, kuota habis, atau region down membuat produk Anda gagal — padahal ada akun lain yang masih sehat dan siap dipakai.",
  },
  {
    Icon: IconGauge,
    title: "Pemakaian token sulit dilacak",
    body:
      "Biaya tersebar di banyak dashboard provider. Sulit tahu tim, fitur, atau API key mana yang sebenarnya menghabiskan anggaran.",
  },
];

export default function Problem() {
  return (
    <section className="lp-section lp-section--tint" id="masalah" aria-labelledby="masalah-heading">
      <div className="lp-container">
        <div className="lp-section-head">
          <Reveal as="p" className="lp-eyebrow">Masalahnya</Reveal>
          <Reveal as="h2" id="masalah-heading" className="lp-h2" delay={60}>
            Menambah satu model AI, <span className="lp-accent">menambah satu integrasi baru</span>
          </Reveal>
          <Reveal as="p" className="lp-lead" delay={120}>
            Semakin banyak model yang dipakai, semakin rapuh sistemnya. Tiga hambatan ini yang paling sering muncul.
          </Reveal>
        </div>

        <div className="lp-grid lp-grid--3">
          {PAINS.map(({ Icon, title, body }, i) => (
            <Reveal key={title} className="lp-card" delay={i * 90}>
              <span className="lp-icon" aria-hidden="true"><Icon /></span>
              <h3 className="lp-card__title">{title}</h3>
              <p className="lp-card__body">{body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
