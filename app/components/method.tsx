const frameworkPills = [
  "Forex Basics & Risk Management",
  "Market Structure & Fibonacci",
  "Ichimoku Kinko Hyo Mastery",
  "Comprehensive ADX Strategy",
];

export function Method() {
  return (
    <section id="method" className="relative z-10 px-4 py-20 md:px-8">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="flex min-h-[520px] flex-col justify-between rounded-[44px] border border-white/10 bg-[#F1F3F3] p-8 text-[#0E0C0A] md:p-12">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.28em] text-[#534C29]">
              Method
            </p>
            <h2 className="mt-8 border-l-4 border-[#0E0C0A] pl-6 text-5xl font-semibold leading-[0.98] tracking-[-0.06em] md:text-7xl">
              No more guessing and hoping. Build a trading process you can
              actually trust.
            </h2>
          </div>

          <div className="mt-12 rounded-[28px] bg-[#0E0C0A] p-6 text-[#F1F3F3]">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#8D8C59]">
              Outcome
            </p>
            <p className="mt-4 text-2xl font-semibold leading-tight tracking-[-0.04em]">
              A clear map for reading pullbacks, managing risk, and acting with
              structure.
            </p>
          </div>
        </div>

        <div className="flex min-h-[520px] flex-col justify-between rounded-[44px] border border-white/10 bg-white/[0.04] p-8 md:p-12">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.28em] text-[#8D8C59]">
              Why Fibonacci
            </p>
            <div className="mt-7 border-l-4 border-[#8D8C59] pl-6">
              <p className="text-2xl font-semibold leading-10 tracking-[-0.03em] text-[#F1F3F3]">
                Trading shouldn&apos;t be a guessing game.
              </p>
              <p className="mt-7 text-xl leading-9 text-[#A5A4A1]">
                To stop trading blindly, you need a reliable map. That&apos;s
                why{" "}
                <span className="font-bold italic text-[#F1F3F3]">
                  Fibonacci
                </span>{" "}
                is at the core of our method. It reveals the market&apos;s
                natural rhythm, helping you pinpoint exact pullback areas for
                logical and safe entries.
              </p>
              <p className="mt-7 text-xl leading-9 text-[#F1F3F3]">
                Build your data-driven system using these core frameworks:
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {frameworkPills.map((feature) => (
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
    <div className="rounded-3xl bg-[#0E0C0A] p-5 text-base font-semibold leading-tight text-[#F1F3F3] ring-1 ring-white/10 transition hover:ring-[#8D8C59]/70">
      <span className="mr-2 text-[#8D8C59]">+</span>
      <span>{children}</span>
    </div>
  );
}
