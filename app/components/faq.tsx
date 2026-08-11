import { faqs } from "../data";
import { SectionHeading } from "./section-heading";

export function FAQ() {
  return (
    <section id="faq" className="relative z-10 px-4 py-10 md:px-8 md:py-20">
      <div className="mx-auto max-w-4xl">
        <SectionHeading eyebrow="FAQ" title="Before you join." align="center" />
        <div className="mt-8 space-y-4 md:mt-12">
          {faqs.map((faq) => (
            <div key={faq.question} className="rounded-[26px] border border-[#E4DDCE] bg-white p-5 text-[#102016] shadow-[0_14px_34px_rgba(28,37,19,0.08)] md:rounded-[32px] md:p-7">
              <h3 className="text-xl font-semibold md:text-2xl">{faq.question}</h3>
              <p className="mt-4 text-sm leading-7 text-[#3C4636] md:text-base md:leading-8">{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
