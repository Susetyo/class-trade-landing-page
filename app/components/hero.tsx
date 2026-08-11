const memberStats = [
    ["Total Members", "1K+"],
    ["Completed", "200+"],
    ["Member Score", "82%"],
];

const mentors = ["Ov Kafeinmatcha", "Frida Kucing Hoki", "AHS ADX"];

export function Hero() {
    return (
        <section className="relative z-10 pb-10 pt-24 sm:pb-20 sm:pt-32 md:px-8 md:pb-28 md:pt-40">
            <div className="mx-auto max-w-7xl">
                <div className="grid min-w-0 items-end gap-10 overflow-hidden bg-[#FBF8F1] p-5 shadow-[0_24px_70px_rgba(28,37,19,0.12)] md:p-10 lg:grid-cols-[1.05fr_0.95fr]">
                    <div className="min-w-0">
                        <div className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-[#D8D0BD] bg-white/70 px-3 py-2 text-[11px] font-medium text-[#365C2A] shadow-sm sm:mb-7 sm:gap-3 sm:px-4 sm:text-sm">
                            <span className="h-2 w-2 rounded-full bg-[#6C8F45]" />
                            <span>Registration Open • Live Online Classes</span>
                        </div>

                        <h1 className="max-w-[330px] break-words text-[43px] font-extrabold leading-[0.98] text-[#102016] sm:max-w-5xl sm:text-6xl md:text-[92px] md:leading-[0.9] lg:text-[118px] xl:text-[132px]">
                            Build Your Trading Edge with Kafeinmatcha
                        </h1>

                        <div className="mt-6 max-w-4xl md:mt-7">
                            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#365C2A] md:tracking-[0.24em]">
                                Mentor Lineup
                            </p>
                            <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-[26px] bg-white/88 shadow-[0_18px_45px_rgba(28,37,19,0.12)] sm:grid-cols-3 md:grid md:gap-3 md:overflow-visible md:rounded-none md:bg-transparent md:shadow-none">
                                {mentors.map((mentor, index) => (
                                    <div
                                        key={mentor}
                                        className="flex min-h-[104px] flex-col items-center justify-center gap-2 border-r border-[#D8D0BD] px-2 py-4 text-center last:border-r-0 md:min-h-0 md:flex-row md:justify-start md:gap-3 md:rounded-lg md:border md:border-[#E4DDCE] md:bg-white/80 md:px-4 md:py-3 md:text-left md:shadow-sm md:backdrop-blur md:transition md:hover:border-[#8D8C59]/45 md:hover:bg-white"
                                    >
                                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EFF4E8] text-xs font-extrabold text-[#102016] md:h-9 md:w-9">
                                            {String(index + 1).padStart(2, "0")}
                                        </span>
                                        <span className="min-w-0 text-[11px] font-semibold leading-tight text-[#102016] md:text-base">
                                            {mentor}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mt-7 max-w-3xl gap-6 md:mt-8 md:grid-cols-[1fr_0.8fr] md:items-end">
                            <p className="max-w-[310px] text-[15px] leading-7 text-[#2E352C] sm:text-lg md:max-w-none md:text-xl md:leading-8">
                                A structured program designed to help you read
                                the market, master risk management, and build a
                                solid trading plan. Start trading independently
                                no more relying on signals.
                            </p>
                        </div>
                        <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center">
                            <div className="flex w-full flex-col gap-3 sm:flex-row md:justify-end">
                                <a
                                    href="#pricing"
                                    className="flex items-center justify-center gap-2 rounded-xl bg-[#365C2A] px-6 py-4 text-sm font-extrabold uppercase tracking-[0.04em] text-[#F8F4EC] transition hover:bg-[#2D4D24] sm:px-7 md:rounded-full md:normal-case md:tracking-normal"
                                >
                                    Join the Batch
                                </a>
                                <a
                                    href="#inside-the-lab"
                                    className="flex items-center justify-center gap-2 rounded-xl border border-[#D8D0BD] px-6 py-3.5 text-sm font-bold text-[#365C2A] transition hover:bg-white/60 sm:px-7 sm:py-4 md:rounded-full"
                                >
                                    Explore The Lab
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
