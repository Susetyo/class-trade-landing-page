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
        <section id="tiktok" className="relative z-10 px-4 py-20 md:px-8">
            <div className="mx-auto max-w-7xl overflow-hidden rounded-[36px] border border-white/10 bg-[#0E0C0A] p-5 shadow-2xl md:p-10">
                <div className="relative overflow-hidden rounded-[28px] bg-[#171411] p-6 md:p-10">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(141,140,89,0.24),transparent_30%),radial-gradient(circle_at_82%_92%,rgba(146,108,48,0.18),transparent_32%),linear-gradient(90deg,rgba(14,12,10,0.08),rgba(14,12,10,0.84))]" />
                    <div className="noise pointer-events-none absolute inset-0 opacity-20" />

                    <div className="relative">
                        <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-[#8D8C59]">
                            Meet Your Mentors
                        </p>

                        <div className="mt-8 grid items-start gap-5 lg:grid-cols-3">
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
        <article className="flex flex-col rounded-[28px] border border-[#8D8C59]/45 bg-[#0E0C0A]/72 p-5 text-[#F1F3F3] shadow-2xl backdrop-blur transition hover:border-[#8D8C59]/70">
            <p className="text-base font-semibold text-[#D6D1A2]">
                {mentor.role}
            </p>
            <h3 className="mt-3 text-3xl font-extrabold leading-tight text-[#F1F3F3]">
                {mentor.name}
            </h3>
            <p className="mt-4 min-h-[88px] text-sm font-medium leading-5 text-[#A5A4A1]">
                {mentor.description}
            </p>

            <div className="mentor-tiktok-frame mt-5 h-[430px] overflow-hidden  bg-[#171411]/70 md:h-[450px] lg:h-[455px]">
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
