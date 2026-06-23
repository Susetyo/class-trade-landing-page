const memberStats = [
    ["Total Members", "1K+"],
    ["Completed", "200+"],
    ["Member Score", "82%"],
];

const mentors = ["Ov Kafeinmatcha", "Frida Kucing Hoki", "AHS ADX"];

export function Hero() {
    return (
        <section className="relative z-10 px-4 pb-20 pt-32 md:px-8 md:pb-28 md:pt-40">
            <div className="mx-auto max-w-7xl">
                <div className="grid items-end gap-10 lg:grid-cols-[1.05fr_0.95fr]">
                    <div>
                        <div className="mb-7 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-[#A5A4A1] shadow-glow">
                            <span className="h-2 w-2 rounded-full bg-[#8D8C59]" />
                            New batch open • Live online class
                        </div>

                        <h1 className="max-w-5xl text-6xl font-semibold leading-[0.9] tracking-normal md:text-[112px] lg:text-[132px]">
                            Learn Trading With Kafeinmatcha
                        </h1>

                        <div className="mt-7 max-w-4xl">
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#827971]">
                                Mentor Lineup
                            </p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                {mentors.map((mentor, index) => (
                                    <div
                                        key={mentor}
                                        className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.045] px-4 py-3 backdrop-blur transition hover:border-[#8D8C59]/45 hover:bg-white/[0.075]"
                                    >
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F1F3F3] text-xs font-extrabold text-[#0E0C0A]">
                                            {String(index + 1).padStart(2, "0")}
                                        </span>
                                        <span className="min-w-0 text-base font-semibold leading-tight text-[#F1F3F3]">
                                            {mentor}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mt-8  max-w-3xl gap-6 md:grid-cols-[1fr_0.8fr] md:items-end">
                            <p className="text-lg leading-8 text-[#A5A4A1] md:text-xl">
                                A structured trading program designed to help
                                beginners understand the market, manage risk,
                                and build a clear trading plan without relying
                                on signals.
                            </p>
                        </div>
                        <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center">
                            <div className="flex gap-3 md:justify-end">
                                <a
                                    href="#harga"
                                    className="rounded-full flex items-center gap-2 bg-[#F1F3F3] px-7 py-4 text-sm font-extrabold text-[#0E0C0A] transition hover:bg-white"
                                >
                                    Enroll Now
                                </a>
                                <a
                                    href="#kurikulum"
                                    className="rounded-full flex items-center gap-2 border border-white/15 px-7 py-4 text-sm font-bold text-[#F1F3F3] transition hover:bg-white/10"
                                >
                                    View Curriculum
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* <HeroCard /> */}
                </div>
            </div>
        </section>
    );
}

function HeroCard() {
    return (
        <div className="relative mx-auto w-full max-w-[560px] lg:translate-y-8">
            <div className="absolute -inset-5 rounded-[44px] bg-gradient-to-br from-[#F1F3F3]/15 via-[#8D8C59]/20 to-[#926C30]/20 blur-2xl" />
            <div className="relative overflow-hidden rounded-[40px] border border-white/10 bg-[#171411]/85 p-4 shadow-2xl backdrop-blur-2xl">
                <div className="rounded-[32px] border border-white/10 bg-[#0E0C0A] p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs uppercase tracking-[0.24em] text-[#827971]">
                                Dashboard
                            </p>
                            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                                Trading Plan Index
                            </h2>
                        </div>
                        <div className="rounded-full bg-[#F1F3F3] px-4 py-2 text-sm font-extrabold text-[#0E0C0A]">
                            82%
                        </div>
                    </div>

                    <div className="mt-7 rounded-[28px] bg-[#F1F3F3] p-4 text-[#0E0C0A] sm:p-5">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-lg font-extrabold tracking-[-0.04em]">
                                Members Count
                            </p>
                            <p className="text-sm font-medium text-[#6C6662]">
                                Active community
                            </p>
                        </div>
                        <div className="mt-5 grid grid-cols-3 gap-3">
                            {memberStats.map(([label, value]) => (
                                <div
                                    key={label}
                                    className="flex min-h-28 flex-col justify-between rounded-2xl bg-[#0E0C0A]/10 p-4"
                                >
                                    <p className="text-xs font-medium leading-tight text-[#6C6662]">
                                        {label}
                                    </p>
                                    <p className="text-3xl font-extrabold tracking-[-0.06em]">
                                        {value}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <ChartCard />
                </div>
            </div>
        </div>
    );
}

function ChartCard() {
    const points = [
        [104, 142],
        [198, 102],
        [300, 67],
        [410, 42],
        [520, 30],
    ];

    return (
        <div className="mt-4 rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
            <div className="mb-4 flex items-center justify-between">
                <p className="font-semibold">Market Structure</p>
                <span className="rounded-full bg-[#8D8C59]/15 px-3 py-1 text-xs font-semibold text-[#D6D1A2]">
                    Live Case
                </span>
            </div>
            <svg viewBox="0 0 520 220" className="h-52 w-full overflow-visible">
                <defs>
                    <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
                        <stop
                            offset="0%"
                            stopColor="#F1F3F3"
                            stopOpacity="0.28"
                        />
                        <stop
                            offset="100%"
                            stopColor="#8D8C59"
                            stopOpacity="0"
                        />
                    </linearGradient>
                </defs>
                {[40, 80, 120, 160, 200].map((y) => (
                    <line
                        key={y}
                        x1="0"
                        x2="520"
                        y1={y}
                        y2={y}
                        stroke="rgba(241,243,243,0.08)"
                    />
                ))}
                <path
                    d="M0 178 C48 158 64 136 104 142 C148 148 152 96 198 102 C246 108 250 58 300 67 C352 76 358 36 410 42 C456 48 480 22 520 30 L520 220 L0 220 Z"
                    fill="url(#area)"
                />
                <path
                    className="chart-line"
                    d="M0 178 C48 158 64 136 104 142 C148 148 152 96 198 102 C246 108 250 58 300 67 C352 76 358 36 410 42 C456 48 480 22 520 30"
                    fill="none"
                    stroke="#F1F3F3"
                    strokeWidth="5"
                    strokeLinecap="round"
                />
                {points.map(([x, y]) => (
                    <circle
                        key={x}
                        cx={x}
                        cy={y}
                        r="6"
                        fill="#8D8C59"
                        stroke="#0E0C0A"
                        strokeWidth="4"
                    />
                ))}
            </svg>
        </div>
    );
}
