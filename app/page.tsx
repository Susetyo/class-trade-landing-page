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
        <main className="relative min-h-screen overflow-hidden bg-[#0E0C0A] text-[#F1F3F3]">
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
        </main>
    );
}
