import { metrics } from "../data";

export function Metrics() {
    return (
        <section id="program" className="relative z-10 px-4 py-16 md:px-8 md:py-20">
            <div className="mx-auto max-w-7xl">
                <div className="mb-8 max-w-3xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#827971]">
                        Community Growth
                    </p>
                    <h2 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[#F1F3F3] md:text-6xl">
                        Built with a growing trading community.
                    </h2>
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
        <div className="group relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.04] p-6 transition hover:border-[#8D8C59]/45 hover:bg-white/[0.07] md:p-8">
            <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#F1F3F3]/30 to-transparent opacity-0 transition group-hover:opacity-100" />
            <p className="text-6xl font-semibold tracking-[-0.07em] text-[#F1F3F3] md:text-7xl">
                {value}
            </p>
            <p className="mt-4 text-base font-semibold uppercase tracking-[0.18em] text-[#A5A4A1]">
                {label}
            </p>
        </div>
    );
}
