import Reveal from "./Reveal";

const STEPS = [
  {
    title: "Buat akun",
    body: "Daftar dengan email. Paket Free langsung aktif tanpa kartu kredit.",
  },
  {
    title: "Hubungkan provider",
    body: "Tambahkan akun OpenAI, Anthropic, Gemini, atau provider lain lewat OAuth maupun API key.",
  },
  {
    title: "Terbitkan API key",
    body: "Buat key untuk tiap aplikasi. Key ditampilkan sekali, lalu disimpan sebagai hash.",
  },
  {
    title: "Arahkan aplikasi",
    body: "Ganti base URL ke endpoint 9Router. Pemakaian token langsung terlihat di dashboard.",
  },
];

export default function HowItWorks() {
  return (
    <section className="lp-section lp-section--tint" id="cara-kerja" aria-labelledby="cara-heading">
      <div className="lp-container">
        <div className="lp-section-head">
          <Reveal as="p" className="lp-eyebrow">Cara Kerja</Reveal>
          <Reveal as="h2" id="cara-heading" className="lp-h2" delay={60}>
            Siap jalan dalam <span className="lp-accent">empat langkah</span>
          </Reveal>
        </div>

        <ol className="lp-steps">
          {STEPS.map((s, i) => (
            <Reveal as="li" key={s.title} className="lp-step" delay={i * 90} data-active={i === 0 ? "true" : "false"}>
              <h3 className="lp-card__title">{s.title}</h3>
              <p className="lp-card__body" style={{ marginTop: ".45rem" }}>{s.body}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
