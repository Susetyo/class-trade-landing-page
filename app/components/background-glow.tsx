export function BackgroundGlow() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
      <div className="absolute left-1/2 top-[-220px] h-[560px] w-[760px] -translate-x-1/2 rounded-full bg-[#8D8C59]/20 blur-[140px]" />
      <div className="absolute right-[-180px] top-[260px] h-[520px] w-[520px] rounded-full bg-[#926C30]/20 blur-[130px]" />
      <div className="absolute bottom-[-240px] left-[-160px] h-[520px] w-[520px] rounded-full bg-[#534C29]/30 blur-[150px]" />
      <div className="noise absolute inset-0 opacity-20" />
    </div>
  );
}
