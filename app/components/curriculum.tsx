import Image from "next/image";
import fibonacciImage from "../../public/images/mapping-fibonaci.jpeg";
import orderBlockImage from "../../public/images/mapping-orderblock.jpeg";
import adxImage from "../../public/images/mapping-adx.jpeg";
import testimonialOne from "../../public/images/testimoni-1.jpeg";
import testimonialTwo from "../../public/images/testimoni-2.jpeg";
import testimonialThree from "../../public/images/testimoni-3.jpeg";
import type { ReactNode } from "react";

const mappingCards = [
    {
        title: "Fibonaci",
        image: fibonacciImage,
        alt: "Contoh chart mapping Fibonaci",
    },
    {
        title: "Order Block",
        image: orderBlockImage,
        alt: "Contoh chart mapping Order Block",
    },
    {
        title: "Indicator ADX",
        image: adxImage,
        alt: "Contoh chart mapping dengan Indicator ADX",
    },
];

const reviewCards = [
    {
        title: "Wawasan baru, berkat belajar bersama",
        body: "Anggota komunitas berbagi rasa terima kasih kepada para mentor karena telah membantu mereka mengenal trading dan membuka wawasan baru.",
        image: testimonialOne,
        href: "/images/testimoni-1.jpeg",
        alt: "Testimoni anggota grup yang merasa terbantu dan mendapat wawasan baru tentang trading dari para mentor.",
    },
    {
        title: "Mulai belajar mapping sendiri",
        body: "Salah satu anggota membagikan hasil praktiknya sambil berterima kasih atas ilmu yang membantunya belajar melakukan mapping secara mandiri.",
        image: testimonialTwo,
        href: "/images/testimoni-2.jpeg",
        alt: "Testimoni anggota yang membagikan hasil praktik trading dan bercerita sedang belajar mapping sendiri.",
    },
    {
        title: "Menerapkan ilmu Ichimoku dan ADX",
        body: "Yulia Rahma berbagi pengalamannya menggunakan Ichimoku dan ADX, serta menyampaikan apresiasi kepada para mentor atas ilmu yang dirasakan bermanfaat.",
        image: testimonialThree,
        href: "/images/testimoni-3.jpeg",
        alt: "Testimoni Yulia Rahma tentang manfaat belajar Ichimoku dan ADX bersama para mentor di komunitas.",
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
                                    <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-[#171B22]">
                                        <Image
                                            src={card.image}
                                            alt={card.alt}
                                            fill
                                            sizes="(min-width: 1024px) 360px, (min-width: 768px) 48vw, (min-width: 640px) 68vw, 86vw"
                                            className="object-contain"
                                        />
                                    </div>
                                </LabCard>
                            ))}
                        </div>
                    </div>

                    <div className="relative mt-8">
                        <PhaseLabel>Phase 2: Feedback & Review</PhaseLabel>
                        <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-7 text-[#3C4636] sm:text-base">
                            Cerita dari anggota komunitas: membuka wawasan, belajar mapping sendiri,
                            dan menerapkan ilmu dari para mentor.
                        </p>
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

function ReviewCard({ title, body, image, href, alt }: (typeof reviewCards)[number]) {
    return (
        <article className="min-w-0 snap-center overflow-hidden rounded-[24px] border border-[#E4DDCE] bg-white p-3 shadow-[0_16px_38px_rgba(28,37,19,0.1)] transition duration-300 hover:-translate-y-1 hover:border-[#8D8C59]/50 sm:p-4 md:rounded-[28px]">
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Lihat testimoni lengkap: ${title} (tab baru)`}
                className="group block rounded-2xl"
            >
                <div className="relative aspect-[9/20] overflow-hidden rounded-2xl bg-[#111B25]">
                    <Image
                        src={image}
                        alt={alt}
                        fill
                        sizes="(min-width: 1024px) 360px, (min-width: 768px) 48vw, (min-width: 640px) 68vw, 86vw"
                        className="object-contain"
                    />
                </div>
                <span className="mt-3 flex items-center justify-between text-xs font-semibold text-[#365C2A] group-hover:underline">
                    Lihat testimoni lengkap <span aria-hidden="true">↗</span>
                </span>
            </a>
            <h3 className="mt-4 text-xl font-semibold leading-snug text-[#102016]">{title}</h3>
            <p className="mt-3 text-sm leading-7 text-[#3C4636]">{body}</p>
        </article>
    );
}
