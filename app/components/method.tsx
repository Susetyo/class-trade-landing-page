const frameworkPills = [
  "Forex Basics & Risk Management",
  "Market Structure & Fibonacci",
  "Ichimoku Kinko Hyo Mastery",
  "Comprehensive ADX Strategy",
];

export function Method() {
  return (
    <section id="method" className="relative z-10 px-4 py-10 md:px-8 md:py-20">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="flex flex-col justify-between rounded-[34px] border border-[#E4DDCE] bg-white p-6 text-[#102016] shadow-[0_20px_60px_rgba(28,37,19,0.1)] sm:p-7 md:rounded-[44px] md:bg-[#FBF8F1] md:p-12 lg:min-h-[520px]">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#365C2A] sm:text-sm md:tracking-[0.22em]">
              Method
            </p>
            <h2 className="mt-5 border-l-4 border-[#365C2A] pl-4 text-4xl font-extrabold leading-tight sm:text-5xl md:mt-8 md:pl-6 md:text-7xl">
              No more guessing and hoping. Build a trading process you can
              actually trust.
            </h2>
          </div>

          <div className="mt-8 rounded-[26px] bg-[#365C2A] p-5 text-[#F8F4EC] md:mt-12 md:rounded-[28px] md:p-6">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#DDE7C8] md:text-sm md:tracking-[0.22em]">
              Outcome
            </p>
            <p className="mt-4 text-xl font-semibold leading-tight md:text-2xl">
              A clear map for reading pullbacks, managing risk, and acting with
              structure.
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-[34px] border border-[#E4DDCE] bg-[#EFF4E8] p-6 text-[#102016] sm:p-7 md:rounded-[44px] md:p-12 lg:min-h-[520px]">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#365C2A] sm:text-sm md:tracking-[0.22em]">
              Why Fibonacci
            </p>
            <div className="mt-6 border-l-4 border-[#365C2A] pl-4 md:mt-7 md:pl-6">
              <p className="text-xl font-semibold leading-8 text-[#102016] md:text-2xl md:leading-10">
                Trading shouldn&apos;t be a guessing game.
              </p>
              <p className="mt-5 text-base leading-7 text-[#3C4636] md:mt-7 md:text-xl md:leading-9">
                To stop trading blindly, you need a reliable map. That&apos;s
                why{" "}
                <span className="font-bold italic text-[#102016]">
                  Fibonacci
                </span>{" "}
                is at the core of our method. It reveals the market&apos;s
                natural rhythm, helping you pinpoint exact pullback areas for
                logical and safe entries.
              </p>
              <p className="mt-5 text-base font-semibold leading-7 text-[#102016] md:mt-7 md:text-xl md:leading-9">
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
    <div className="rounded-2xl bg-white p-4 text-sm font-semibold leading-tight text-[#102016] shadow-sm ring-1 ring-[#D8D0BD] transition hover:ring-[#8D8C59]/70 md:rounded-3xl md:p-5 md:text-base">
      <span className="mr-2 text-[#365C2A]">+</span>
      <span>{children}</span>
    </div>
  );
}
