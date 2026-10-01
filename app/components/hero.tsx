import Link from "next/link";

const mentors = ["Ov Kafeinmatcha", "Frida Kucing Hoki", "AHS ADX", "lrainfx"];

export function Hero() {
  return (
    <section className="hero-section relative z-10 px-4 pb-12 pt-28 sm:px-6 md:px-8 md:pb-20 md:pt-40">
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div className="hero-copy min-w-0">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#CDD7BF] bg-[#EFF4E8] px-3 py-2 text-[11px] font-bold text-[#365C2A] sm:text-xs">
            <span className="status-dot h-2 w-2 rounded-full bg-[#638449]" /> Registration open · Live online classes
          </div>
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#63705B]">A little clarity. A better trader.</p>
          <h1 className="text-[clamp(3rem,6.2vw,5.8rem)] font-extrabold leading-[1.02] tracking-[-0.065em]">Build your<br />trading <span className="font-serif font-normal italic text-[#52713D]">edge.</span></h1>
          <p className="mt-6 max-w-lg text-base leading-8 text-[#596251] sm:text-lg">Read the market. Understand your risk. Build a plan you can call your own — with Kafeinmatcha Academy.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/register" className="primary-button">Join Batch <span aria-hidden="true">↗</span></Link>
            <a href="#inside-the-lab" className="secondary-button">Explore the lab <span aria-hidden="true">↓</span></a>
          </div>
          <div className="mt-9 border-t border-[#D8DDCE] pt-5">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#63705B]">Learn alongside your mentors</p>
            <div className="flex flex-wrap gap-x-4 gap-y-3">{mentors.map((mentor, i) => <div key={mentor} className="flex items-center gap-2 text-xs font-semibold"><span className="grid h-7 w-7 place-items-center rounded-full border border-[#C8D1BB] bg-[#E5EBD9] text-[10px] text-[#365C2A]">0{i + 1}</span>{mentor}</div>)}</div>
          </div>
        </div>
        <MarketIllustration />
      </div>
    </section>
  );
}

function MarketIllustration() {
  return (
    <div className="hero-visual relative min-w-0 rounded-[32px] border border-[#D8DDCE] bg-[#E8EDDF] p-5 sm:p-8">
      <div className="mb-7 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.15em] text-[#526146]"><span>The Kafeinmatcha approach</span><span aria-hidden="true">✳</span></div>
      <div className="market-card overflow-hidden rounded-2xl bg-[#192D23] p-5 text-[#F8F4EC] shadow-[0_24px_45px_-20px_#192D2380] sm:p-7">
        <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.15em] text-[#B9C8AB]">Your trading lab</p><h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">Clarity over chaos.</h2></div><span className="rounded-full border border-[#638449] px-2 py-1 text-[9px] text-[#D1E2AF]">ILLUSTRATION</span></div>
        <svg viewBox="0 0 420 245" role="img" aria-label="Illustrative market chart showing a planned entry zone and market structure" className="my-5 w-full">
          <defs><linearGradient id="hero-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#BFD997" stopOpacity="0.25"/><stop offset="100%" stopColor="#BFD997" stopOpacity="0"/></linearGradient></defs>
          {[40, 85, 130, 175, 220].map(y => <line key={y} x1="0" x2="420" y1={y} y2={y} stroke="#ffffff12" />)}
          <rect x="145" y="123" width="240" height="40" rx="4" fill="#BFD99712" stroke="#BFD99750" strokeDasharray="4 5"/>
          <text x="155" y="149" fill="#C5D8B0" fontSize="10">PLANNED ENTRY ZONE</text>
          <path d="M0 207 L30 183 L55 194 L90 133 L120 152 L155 97 L185 117 L216 68 L249 90 L280 45 L310 65 L350 25 L385 41 L420 12 V245 H0Z" fill="url(#hero-area)"/>
          <path className="chart-line" d="M0 207 L30 183 L55 194 L90 133 L120 152 L155 97 L185 117 L216 68 L249 90 L280 45 L310 65 L350 25 L385 41 L420 12" fill="none" stroke="#C5DF9F" strokeWidth="3" strokeLinejoin="round"/>
          <circle cx="249" cy="90" r="5" fill="#DDEBC9"/>
        </svg>
        <div className="grid grid-cols-3 gap-2 border-t border-white/10 pt-4">{["Map the market", "Define your risk", "Follow your plan"].map((label,i) => <div key={label}><p className="text-xs text-[#C5DF9F]">0{i+1}</p><p className="mt-2 text-[10px] leading-4 text-[#D9E0D2] sm:text-xs">{label}</p></div>)}</div>
      </div>
      <div className="mt-5 flex items-center gap-3 rounded-xl border border-[#D3DDC6] bg-[#F8FAF3] p-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#DDE8CD] text-[#365C2A]" aria-hidden="true">✓</span><div><p className="text-sm font-bold">Built on process, not predictions.</p><p className="mt-1 text-xs text-[#63705B]">Real practice. Thoughtful decisions.</p></div></div>
      <p className="mt-5 text-center text-[10px] tracking-wide text-[#63705B]">EDUCATION FIRST. ALWAYS.</p>
    </div>
  );
}
