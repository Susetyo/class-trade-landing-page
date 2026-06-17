import { logos } from "../data";

export function LogoStrip() {
  return (
    <section className="relative z-10 px-4 py-10 md:px-8">
      <div className="mx-auto max-w-7xl rounded-full border border-white/10 bg-white/[0.03] px-6 py-5">
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-sm font-bold tracking-[0.28em] text-[#6C6662]">
          {logos.map((logo) => (
            <span key={logo}>{logo}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
