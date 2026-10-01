import { BackgroundGlow } from "../components/background-glow";
import { Footer } from "../components/footer";
import { Navbar } from "../components/navbar";

export default function ToolsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative min-h-screen bg-[#F6F2EA] text-[#102016]">
      <BackgroundGlow />
      <Navbar />
      <main className="relative z-10 px-5 pb-12 pt-32 sm:px-8 md:pt-40">
        {children}
      </main>
      <Footer />
    </div>
  );
}
