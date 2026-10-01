"use client";

import { useRef, type ReactNode } from "react";

export function MentorCarousel({ children }: { children: ReactNode }) {
    const trackRef = useRef<HTMLDivElement>(null);

    function scrollByCard(direction: 1 | -1) {
        const track = trackRef.current;
        const card = track?.firstElementChild as HTMLElement | null;
        if (!track || !card) return;
        const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
        track.scrollBy({ left: direction * (card.offsetWidth + gap), behavior: "smooth" });
    }

    return (
        <div>
            <div className="flex items-center justify-between gap-4">
                <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#DDE7C8] sm:text-sm md:tracking-[0.24em]">
                    Meet Your Mentors
                </p>
                <div className="flex gap-2">
                    <ArrowButton label="Previous mentor" onClick={() => scrollByCard(-1)}>
                        ‹
                    </ArrowButton>
                    <ArrowButton label="Next mentor" onClick={() => scrollByCard(1)}>
                        ›
                    </ArrowButton>
                </div>
            </div>

            <div
                ref={trackRef}
                className="-mx-5 mt-8 grid auto-cols-[86%] grid-flow-col items-start gap-4 overflow-x-auto px-5 pb-4 snap-x snap-mandatory scroll-smooth scroll-px-5 no-scrollbar sm:auto-cols-[72%] md:-mx-10 md:auto-cols-[48%] md:px-10 md:scroll-px-10 lg:auto-cols-[31%]"
                aria-label="Mentor TikTok carousel"
            >
                {children}
            </div>
        </div>
    );
}

function ArrowButton({
    label,
    onClick,
    children,
}: {
    label: string;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            onClick={onClick}
            className="grid h-10 w-10 place-items-center rounded-full border border-[#DDE7C8]/30 bg-[#F6F2EA]/10 text-2xl leading-none text-[#F8F4EC] transition hover:bg-[#F6F2EA]/20"
        >
            {children}
        </button>
    );
}
