const plans = [
  {
    name: "Core Foundation",
    description: "Perfect for new traders.",
    price: "Rp 500K",
    cta: "Join Foundation",
    href: "mailto:hello@kafeinmatcha.academy?subject=Join%20Core%20Foundation",
    features: [
      "Market structure & mapping",
      "Risk management setup",
      "Trading journal basics",
      "Private community access",
    ],
  },
  {
    name: "Advanced Edge",
    description: "Sharpen your technical edge.",
    price: "Rp 500K",
    originalPrice: "Rp 1.000.000",
    badge: "50% OFF LIMITED",
    cta: "Join Advanced",
    href: "mailto:hello@kafeinmatcha.academy?subject=Join%20Advanced%20Edge",
    features: [
      "Advanced ADX & momentum",
      "Complex market case studies",
      "Setup optimization system",
      "Priority mentor feedback",
    ],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="relative z-10 px-4 py-20 md:px-8">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[48px] border border-white/10 bg-[#0F0D0A] p-5 shadow-2xl md:p-10">
        <div className="rounded-[40px] bg-[#F1F3F3] p-6 text-[#0E0C0A] md:p-10 lg:p-14">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.9fr_0.9fr] lg:items-stretch">
            <div className="flex flex-col justify-center">
              <p className="text-sm font-bold uppercase tracking-[0.34em] text-[#534C29]">
                Enrollment
              </p>
              <h2 className="mt-6 max-w-xl text-5xl font-semibold leading-[0.92] md:text-7xl">
                Choose the right batch for your journey.
              </h2>
              <p className="mt-7 max-w-xl text-xl leading-9 text-[#6C6662]">
                Get full access to live interactive classes, session recordings,
                our private community, and all the essential templates you need
                to build your trading lab.
              </p>
            </div>

            {plans.map((plan) => (
              <PlanCard key={plan.name} {...plan} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PlanCard({
  name,
  description,
  price,
  originalPrice,
  badge,
  cta,
  href,
  features,
}: {
  name: string;
  description: string;
  price: string;
  originalPrice?: string;
  badge?: string;
  cta: string;
  href: string;
  features: string[];
}) {
  return (
    <article className="flex min-h-[460px] flex-col rounded-[32px] bg-[#0E0C0A] p-7 text-[#F1F3F3] shadow-2xl">
      {badge ? (
        <p className="mb-5 w-fit rounded-full bg-[#8D8C59]/25 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.08em] text-[#D6D1A2]">
          {badge}
        </p>
      ) : null}

      <div>
        <h3 className="text-3xl font-semibold leading-tight">{name}</h3>
        <p className="mt-2 text-lg leading-7 text-[#A5A4A1]">{description}</p>
      </div>

      <div className="mt-8">
        {originalPrice ? (
          <p className="text-2xl font-semibold text-[#6C6662] line-through">
            {originalPrice}
          </p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-end gap-2">
          <p className="text-6xl font-semibold leading-none">{price}</p>
          <p className="pb-2 text-base font-medium text-[#827971]">/ batch</p>
        </div>
      </div>

      <ul className="mt-8 space-y-4 text-base font-medium leading-7 text-[#D0CFCA]">
        {features.map((feature) => (
          <li key={feature} className="flex gap-3">
            <span className="text-[#F1F3F3]">✓</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <a
        href={href}
        className="mt-auto block rounded-full bg-[#F1F3F3] px-6 py-4 text-center text-sm font-extrabold text-[#0E0C0A] transition hover:bg-white"
      >
        {cta}
      </a>
    </article>
  );
}
