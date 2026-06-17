import { features } from "../data";

export function Experience() {
  return (
    <section className="relative z-10 px-4 py-20 md:px-8">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="overflow-hidden rounded-[44px] border border-white/10 bg-[#171411] p-8 md:p-12">
          <div className="flex flex-col justify-between gap-16 md:flex-row">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.28em] text-[#8D8C59]">Experience</p>
              <h2 className="mt-5 max-w-2xl text-5xl font-semibold leading-[0.96] tracking-[-0.07em] md:text-7xl">
                Learn in a premium community space.
              </h2>
            </div>
            <NextSessionCard />
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {features.slice(3).map((feature) => (
              <div key={feature} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <p className="text-2xl font-semibold tracking-[-0.04em]">{feature}</p>
              </div>
            ))}
          </div>
        </div>

        <MentorCard />
      </div>
    </section>
  );
}

function NextSessionCard() {
  return (
    <div className="rounded-[32px] bg-[#0E0C0A] p-6 md:w-72">
      <p className="text-[#A5A4A1]">Next Session</p>
      <p className="mt-4 text-4xl font-semibold tracking-[-0.05em]">Risk Setup</p>
      <div className="mt-6 h-2 rounded-full bg-white/10">
        <div className="h-2 w-[68%] rounded-full bg-[#8D8C59]" />
      </div>
    </div>
  );
}

function MentorCard() {
  return (
    <div className="rounded-[44px] border border-white/10 bg-gradient-to-br from-[#F1F3F3] via-[#C7C4AD] to-[#8D8C59] p-8 text-[#0E0C0A] md:p-10">
      <p className="text-sm font-bold uppercase tracking-[0.28em] text-[#534C29]">Mentor</p>
      <div className="mt-24">
        <p className="text-lg text-[#6C6662]">Lead Instructor</p>
        <h3 className="mt-3 text-5xl font-semibold tracking-[-0.07em]">Arka Pratama</h3>
        <p className="mt-6 leading-8 text-[#6C6662]">
          Fokus pada edukasi market, trading psychology, dan manajemen risiko untuk pemula.
        </p>
      </div>
    </div>
  );
}
