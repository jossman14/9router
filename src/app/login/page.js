import { SAAS_MODE } from "@/lib/saas/config.js";
import LegacyLogin from "./LegacyLogin";
import SaasLoginForm from "./SaasLoginForm";
import AuthShell from "@/shared/components/auth/AuthShell";
import "../auth.css";

export const metadata = {
  title: "Masuk — 9Router",
  description: "Masuk ke dashboard 9Router Anda.",
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  // Self-hosted installs keep the single-operator password screen untouched.
  if (!SAAS_MODE) return <LegacyLogin />;

  return (
    <AuthShell
      title="Masuk ke akun Anda"
      subtitle="Kelola provider, API key, dan kuota token Anda."
      aside={{
        title: "Selamat datang kembali",
        body: "Dashboard Anda menunggu — lengkap dengan pemakaian token terkini.",
        points: [
          "Pantau sisa kuota periode berjalan",
          "Kelola API key per aplikasi",
          "Lihat riwayat permintaan per model",
        ],
      }}
    >
      <SaasLoginForm />
    </AuthShell>
  );
}
