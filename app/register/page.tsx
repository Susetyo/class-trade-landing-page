import type { Metadata } from "next";
import { BackgroundGlow } from "../components/background-glow";
import { Footer } from "../components/footer";
import { Navbar } from "../components/navbar";
import { RegistrationForm } from "../components/registration-form";

export const metadata: Metadata = {
  title: "Daftar Batch — Kafeinmatcha Academy",
  description: "Daftarkan dirimu untuk bergabung di batch trading class Kafeinmatcha Academy.",
};

export default function RegisterPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F6F2EA] pb-24 text-[#102016] md:pb-0">
      <BackgroundGlow />
      <Navbar />
      <div className="relative z-10 px-5 pt-32 pb-16 sm:px-8 md:pt-40 md:pb-24">
        <RegistrationForm />
      </div>
      <Footer />
    </main>
  );
}
