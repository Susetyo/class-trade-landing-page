import { navItems } from "../data";

export function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 py-4">
      <div className="mx-auto flex max-w-7xl items-center justify-between rounded-full border border-white/10 bg-[#0E0C0A]/65 px-5 py-3 shadow-2xl backdrop-blur-xl md:px-7">
        <a href="#" className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-[#F1F3F3] text-sm font-black text-[#0E0C0A]">
            S
          </div>
          <div className="leading-tight">
            <p className="text-base font-bold tracking-[-0.03em]">Synex Trade</p>
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#827971]">Academy</p>
          </div>
        </a>

        <nav className="hidden items-center gap-8 text-sm font-medium text-[#A5A4A1] lg:flex">
          {navItems.map((item) => (
            <a key={item.label} href={item.href} className="transition hover:text-[#F1F3F3]">
              {item.label}
            </a>
          ))}
        </nav>

        <a
          href="#harga"
          className="rounded-full bg-[#F1F3F3] px-5 py-3 text-sm font-bold text-[#0E0C0A] transition hover:scale-[1.03] hover:bg-white"
        >
          Join Batch
        </a>
      </div>
    </header>
  );
}
