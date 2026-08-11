export function BackgroundGlow() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(180deg,#F6F2EA_0%,#EFE7D7_48%,#F6F2EA_100%)]">
      <div className="noise absolute inset-0 opacity-30" />
    </div>
  );
}
