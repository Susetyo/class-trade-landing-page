import type { ReactNode } from "react";

const mappingCards = [
    {
        title: "Mapping 1: Context",
        variant: "fibonacci",
    },
    {
        title: "Mapping 2: Zones",
        variant: "zones",
    },
    {
        title: "Mapping 3: The Setup",
        variant: "setup",
    },
];

const reviewCards = [
    {
        title: "Trade Execution / PnL",
        quote: "Trading sekarang nggak deg-degan karena plan-nya jelas.",
        member: "Member A",
        variant: "execution",
    },
    {
        title: "Notion Trading Journal",
        quote: "Punya personal lab sendiri bikin evaluasi tiap loss jadi jauh lebih logis.",
        member: "Member B",
        variant: "journal",
    },
    {
        title: "Discord Community Review",
        quote: "Nggak gampang FOMO karena checklist entry-nya ketat banget.",
        member: "Member C",
        variant: "community",
    },
];

export function Curriculum() {
    return (
        <section id="inside-the-lab" className="relative z-10 md:px-8 md:py-20">
            <div className="mx-auto max-w-7xl overflow-hidden border border-[#E4DDCE] bg-white shadow-[0_24px_70px_rgba(28,37,19,0.1)] sm:p-5 md:rounded-[44px] md:p-10">
                <div className="relative overflow-hidden bg-[#F1EAD8] p-5 md:rounded-[32px] md:p-8 lg:p-10">
                    <div className="noise pointer-events-none absolute inset-0 opacity-0" />
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(104,135,66,0.18),transparent_36%)]" />

                    <div className="relative grid gap-8 lg:grid-cols-[1.35fr_0.65fr] lg:items-start">
                        <div>
                            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#365C2A] sm:text-sm md:tracking-[0.24em]">
                                Inside The Lab
                            </p>
                            <h2 className="mt-5 max-w-4xl text-4xl font-extrabold leading-tight text-[#102016] sm:text-5xl md:mt-6 md:text-7xl lg:text-8xl lg:leading-[0.92]">
                                See the exact process our members use every day.
                            </h2>
                        </div>
                        <p className="max-w-md text-base leading-7 text-[#3C4636] md:text-lg md:leading-8 lg:pt-16">
                            Take a peek at how our community actually trades. No
                            signals, no guesswork, just clear market mapping,
                            disciplined execution, and strict journal
                            evaluations.
                        </p>
                    </div>

                    <div className="relative mt-10">
                        <PhaseLabel>Phase 1: Mapping The Market</PhaseLabel>
                        <div
                            className="-mx-5 mt-4 grid auto-cols-[86%] grid-flow-col gap-4 overflow-x-auto px-5 pb-4 snap-x snap-mandatory scroll-smooth no-scrollbar sm:auto-cols-[68%] md:-mx-8 md:auto-cols-[48%] md:px-8 lg:mx-0 lg:grid-flow-row lg:grid-cols-3 lg:auto-cols-auto lg:overflow-visible lg:px-0 lg:pb-0"
                            aria-label="Phase 1 mapping carousel"
                        >
                            {mappingCards.map((card) => (
                                <LabCard key={card.title} title={card.title}>
                                    <ChartMockup variant={card.variant} />
                                </LabCard>
                            ))}
                        </div>
                    </div>

                    <div className="relative mt-8">
                        <PhaseLabel>Phase 2: Feedback & Review</PhaseLabel>
                        <div
                            className="-mx-5 mt-4 grid auto-cols-[86%] grid-flow-col gap-4 overflow-x-auto px-5 pb-4 snap-x snap-mandatory scroll-smooth no-scrollbar sm:auto-cols-[68%] md:-mx-8 md:auto-cols-[48%] md:px-8 lg:mx-0 lg:grid-flow-row lg:grid-cols-3 lg:auto-cols-auto lg:overflow-visible lg:px-0 lg:pb-0"
                            aria-label="Phase 2 review carousel"
                        >
                            {reviewCards.map((card) => (
                                <ReviewCard key={card.title} {...card} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

function PhaseLabel({ children }: { children: string }) {
    return (
        <p className="text-center text-xs font-extrabold uppercase tracking-[0.14em] text-[#365C2A] sm:text-sm sm:tracking-[0.22em]">
            <span className="text-[#8D8C59]">[ </span>
            {children}
            <span className="text-[#8D8C59]"> ]</span>
        </p>
    );
}

function LabCard({ title, children }: { title: string; children: ReactNode }) {
    return (
        <article className="min-w-0 snap-center overflow-hidden rounded-[24px] border border-[#E4DDCE] bg-white p-3 shadow-[0_16px_38px_rgba(28,37,19,0.1)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-[#8D8C59]/50 sm:p-4 md:rounded-[28px]">
            {children}
            <h3 className="mt-4 text-xl font-semibold text-[#102016] md:text-2xl">
                {title}
            </h3>
        </article>
    );
}

function ReviewCard({
    title,
    quote,
    member,
    variant,
}: {
    title: string;
    quote: string;
    member: string;
    variant: string;
}) {
    return (
        <article className="min-w-0 snap-center overflow-hidden rounded-[24px] border border-[#E4DDCE] bg-white p-3 shadow-[0_16px_38px_rgba(28,37,19,0.1)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-[#8D8C59]/50 sm:p-4 md:rounded-[28px]">
            <ChartMockup variant={variant} />
            <p className="mt-4 text-base leading-7 text-[#102016] md:text-lg">
                &quot;{quote}&quot;
            </p>
            <p className="mt-4 text-base font-semibold text-[#365C2A]">
                - {member}
            </p>
        </article>
    );
}

function ChartMockup({ variant }: { variant: string }) {
    if (variant === "journal") {
        return <JournalMockup />;
    }

    if (variant === "community") {
        return <CommunityMockup />;
    }

    if (variant === "execution") {
        return <ExecutionMockup />;
    }

    return (
        <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-white/10 bg-[#171B22]">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(241,243,243,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(241,243,243,0.05)_1px,transparent_1px)] bg-[size:28px_28px]" />
            <svg
                viewBox="0 0 420 236"
                className="absolute inset-0 h-full w-full"
                role="img"
                aria-label="Trading chart mockup"
            >
                <path
                    d="M30 170 L98 145 L154 162 L214 94 L276 125 L356 76"
                    fill="none"
                    stroke="#8D8C59"
                    strokeWidth="3"
                />
                <path
                    d="M44 192 L126 118 L190 132 L270 78 L380 86"
                    fill="none"
                    stroke="rgba(241,243,243,0.5)"
                    strokeWidth="2"
                />
                <rect
                    x="198"
                    y="68"
                    width="146"
                    height="34"
                    fill="rgba(141,140,89,0.32)"
                />
                <rect
                    x="84"
                    y="142"
                    width="180"
                    height="28"
                    fill="rgba(141,140,89,0.24)"
                />
                {variant === "zones" && (
                    <>
                        <rect
                            x="182"
                            y="82"
                            width="172"
                            height="24"
                            fill="none"
                            stroke="#A5A4A1"
                            strokeWidth="2"
                        />
                        <rect
                            x="118"
                            y="136"
                            width="208"
                            height="26"
                            fill="none"
                            stroke="#A5A4A1"
                            strokeWidth="2"
                        />
                    </>
                )}
                {variant === "setup" && (
                    <>
                        <path
                            d="M44 122 C92 82 142 158 202 112 C260 68 308 104 376 58"
                            fill="none"
                            stroke="#6C8F75"
                            strokeWidth="9"
                            opacity="0.65"
                        />
                        <rect
                            x="254"
                            y="82"
                            width="68"
                            height="42"
                            fill="rgba(42,165,112,0.42)"
                            stroke="#6FD59E"
                            strokeWidth="2"
                        />
                    </>
                )}
                {Array.from({ length: 16 }).map((_, index) => {
                    const x = 34 + index * 22;
                    const high = 58 + ((index * 37) % 88);
                    const low = high + 42 + ((index * 13) % 36);
                    const close = high + 16 + ((index * 11) % 46);
                    const isUp = index % 3 !== 0;

                    return (
                        <g key={x}>
                            <line
                                x1={x}
                                x2={x}
                                y1={high}
                                y2={low}
                                stroke={isUp ? "#27B49E" : "#E75E59"}
                                strokeWidth="2"
                            />
                            <rect
                                x={x - 5}
                                y={isUp ? close - 26 : close}
                                width="10"
                                height="26"
                                fill={isUp ? "#27B49E" : "#E75E59"}
                                rx="2"
                            />
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

function ExecutionMockup() {
    return (
        <div className="aspect-[16/9] overflow-hidden rounded-2xl border border-white/10 bg-[#F1F3F3] p-3 text-[#0E0C0A]">
            <div className="grid h-full grid-cols-[0.82fr_1fr] gap-3">
                <div className="rounded-xl bg-[#D8EFC4] p-3">
                    <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#4F8B20]">
                        PnL
                    </p>
                    <p className="mt-4 text-4xl font-extrabold">+8.4%</p>
                    <p className="mt-2 text-sm font-semibold text-[#4B5D42]">
                        Plan followed
                    </p>
                </div>
                <div className="space-y-2">
                    {["Entry", "Risk", "Target", "Review"].map(
                        (item, index) => (
                            <div
                                key={item}
                                className="flex items-center justify-between rounded-lg bg-[#0E0C0A]/10 px-3 py-2 text-sm font-bold"
                            >
                                <span>{item}</span>
                                <span>{index < 3 ? "Done" : "Next"}</span>
                            </div>
                        ),
                    )}
                </div>
            </div>
        </div>
    );
}

function JournalMockup() {
    return (
        <div className="aspect-[16/9] overflow-hidden rounded-2xl border border-white/10 bg-[#111820] p-4">
            <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold text-[#F1F3F3]">
                    Trading Journal
                </p>
                <span className="rounded-full bg-[#8D8C59]/20 px-3 py-1 text-xs font-bold text-[#D6D1A2]">
                    Review
                </span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs text-[#A5A4A1]">
                {["Pair", "Setup", "Risk", "Evaluation"].map((item) => (
                    <div key={item} className="rounded-lg bg-white/[0.06] p-2">
                        {item}
                    </div>
                ))}
            </div>
            <div className="mt-3 space-y-2">
                {[1, 2, 3].map((item) => (
                    <div
                        key={item}
                        className="h-7 rounded-lg bg-gradient-to-r from-white/15 to-white/[0.04]"
                    />
                ))}
            </div>
        </div>
    );
}

function CommunityMockup() {
    return (
        <div className="aspect-[16/9] overflow-hidden rounded-2xl border border-white/10 bg-[#171717] p-4">
            <div className="grid h-full grid-cols-[72px_1fr] gap-3">
                <div className="space-y-2">
                    {[1, 2, 3, 4].map((item) => (
                        <div
                            key={item}
                            className="h-9 rounded-xl bg-white/[0.08]"
                        />
                    ))}
                </div>
                <div className="space-y-3">
                    {[1, 2, 3].map((item) => (
                        <div
                            key={item}
                            className="rounded-xl bg-white/[0.07] p-3"
                        >
                            <div className="h-3 w-2/3 rounded-full bg-white/25" />
                            <div className="mt-2 h-3 w-full rounded-full bg-white/10" />
                            <div className="mt-2 h-3 w-4/5 rounded-full bg-white/10" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
