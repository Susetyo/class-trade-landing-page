import { modules } from "../data";

export function Curriculum() {
  return (
    <section id="kurikulum" className="relative z-10 px-4 py-20 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.28em] text-[#8D8C59]">Curriculum</p>
            <h2 className="mt-5 max-w-4xl text-5xl font-semibold leading-[0.96] tracking-[-0.07em] md:text-7xl">
              A clear path for beginner traders.
            </h2>
          </div>
          <p className="max-w-sm text-lg leading-8 text-[#A5A4A1]">
            Semua module dibuat untuk membantu peserta memahami konsep, praktik, dan evaluasi.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => (
            <ModuleCard key={module.number} {...module} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ModuleCard({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <article className="group rounded-[36px] border border-white/10 bg-white/[0.04] p-7 transition duration-300 hover:-translate-y-1 hover:bg-[#F1F3F3] hover:text-[#0E0C0A]">
      <p className="text-sm font-extrabold text-[#8D8C59] transition group-hover:text-[#534C29]">{number}</p>
      <h3 className="mt-10 text-3xl font-semibold tracking-[-0.05em]">{title}</h3>
      <p className="mt-5 leading-7 text-[#A5A4A1] transition group-hover:text-[#6C6662]">{body}</p>
    </article>
  );
}
