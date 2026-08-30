import Reveal from "./Reveal";
import { IconCheck } from "./Icons";

const POINTS = [
  "Sisa kuota token periode berjalan, terbaca sekilas",
  "Riwayat permintaan per model, per key, dan per hari",
  "Nonaktifkan key yang bocor tanpa mengganggu key lain",
];

// A structural preview of the dashboard, drawn with the same tokens as the
// real UI. Labelled as an illustration — no invented metrics are presented
// as live data.
function DashboardPreview() {
  const rows = [
    { name: "produksi-web", used: "1.24 jt", state: "Aktif" },
    { name: "bot-internal", used: "412 rb", state: "Aktif" },
    { name: "staging", used: "38 rb", state: "Nonaktif" },
  ];
  return (
    <div className="lp-frame">
      <div className="lp-frame__bar">
        <span className="lp-frame__dots" aria-hidden="true"><i /><i /><i /></span>
        <span className="lp-frame__url">app.9router.dev/dashboard</span>
      </div>
      <div className="lp-frame__body">
        <div className="lp-preview">
          <div className="lp-preview__meter">
            <div className="lp-preview__meter-head">
              <span>Kuota token · paket Pro</span>
              <b>1,69 jt / 10 jt</b>
            </div>
            <div className="lp-preview__bar"><span style={{ width: "17%" }} /></div>
            <div className="lp-preview__meter-foot">Periode berjalan berakhir dalam 22 hari</div>
          </div>

          <div className="lp-preview__tiles">
            <div className="lp-preview__tile"><span>Permintaan</span><b>8.312</b></div>
            <div className="lp-preview__tile"><span>Model aktif</span><b>6</b></div>
            <div className="lp-preview__tile"><span>API key</span><b>3</b></div>
          </div>

          <div className="lp-preview__table" role="presentation">
            <div className="lp-preview__row lp-preview__row--head">
              <span>API key</span><span>Token</span><span>Status</span>
            </div>
            {rows.map((r) => (
              <div className="lp-preview__row" key={r.name}>
                <span className="lp-preview__key">{r.name}</span>
                <span>{r.used}</span>
                <span className="lp-preview__pill" data-off={r.state === "Nonaktif" ? "true" : "false"}>{r.state}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Showcase() {
  return (
    <section className="lp-section" aria-labelledby="showcase-heading">
      <div className="lp-container">
        <div className="lp-spotlight">
          <div className="lp-section-head lp-section-head--start" style={{ marginBottom: 0 }}>
            <Reveal as="p" className="lp-eyebrow">Dashboard</Reveal>
            <Reveal as="h2" id="showcase-heading" className="lp-h2" delay={60}>
              Tahu persis <span className="lp-accent">ke mana token Anda pergi</span>
            </Reveal>
            <Reveal as="p" className="lp-lead" delay={120}>
              Semua pemakaian tercatat di satu tempat — tidak perlu membuka dashboard tiap provider
              satu per satu untuk menghitung ulang biaya.
            </Reveal>
            <Reveal as="ul" className="lp-checklist" delay={180}>
              {POINTS.map((p) => (
                <li key={p}><IconCheck /> {p}</li>
              ))}
            </Reveal>
          </div>
          <Reveal delay={120}>
            <DashboardPreview />
            <p className="lp-diagram__caption">Ilustrasi antarmuka dashboard. Angka pada gambar hanya contoh.</p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
