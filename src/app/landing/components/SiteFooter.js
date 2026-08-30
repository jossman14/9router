import Link from "next/link";
import { BrandMark } from "./Navbar";

const COLUMNS = [
  {
    title: "Produk",
    links: [
      { href: "#fitur", label: "Fitur" },
      { href: "#cara-kerja", label: "Cara Kerja" },
      { href: "#harga", label: "Harga" },
      { href: "#faq", label: "FAQ" },
    ],
  },
  {
    title: "Akun",
    links: [
      { href: "/register", label: "Daftar" },
      { href: "/login", label: "Masuk" },
      { href: "/dashboard", label: "Dashboard" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Kebijakan Privasi" },
      { href: "/terms", label: "Syarat Layanan" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-container">
        <div className="lp-footer__grid">
          <div className="lp-footer__col">
            <BrandMark />
            <p className="lp-card__body" style={{ maxWidth: "30ch" }}>
              Satu endpoint yang kompatibel dengan OpenAI untuk 40+ provider AI, lengkap dengan
              fallback antar akun dan kuota token per paket.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav className="lp-footer__col" key={col.title} aria-label={col.title}>
              <h2 className="lp-footer__title">{col.title}</h2>
              {col.links.map((l) =>
                l.href.startsWith("#") ? (
                  <a key={l.href} href={l.href} className="lp-footer__link">{l.label}</a>
                ) : (
                  <Link key={l.href} href={l.href} className="lp-footer__link">{l.label}</Link>
                )
              )}
            </nav>
          ))}
        </div>

        <div className="lp-footer__bottom">
          <span>© {new Date().getFullYear()} 9Router. Seluruh hak cipta dilindungi.</span>
          <span>Dibangun di atas 9Router — open source.</span>
        </div>
      </div>
    </footer>
  );
}
