import { metrics } from "../data";

export function Metrics() {
  return (
    <section id="program" className="relative z-10 px-4 py-20 md:px-8">
      <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
        {metrics.map(([value, label]) => (
          <MetricCard key={label} value={value} label={label} />
        ))}
      </div>
    </section>
  );
}

function MetricCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[36px] border border-white/10 bg-white/[0.04] p-8 transition hover:bg-white/[0.07]">
      <p className="text-6xl font-semibold tracking-[-0.07em] text-[#F1F3F3]">{value}</p>
      <p className="mt-4 text-lg text-[#A5A4A1]">{label}</p>
    </div>
  );
}
