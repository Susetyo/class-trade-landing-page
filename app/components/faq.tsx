import { faqs } from "../data";
import { SectionHeading } from "./section-heading";

export function FAQ() {
  return (
    <section id="faq" className="relative z-10 px-4 py-20 md:px-8">
      <div className="mx-auto max-w-4xl">
        <SectionHeading eyebrow="FAQ" title="Before you join." align="center" />
        <div className="mt-12 space-y-4">
          {faqs.map((faq) => (
            <div key={faq.question} className="rounded-[32px] border border-white/10 bg-white/[0.04] p-7">
              <h3 className="text-2xl font-semibold tracking-[-0.04em]">{faq.question}</h3>
              <p className="mt-4 leading-8 text-[#A5A4A1]">{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
