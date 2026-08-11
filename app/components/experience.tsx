import Script from "next/script";

const mentors = [
    {
        role: "Lead Instructor",
        name: "Ov Kafeinmatcha",
        description:
            "Focuses on market context, core trading foundations, and guiding your overall journey from a beginner to an independent trader.",
        tiktokUrl: "https://www.tiktok.com/@kafeinmatcha",
        uniqueId: "kafeinmatcha",
    },
    {
        role: "Coach",
        name: "Frida Kucing Hoki",
        description:
            "Helps you build strict risk management rules, develop a bulletproof trading plan, and maintain discipline through detailed journaling.",
        tiktokUrl: "https://www.tiktok.com/@fridayuns",
        uniqueId: "fridayuns",
    },
    {
        role: "Advanced Strategy Mentor",
        name: "AHS ADX",
        description:
            "Dives deep into market momentum, specific ADX strategies, and optimizing your technical edge for maximum accuracy in the market.",
        tiktokUrl: "https://www.tiktok.com/@banggendut13",
        uniqueId: "banggendut13",
    },
];

export function Experience() {
    return (
        <section id="tiktok" className="relative z-10 md:px-8 md:py-20">
            <div className="mx-auto max-w-7xl overflow-hidden  border border-[#E4DDCE] bg-[#102016]  shadow-[0_24px_70px_rgba(28,37,19,0.14)] sm:p-5 md:rounded-[36px] md:p-10">
                <div className="relative overflow-hidden md:rounded-[28px] bg-[#172216] p-5 md:p-10">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(104,135,66,0.28),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(14,12,10,0.35))]" />
                    <div className="noise pointer-events-none absolute inset-0 opacity-10" />

                    <div className="relative">
                        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#DDE7C8] sm:text-sm md:tracking-[0.24em]">
                            Meet Your Mentors
                        </p>

                        <div
                            className="-mx-5 mt-8 grid auto-cols-[86%] grid-flow-col items-start gap-4 overflow-x-auto px-5 pb-4 snap-x snap-mandatory scroll-smooth no-scrollbar sm:auto-cols-[72%] md:-mx-10 md:auto-cols-[48%] md:px-10 lg:mx-0 lg:grid-flow-row lg:grid-cols-3 lg:auto-cols-auto lg:overflow-visible lg:px-0 lg:pb-0"
                            aria-label="Mentor TikTok carousel"
                        >
                            {mentors.map((mentor) => (
                                <MentorTiktokCard
                                    key={mentor.uniqueId}
                                    mentor={mentor}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <Script
                src="https://www.tiktok.com/embed.js"
                strategy="lazyOnload"
            />
        </section>
    );
}

function MentorTiktokCard({ mentor }: { mentor: (typeof mentors)[number] }) {
    return (
        <article className="flex h-full min-w-0 snap-center flex-col rounded-md md:rounded-[28px]  bg-[#F6F2EA]/10 p-4 text-[#F8F4EC] shadow-2xl backdrop-blur transition hover:border-[#8D8C59]/70 md:p-5">
            <p className="text-sm font-semibold text-[#DDE7C8] md:text-base">
                {mentor.role}
            </p>
            <h3 className="mt-3 text-3xl font-extrabold leading-tight text-[#F8F4EC] md:text-3xl">
                {mentor.name}
            </h3>
            <p className="mt-4 text-sm font-medium leading-6 text-[#D5D1C5] lg:min-h-[88px] lg:leading-5">
                {mentor.description}
            </p>

            <div className="mentor-tiktok-frame mt-5 h-[410px] overflow-hidden rounded-md md:rounded-[22px] bg-[#0E0C0A]/55 shadow-[0_18px_44px_rgba(0,0,0,0.24)] sm:h-[430px] md:h-[450px] lg:h-[455px]">
                <blockquote
                    className="tiktok-embed m-0 h-full w-full"
                    cite={mentor.tiktokUrl}
                    data-unique-id={mentor.uniqueId}
                    data-embed-type="creator"
                    data-embed-from="oembed"
                    style={{ maxWidth: "100%", minWidth: "100%" }}
                >
                    <section className="grid h-full w-full place-items-center">
                        <a
                            href={mentor.tiktokUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-5xl font-black italic text-[#D6D1A2] transition hover:text-white"
                        >
                            tiktok
                        </a>
                    </section>
                </blockquote>
            </div>
        </article>
    );
}
