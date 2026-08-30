import Reveal from "./Reveal";
import { IconTerminal, IconCode, IconUsers, IconGlobe } from "./Icons";

const CASES = [
  {
    Icon: IconCode,
    title: "Produk berbasis AI",
    body: "Jalankan fitur AI di produk Anda tanpa mengunci diri pada satu vendor. Ganti model saat harga atau kualitas berubah.",
  },
  {
    Icon: IconTerminal,
    title: "Coding assistant",
    body: "Arahkan Claude Code, Cursor, atau CLI berbasis OpenAI ke satu endpoint, lalu atur model mana yang dipakai dari dashboard.",
  },
  {
    Icon: IconUsers,
    title: "Tim internal",
    body: "Beri tiap anggota tim API key sendiri dengan pemakaian yang terlacak, alih-alih membagikan satu kunci provider ke semua orang.",
  },
  {
    Icon: IconGlobe,
    title: "Riset dan eksperimen",
    body: "Bandingkan keluaran beberapa model untuk prompt yang sama tanpa menulis ulang klien untuk tiap provider.",
  },
];

export default function UseCases() {
  return (
    <section className="lp-section lp-section--tint" aria-labelledby="usecase-heading">
      <div className="lp-container">
        <div className="lp-section-head">
          <Reveal as="p" className="lp-eyebrow">Untuk Siapa</Reveal>
          <Reveal as="h2" id="usecase-heading" className="lp-h2" delay={60}>
            Dipakai di tempat model AI <span className="lp-accent">harus tetap jalan</span>
          </Reveal>
        </div>

        <div className="lp-grid lp-grid--2">
          {CASES.map(({ Icon, title, body }, i) => (
            <Reveal key={title} className="lp-card lp-card--interactive lp-usecase" delay={i * 80}>
              <span className="lp-icon" aria-hidden="true"><Icon /></span>
              <div>
                <h3 className="lp-card__title">{title}</h3>
                <p className="lp-card__body" style={{ marginTop: ".4rem" }}>{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
