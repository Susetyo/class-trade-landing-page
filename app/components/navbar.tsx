import { navItems } from "../data";

export function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-5 py-5 md:px-4 md:py-4">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 bg-[#F6F2EA]/86 px-0 py-0 backdrop-blur md:rounded-full md:border md:border-[#E4DDCE] md:bg-[#FBF8F1]/88 md:px-7 md:py-3 md:shadow-[0_18px_54px_rgba(28,37,19,0.12)]">
        <a href="#" className="flex min-w-0 items-center gap-2 md:gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-base text-[#102016] shadow-sm md:h-10 md:w-10 md:text-lg">
            🍵
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-extrabold uppercase tracking-[0.16em] text-[#102016] md:text-base md:normal-case md:tracking-normal">Kafeinmatcha</p>
            <p className="hidden text-[10px] uppercase tracking-[0.18em] text-[#365C2A] sm:block md:text-[11px]">
              Academy
            </p>
          </div>
        </a>

        <nav className="hidden items-center gap-8 text-sm font-semibold text-[#3C4636] lg:flex">
          {navItems.map((item) => (
            <a key={item.label} href={item.href} className="transition hover:text-[#365C2A]">
              {item.label}
            </a>
          ))}
        </nav>

        <a
          href="#pricing"
          className="hidden shrink-0 rounded-full bg-[#365C2A] px-4 py-2.5 text-xs font-bold text-[#F8F4EC] transition hover:scale-[1.03] hover:bg-[#2D4D24] sm:px-5 sm:py-3 sm:text-sm md:block"
        >
          Join Batch
        </a>
        <button
          type="button"
          aria-label="Open navigation"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#102016] md:hidden"
        >
          <span className="flex w-6 flex-col gap-1.5">
            <span className="h-0.5 w-6 rounded-full bg-current" />
            <span className="h-0.5 w-4 rounded-full bg-current" />
          </span>
        </button>
      </div>
    </header>
  );
}
