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
  const eyebrowColor = tone === "light" ? "text-[#534C29]" : "text-[#8D8C59]";
  const bodyColor = tone === "light" ? "text-[#6C6662]" : "text-[#A5A4A1]";

  return (
    <div className={isCentered ? "text-center" : undefined}>
      <p className={`text-sm font-bold uppercase tracking-[0.28em] ${eyebrowColor}`}>{eyebrow}</p>
      <h2 className="mt-5 text-5xl font-semibold leading-[0.96] tracking-[-0.07em] md:text-7xl">
        {title}
      </h2>
      {body ? <p className={`mt-7 max-w-2xl text-xl leading-9 ${bodyColor}`}>{body}</p> : null}
    </div>
  );
}
