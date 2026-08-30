import { TIERS } from "@/lib/saas/config.js";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Problem from "./components/Problem";
import Features from "./components/Features";
import HowItWorks from "./components/HowItWorks";
import Showcase from "./components/Showcase";
import UseCases from "./components/UseCases";
import Pricing from "./components/Pricing";
import Faq, { FAQ_ITEMS } from "./components/Faq";
import FinalCta from "./components/FinalCta";
import SiteFooter from "./components/SiteFooter";
import "./landing.css";

export const metadata = {
  title: "9Router — Satu Endpoint untuk Semua Model AI",
  description:
    "Satukan 40+ provider AI di balik satu API yang kompatibel dengan OpenAI. Fallback antar akun, terjemahan format otomatis, dan kuota token per paket.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "id_ID",
    title: "9Router — Satu Endpoint untuk Semua Model AI",
    description:
      "Satukan 40+ provider AI di balik satu API yang kompatibel dengan OpenAI, lengkap dengan fallback antar akun dan kuota token per paket.",
    siteName: "9Router",
  },
  twitter: {
    card: "summary_large_image",
    title: "9Router — Satu Endpoint untuk Semua Model AI",
    description: "Satu API kompatibel OpenAI untuk 40+ provider, dengan fallback antar akun dan kuota token.",
  },
  robots: { index: true, follow: true },
};

// Tier cards render from the same config the gateway enforces.
const TIER_LIST = Object.entries(TIERS).map(([id, t]) => ({ id, ...t }));

// Only FAQPage + SoftwareApplication: both describe facts the page states.
// No aggregateRating — there are no real reviews to cite.
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "9Router",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      description:
        "Gateway routing AI yang menyatukan 40+ provider di balik satu API kompatibel OpenAI, dengan fallback antar akun dan kuota token per paket.",
      offers: TIER_LIST.map((t) => ({
        "@type": "Offer",
        name: t.label,
        price: String(t.priceUsd),
        priceCurrency: "USD",
      })),
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ_ITEMS.map((i) => ({
        "@type": "Question",
        name: i.q,
        acceptedAnswer: { "@type": "Answer", text: i.a },
      })),
    },
  ],
};

export default function LandingPage() {
  return (
    <div className="lp">
      <a href="#konten" className="lp-skip">Lewati ke konten utama</a>
      <Navbar />
      <main id="konten">
        <Hero />
        <Problem />
        <Features />
        <HowItWorks />
        <Showcase />
        <UseCases />
        <Pricing tiers={TIER_LIST} />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
    </div>
  );
}
