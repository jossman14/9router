import RegisterForm from "./RegisterForm";
import AuthShell from "@/shared/components/auth/AuthShell";
import "../auth.css";

export const metadata = {
  title: "Daftar — 9Router",
  description: "Buat akun 9Router gratis dan dapatkan satu endpoint untuk semua model AI Anda.",
  robots: { index: false, follow: true },
};

export default function RegisterPage() {
  return (
    <AuthShell
      title="Buat akun 9Router"
      subtitle="Paket Free aktif seketika. Tanpa kartu kredit."
      aside={{
        title: "Satu endpoint, semua model",
        body: "Arahkan aplikasi Anda sekali, lalu atur sisanya dari dashboard.",
        points: [
          "Kompatibel penuh dengan OpenAI API",
          "Fallback otomatis antar akun provider",
          "Kuota token terlihat secara real-time",
        ],
      }}
    >
      <RegisterForm />
    </AuthShell>
  );
}
