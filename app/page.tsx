import { BackgroundGlow } from "./components/background-glow";
import { Curriculum } from "./components/curriculum";
import { Experience } from "./components/experience";
import { FAQ } from "./components/faq";
import { Footer } from "./components/footer";
import { Hero } from "./components/hero";
import { Method } from "./components/method";
import { Metrics } from "./components/metrics";
import { Navbar } from "./components/navbar";
import { Pricing } from "./components/pricing";

export default function Home() {
    return (
        <>
            <main className="relative min-h-screen overflow-hidden bg-[#F6F2EA] pb-24 text-[#102016] md:pb-0">
                <BackgroundGlow />
                <Navbar />
                <Hero />
                <Metrics />
                <Method />
                <Curriculum />
                <Experience />
                <Pricing />
                <FAQ />
                <Footer />
                <a
                    href="#pricing"
                    className="fixed inset-x-4 bottom-4 z-50 flex items-center justify-between rounded-full bg-[#365C2A] px-4 py-3 text-sm font-semibold text-[#F8F4EC] shadow-2xl md:hidden"
                >
                    <span>Join the Batch</span>
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-[#F8F4EC] text-lg text-[#102016]">
                        →
                    </span>
                </a>
            </main>
        </>
    );
}
