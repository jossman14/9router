import Reveal from "./Reveal";

export const FAQ_ITEMS = [
  {
    q: "Apakah perlu mengubah kode aplikasi saya?",
    a: "Cukup satu baris. 9Router menyediakan API yang kompatibel dengan OpenAI, jadi Anda hanya mengganti base URL dan API key. Library resmi OpenAI, Anthropic, dan Gemini tetap bisa dipakai seperti biasa.",
  },
  {
    q: "Bagaimana kuota token dihitung?",
    a: "Kuota memakai total token masuk (prompt) ditambah token keluar (completion) dari setiap permintaan yang berhasil. Angkanya diambil dari laporan pemakaian provider, dan langsung terlihat di dashboard setelah permintaan selesai.",
  },
  {
    q: "Apa yang terjadi kalau kuota habis?",
    a: "Permintaan berikutnya ditolak dengan kode 402 beserta pesan yang jelas, sampai periode berikutnya dimulai atau Anda menaikkan paket. Tidak ada pemakaian yang berjalan melebihi kuota, sehingga tidak ada tagihan di luar dugaan.",
  },
  {
    q: "Apakah paket Free benar-benar gratis?",
    a: "Ya. Paket Free tidak memerlukan kartu kredit dan tidak berubah menjadi berbayar dengan sendirinya. Saat kuotanya habis, layanan berhenti sampai periode berikutnya.",
  },
  {
    q: "Bagaimana keamanan API key saya?",
    a: "Key hanya ditampilkan satu kali saat dibuat. Yang disimpan di database adalah hash-nya, sehingga key asli tidak bisa dibaca kembali — termasuk oleh operator layanan. Setiap key bisa dinonaktifkan atau dihapus kapan saja tanpa memengaruhi key lain.",
  },
  {
    q: "Apakah data permintaan saya disimpan?",
    a: "Yang dicatat secara default adalah metadata pemakaian: waktu, model, provider, jumlah token, dan status. Pencatatan isi permintaan bersifat opsional dan dimatikan secara bawaan.",
  },
  {
    q: "Bisakah saya berhenti berlangganan?",
    a: "Bisa, kapan saja. Paket akan turun ke Free pada akhir periode berjalan, dan API key Anda tetap ada — hanya kuotanya yang menyesuaikan.",
  },
];

export default function Faq() {
  return (
    <section className="lp-section lp-section--tint" id="faq" aria-labelledby="faq-heading">
      <div className="lp-container lp-container--narrow">
        <div className="lp-section-head">
          <Reveal as="p" className="lp-eyebrow">FAQ</Reveal>
          <Reveal as="h2" id="faq-heading" className="lp-h2" delay={60}>
            Pertanyaan yang <span className="lp-accent">sering muncul</span>
          </Reveal>
        </div>

        <div className="lp-faq">
          {FAQ_ITEMS.map((item, i) => (
            <Reveal as="details" key={item.q} className="lp-faq__item" delay={i * 50}>
              <summary className="lp-faq__q">
                {item.q}
                <span className="lp-faq__sign" aria-hidden="true" />
              </summary>
              <p className="lp-faq__a">{item.a}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
