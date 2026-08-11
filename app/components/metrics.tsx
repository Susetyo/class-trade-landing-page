import { metrics } from "../data";

export function Metrics() {
    return (
        <section id="program" className="relative z-10 px-4 py-10 md:px-8 md:py-20">
            <div className="mx-auto max-w-7xl">
                <div className="mb-6 flex items-end justify-between gap-4 md:mb-8 md:block">
                    <div className="max-w-3xl">
                        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#365C2A] md:tracking-[0.24em]">
                            Join The Movement
                        </p>
                        <h2 className="mt-3 text-3xl font-extrabold leading-tight text-[#102016] sm:text-4xl md:text-6xl">
                            Grow alongside hundreds of active traders.
                        </h2>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    {metrics.map(([value, label]) => (
                        <MetricCard key={label} value={value} label={label} />
                    ))}
                </div>
            </div>
        </section>
    );
}

function MetricCard({ value, label }: { value: string; label: string }) {
    return (
        <div className="group relative overflow-hidden rounded-[26px] border border-[#E4DDCE] bg-white p-5 shadow-[0_18px_45px_rgba(28,37,19,0.08)] transition hover:border-[#8D8C59]/45 hover:bg-white md:rounded-[32px] md:p-8">
            <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#F1F3F3]/30 to-transparent opacity-0 transition group-hover:opacity-100" />
            <p className="text-5xl font-extrabold text-[#102016] md:text-7xl">
                {value}
            </p>
            <p className="mt-4 text-sm font-bold uppercase tracking-[0.16em] text-[#365C2A] md:text-base md:tracking-[0.18em]">
                {label}
            </p>
        </div>
    );
}
