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
        <section id="pricing" className="relative z-10 md:px-8 md:py-20">
            <div className="mx-auto max-w-7xl overflow-hidden border border-[#E4DDCE] bg-white shadow-[0_24px_70px_rgba(28,37,19,0.1)] sm:p-5 md:rounded-[48px] md:p-10">
                <div className=" bg-[#FBF8F1] p-5 text-[#102016] sm:p-6 md:rounded-[40px] md:p-10 lg:p-14">
                    <div className="grid gap-8 lg:grid-cols-[1.15fr_1.8fr] lg:items-stretch">
                        <div className="flex flex-col justify-center">
                            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#365C2A] sm:text-sm md:tracking-[0.24em]">
                                Enrollment
                            </p>
                            <h2 className="mt-5 max-w-xl text-4xl font-extrabold leading-tight sm:text-5xl md:mt-6 md:text-7xl md:leading-[0.92]">
                                Choose the right batch for your journey.
                            </h2>
                            <p className="mt-5 max-w-xl text-base leading-7 text-[#3C4636] md:mt-7 md:text-xl md:leading-9">
                                Get full access to live interactive classes,
                                session recordings, our private community, and
                                all the essential templates you need to build
                                your trading lab.
                            </p>
                        </div>

                        <div
                            className="-mx-5 grid auto-cols-[86%] grid-flow-col gap-4 overflow-x-auto px-5 pb-4 snap-x snap-mandatory scroll-smooth no-scrollbar sm:-mx-6 sm:auto-cols-[68%] sm:px-6 md:auto-cols-[48%] lg:mx-0 lg:grid-flow-row lg:grid-cols-2 lg:auto-cols-auto lg:overflow-visible lg:px-0 lg:pb-0"
                            aria-label="Enrollment plan carousel"
                        >
                            {plans.map((plan) => (
                                <PlanCard key={plan.name} {...plan} />
                            ))}
                        </div>
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
        <article className="flex min-h-[420px] min-w-0 snap-center flex-col rounded-md bg-[#102016] p-5 text-[#F8F4EC] shadow-[0_18px_50px_rgba(28,37,19,0.18)] md:min-h-[460px] md:rounded-[32px] md:p-7">
            {badge ? (
                <p className="mb-5 w-fit rounded-full bg-[#DDE7C8]/15 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.08em] text-[#DDE7C8]">
                    {badge}
                </p>
            ) : null}

            <div>
                <h3 className="text-2xl font-semibold leading-tight md:text-3xl">
                    {name}
                </h3>
                <p className="mt-2 text-base leading-7 text-[#D5D1C5] md:text-lg">
                    {description}
                </p>
            </div>

            <div className="mt-8">
                {originalPrice ? (
                    <p className="text-xl font-semibold text-[#8D8A80] line-through md:text-2xl">
                        {originalPrice}
                    </p>
                ) : null}
                <div className="mt-1 flex flex-wrap items-end gap-2">
                    <p className="text-5xl font-semibold leading-none md:text-6xl">
                        {price}
                    </p>
                    <p className="pb-2 text-base font-medium text-[#B7B29F]">
                        / batch
                    </p>
                </div>
            </div>

            <ul className="mt-8 space-y-3 text-sm font-medium leading-7 text-[#E3DFD2] md:space-y-4 md:text-base">
                {features.map((feature) => (
                    <li key={feature} className="flex gap-3">
                        <span className="text-[#F8F4EC]">✓</span>
                        <span>{feature}</span>
                    </li>
                ))}
            </ul>

            <a
                href={href}
                className="mt-auto block rounded-full bg-[#F8F4EC] px-6 py-4 text-center text-sm font-extrabold text-[#102016] transition hover:bg-white"
            >
                {cta}
            </a>
        </article>
    );
}
