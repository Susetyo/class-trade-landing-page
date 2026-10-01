import type { Metadata } from "next";
import { BackgroundGlow } from "../components/background-glow";
import { Footer } from "../components/footer";
import { Navbar } from "../components/navbar";

export const metadata: Metadata = {
    title: "Kebijakan Privasi — Kafeinmatcha Academy",
    description:
        "Data apa yang kami kumpulkan, untuk apa, berapa lama disimpan, dan cara meminta penghapusan data.",
};

export default function PrivacyPolicyPage() {
    return (
        <main className="relative min-h-screen overflow-hidden bg-[#F6F2EA] pb-24 text-[#102016] md:pb-0">
            <BackgroundGlow />
            <Navbar />
            <div className="relative z-10 mx-auto max-w-2xl px-5 pt-32 pb-16 sm:px-8 md:pt-40 md:pb-24">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#365C2A]">
                    Privasi Data
                </p>
                <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">
                    Kebijakan Privasi
                </h1>

                <div className="mt-8 space-y-8 text-sm leading-7 text-[#3C4636]">
                    <section>
                        <h2 className="text-base font-bold text-[#102016]">
                            1. Data yang kami kumpulkan
                        </h2>
                        <p className="mt-2">
                            Saat mendaftar: nama lengkap, alamat email, dan
                            nomor HP. Saat membayar: data transaksi yang
                            dikelola oleh mitra payment gateway kami
                            (Midtrans) — kami tidak pernah menyimpan nomor
                            kartu atau data pembayaran sensitif lainnya
                            secara langsung. Jika kamu menghubungkan akun
                            Telegram, kami menyimpan numeric Telegram user ID
                            milikmu untuk keperluan pemberian akses private
                            channel.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-base font-bold text-[#102016]">
                            2. Tujuan penggunaan data
                        </h2>
                        <p className="mt-2">
                            Data digunakan untuk memproses pendaftaran kelas,
                            memverifikasi status pembayaran, memberikan (dan
                            mencabut, jika pembayaran dibatalkan/direfund)
                            akses ke private Telegram channel kelas, serta
                            menghubungi kamu terkait jadwal batch.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-base font-bold text-[#102016]">
                            3. Retensi data
                        </h2>
                        <p className="mt-2">
                            Data pendaftaran dan transaksi disimpan selama
                            diperlukan untuk keperluan operasional dan
                            kewajiban pembukuan/pajak, dan dihapus atau
                            dianonimkan setelah tidak lagi diperlukan untuk
                            tujuan tersebut, kecuali diminta dihapus lebih
                            awal sesuai bagian 5.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-base font-bold text-[#102016]">
                            4. Siapa saja yang bisa mengakses data
                        </h2>
                        <p className="mt-2">
                            Tim internal yang mengelola pendaftaran dan
                            kelas, serta mitra pemroses pembayaran (Midtrans)
                            dan platform pesan (Telegram) sejauh diperlukan
                            untuk menjalankan fungsi masing-masing. Kami
                            tidak menjual data pribadi kamu ke pihak ketiga.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-base font-bold text-[#102016]">
                            5. Hak kamu & cara meminta penghapusan data
                        </h2>
                        <p className="mt-2">
                            Kamu berhak meminta akses, koreksi, atau
                            penghapusan data pribadimu, serta mencabut
                            persetujuan ini kapan saja. Kirim permintaan ke
                            email kontak yang tercantum di halaman utama
                            kami, sertakan email yang kamu gunakan saat
                            mendaftar — kami akan memproses permintaan dalam
                            waktu yang wajar, kecuali ada kewajiban hukum
                            yang mengharuskan sebagian data tetap disimpan.
                        </p>
                    </section>
                </div>
            </div>
            <Footer />
        </main>
    );
}
