type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  body?: string;
  align?: "left" | "center";
  tone?: "light" | "dark";
};

export function SectionHeading({
  eyebrow,
  title,
  body,
  align = "left",
  tone = "dark",
}: SectionHeadingProps) {
  const isCentered = align === "center";
  const eyebrowColor = tone === "light" ? "text-[#534C29]" : "text-[#365C2A]";
  const bodyColor = tone === "light" ? "text-[#6C6662]" : "text-[#3C4636]";

  return (
    <div className={isCentered ? "text-center" : undefined}>
      <p className={`text-xs font-extrabold uppercase tracking-[0.18em] sm:text-sm md:font-bold md:tracking-[0.22em] ${eyebrowColor}`}>{eyebrow}</p>
      <h2 className="mt-4 text-4xl font-extrabold leading-tight text-[#102016] sm:text-5xl md:mt-5 md:text-7xl md:leading-[0.96]">
        {title}
      </h2>
      {body ? <p className={`mt-5 max-w-2xl text-base leading-7 md:mt-7 md:text-xl md:leading-9 ${bodyColor}`}>{body}</p> : null}
    </div>
  );
}
