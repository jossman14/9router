import Reveal from "./Reveal";
import { IconLayers, IconShield, IconKey, IconChart, IconPlug, IconBolt } from "./Icons";

// Spotlight: format translation, shown as the actual code change (one line).
function TranslationSpotlight() {
  return (
    <div className="lp-code" aria-hidden="true">
      <div className="lp-code__row lp-code__row--muted">
        <span className="lp-code__gutter">-</span>
        <code>base_url = &quot;https://api.openai.com/v1&quot;</code>
      </div>
      <div className="lp-code__row lp-code__row--add">
        <span className="lp-code__gutter">+</span>
        <code>base_url = &quot;https://app.anda.com/v1&quot;</code>
      </div>
      <div className="lp-code__note">
        Sisa kode Anda tidak berubah. Model apa pun dipanggil lewat skema yang sama.
      </div>
      <div className="lp-chiprow">
        {["gpt-5", "claude-opus-4", "gemini-2.5-pro", "grok-4", "deepseek-v3"].map((m) => (
          <span key={m} className="lp-chip">{m}</span>
        ))}
      </div>
    </div>
  );
}

// Spotlight: fallback chain, shown as an ordered attempt list.
function FallbackSpotlight() {
  const rows = [
    { label: "Akun utama · Anthropic", state: "limit", note: "429 rate limit" },
    { label: "Akun cadangan · Anthropic", state: "skip", note: "kuota habis" },
    { label: "Akun tim · Anthropic", state: "ok", note: "berhasil · 840ms" },
  ];
  return (
    <ul className="lp-chain" aria-hidden="true">
      {rows.map((r, i) => (
        <li key={r.label} className="lp-chain__item" data-state={r.state}>
          <span className="lp-chain__idx">{i + 1}</span>
          <span className="lp-chain__label">{r.label}</span>
          <span className="lp-chain__note">{r.note}</span>
        </li>
      ))}
    </ul>
  );
}

const CARDS = [
  {
    Icon: IconKey,
    title: "API key dengan kuota",
    body: "Terbitkan key per aplikasi atau per anggota tim. Setiap key terikat pada kuota token paket Anda dan bisa dinonaktifkan kapan saja.",
  },
  {
    Icon: IconChart,
    title: "Pemakaian yang transparan",
    body: "Token masuk, token keluar, dan biaya tercatat per permintaan — dikelompokkan per model, per key, dan per hari.",
  },
  {
    Icon: IconPlug,
    title: "Login OAuth atau API key",
    body: "Hubungkan akun provider lewat OAuth resmi atau API key biasa. Token kedaluwarsa diperbarui otomatis di belakang layar.",
  },
  {
    Icon: IconShield,
    title: "Kunci disimpan sebagai hash",
    body: "Key hanya ditampilkan satu kali saat dibuat. Yang tersimpan di database adalah hash-nya, bukan kredensial yang bisa dipakai ulang.",
  },
];

export default function Features() {
  return (
    <section className="lp-section" id="fitur" aria-labelledby="fitur-heading">
      <div className="lp-container">
        <div className="lp-section-head">
          <Reveal as="p" className="lp-eyebrow">Solusinya</Reveal>
          <Reveal as="h2" id="fitur-heading" className="lp-h2" delay={60}>
            Satu lapisan routing yang <span className="lp-accent">menangani sisanya</span>
          </Reveal>
          <Reveal as="p" className="lp-lead" delay={120}>
            9Router duduk di antara aplikasi dan provider. Aplikasi Anda cukup tahu satu alamat.
          </Reveal>
        </div>

        <div className="lp-feature-grid">
          <Reveal className="lp-spotlight lp-span-2">
            <div className="lp-section-head lp-section-head--start" style={{ marginBottom: 0, gap: ".9rem" }}>
              <span className="lp-icon" aria-hidden="true"><IconLayers /></span>
              <h3 className="lp-h3">Ganti model cukup dengan mengganti nama model</h3>
              <p className="lp-card__body">
                Permintaan berformat OpenAI, Claude, atau Gemini diterjemahkan otomatis ke format
                yang dimengerti provider tujuan — termasuk tool call, gambar, dan streaming.
              </p>
            </div>
            <TranslationSpotlight />
          </Reveal>

          <Reveal className="lp-spotlight lp-span-2" delay={80}>
            <div className="lp-section-head lp-section-head--start" style={{ marginBottom: 0, gap: ".9rem" }}>
              <span className="lp-icon" aria-hidden="true"><IconBolt /></span>
              <h3 className="lp-h3">Gagal di satu akun, lanjut ke akun berikutnya</h3>
              <p className="lp-card__body">
                Susun beberapa akun dan model sebagai satu combo. Saat satu akun kena limit atau
                error, permintaan diteruskan ke kandidat berikutnya tanpa perlu retry dari sisi klien.
              </p>
            </div>
            <FallbackSpotlight />
          </Reveal>

          {CARDS.map(({ Icon, title, body }, i) => (
            <Reveal key={title} className="lp-card lp-card--interactive" delay={i * 70}>
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
