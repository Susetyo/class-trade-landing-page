import { features } from "../data";
import { SectionHeading } from "./section-heading";

export function Pricing() {
  return (
    <section id="harga" className="relative z-10 px-4 py-20 md:px-8">
      <div className="mx-auto max-w-7xl rounded-[48px] border border-white/10 bg-[#F1F3F3] p-6 text-[#0E0C0A] md:p-10 lg:p-14">
        <div className="grid gap-10 lg:grid-cols-[1fr_420px] lg:items-center">
          <SectionHeading
            eyebrow="Enrollment"
            title="Join the next private batch."
            body="Dapatkan akses kelas live, recording, community, template trading plan, dan worksheet risk management."
            tone="light"
          />

          <div className="rounded-[36px] bg-[#0E0C0A] p-7 text-[#F1F3F3]">
            <p className="text-[#A5A4A1]">Full Access</p>
            <div className="mt-5 flex items-end gap-2">
              <p className="text-6xl font-semibold tracking-[-0.07em]">Rp499K</p>
              <p className="pb-2 text-[#827971]">/ batch</p>
            </div>
            <ul className="mt-8 space-y-4 text-[#A5A4A1]">
              {features.map((feature) => (
                <li key={feature}>✓ {feature}</li>
              ))}
            </ul>
            <a href="mailto:hello@synextrade.id" className="mt-8 block rounded-full bg-[#F1F3F3] px-8 py-4 text-center font-extrabold text-[#0E0C0A] transition hover:bg-white">
              Daftar via Email
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
