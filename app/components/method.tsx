import { features } from "../data";

export function Method() {
  return (
    <section id="metode" className="relative z-10 px-4 py-20 md:px-8">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[44px] border border-white/10 bg-[#F1F3F3] p-8 text-[#0E0C0A] md:p-12">
          <p className="text-sm font-bold uppercase tracking-[0.28em] text-[#534C29]">Method</p>
          <h2 className="mt-6 text-5xl font-semibold leading-[0.96] tracking-[-0.07em] md:text-7xl">
            From random entry to repeatable process.
          </h2>
        </div>
        <div className="rounded-[44px] border border-white/10 bg-white/[0.04] p-8 md:p-12">
          <p className="text-xl leading-9 text-[#A5A4A1]">
            Program ini membantu peserta memahami cara membaca market, menyusun rule entry, membatasi risiko, dan mengevaluasi keputusan melalui jurnal. Tujuannya bukan membuat kamu mengejar profit cepat, tapi membangun proses trading yang lebih disiplin.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {features.slice(0, 4).map((feature) => (
              <FeaturePill key={feature}>{feature}</FeaturePill>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturePill({ children }: { children: string }) {
  return (
    <div className="rounded-3xl bg-[#0E0C0A] p-5 text-[#F1F3F3]">
      <span className="mr-2 text-[#8D8C59]">+</span>
      {children}
    </div>
  );
}
