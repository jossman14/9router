"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { IconMenu, IconClose, IconRoute, IconArrowRight } from "./Icons";

const LINKS = [
  { href: "#masalah", label: "Masalah" },
  { href: "#fitur", label: "Fitur" },
  { href: "#cara-kerja", label: "Cara Kerja" },
  { href: "#harga", label: "Harga" },
  { href: "#faq", label: "FAQ" },
];

export function BrandMark({ href = "/" }) {
  return (
    <Link href={href} className="lp-brand">
      <span className="lp-brand__mark" aria-hidden="true"><IconRoute /></span>
      9Router
    </Link>
  );
}

export default function Navbar() {
  const [stuck, setStuck] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll and wire Escape while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <header className="lp-nav" data-stuck={stuck ? "true" : "false"}>
        <nav className="lp-container lp-nav__inner" aria-label="Navigasi utama">
          <BrandMark />

          <div className="lp-nav__links">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} className="lp-nav__link">{l.label}</a>
            ))}
          </div>

          <div className="lp-nav__actions">
            <Link href="/login" className="lp-btn lp-btn--ghost lp-btn--sm">Masuk</Link>
            <Link href="/register" className="lp-btn lp-btn--primary lp-btn--sm">
              Mulai Gratis
              <span className="lp-btn__disc" aria-hidden="true"><IconArrowRight width="13" height="13" /></span>
            </Link>
          </div>

          <button
            type="button"
            className="lp-nav__toggle"
            aria-label="Buka menu navigasi"
            aria-expanded={open}
            aria-controls="lp-drawer"
            onClick={() => setOpen(true)}
          >
            <IconMenu />
          </button>
        </nav>
      </header>

      {open && (
        <div className="lp-drawer" id="lp-drawer" role="dialog" aria-modal="true" aria-label="Menu navigasi">
          <div className="lp-container lp-drawer__head">
            <BrandMark />
            <button
              type="button"
              className="lp-nav__toggle"
              aria-label="Tutup menu navigasi"
              onClick={() => setOpen(false)}
              autoFocus
            >
              <IconClose />
            </button>
          </div>
          <div className="lp-container lp-drawer__body">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} className="lp-drawer__link" onClick={() => setOpen(false)}>
                {l.label}
              </a>
            ))}
            <div className="lp-drawer__actions">
              <Link href="/register" className="lp-btn lp-btn--primary lp-btn--lg" onClick={() => setOpen(false)}>
                Mulai Gratis
              </Link>
              <Link href="/login" className="lp-btn lp-btn--secondary lp-btn--lg" onClick={() => setOpen(false)}>
                Masuk
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
