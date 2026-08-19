import type { Metadata } from "next";
import { BackgroundGlow } from "@/app/components/background-glow";
import { Footer } from "@/app/components/footer";
import { Navbar } from "@/app/components/navbar";
import { PaymentStatusClient } from "./payment-status-client";

export const metadata: Metadata = {
  title: "Status Pembayaran — Kafeinmatcha Academy",
  description: "Cek status pembayaran pendaftaran batch trading class Kafeinmatcha Academy.",
};

type PaymentStatusPageProps = {
  params: Promise<{ orderId: string }>;
};

export default async function PaymentStatusPage({ params }: PaymentStatusPageProps) {
  const { orderId } = await params;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F6F2EA] pb-24 text-[#102016] md:pb-0">
      <BackgroundGlow />
      <Navbar />
      <div className="relative z-10 px-5 pt-32 pb-16 sm:px-8 md:pt-40 md:pb-24">
        <PaymentStatusClient orderId={orderId} />
      </div>
      <Footer />
    </main>
  );
}
