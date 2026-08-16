"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { toolNavItems } from "../data";

export function ToolsSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-[#E4DDCE] bg-[#FBF8F1]/95 px-5 py-4 backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-[#102016] text-sm text-[#F8F4EC]">
            🍵
          </div>
          <span className="text-sm font-extrabold uppercase tracking-[0.14em] text-[#102016]">
            Kafeinmatcha
          </span>
        </Link>
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setOpen(true)}
          className="grid h-10 w-10 place-items-center rounded-full border border-[#E4DDCE] text-[#102016]"
        >
          <span className="flex w-5 flex-col gap-1.5">
            <span className="h-0.5 w-5 rounded-full bg-current" />
            <span className="h-0.5 w-5 rounded-full bg-current" />
            <span className="h-0.5 w-3 rounded-full bg-current" />
          </span>
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[#102016]/50 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[80%] flex-col bg-[#FBF8F1] p-6 shadow-2xl">
            <SidebarContent pathname={pathname} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}

      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-[#E4DDCE] bg-[#FBF8F1] p-6 lg:flex">
        <SidebarContent pathname={pathname} />
      </aside>
    </>
  );
}

function SidebarContent({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <Link href="/" onClick={onNavigate} className="flex items-center gap-2.5">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-[#102016] text-lg text-[#F8F4EC]">
          🍵
        </div>
        <div className="leading-tight">
          <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-[#102016]">
            Kafeinmatcha
          </p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#365C2A]">Academy</p>
        </div>
      </Link>

      <p className="mt-10 text-xs font-extrabold uppercase tracking-[0.18em] text-[#8D8A80]">
        Tools
      </p>
      <nav className="mt-3 flex flex-col gap-1">
        {toolNavItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                active
                  ? "bg-[#365C2A] text-[#F8F4EC]"
                  : "text-[#3C4636] hover:bg-[#EFE9DA]"
              }`}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Link
        href="/"
        onClick={onNavigate}
        className="mt-auto flex items-center gap-2 rounded-2xl border border-[#E4DDCE] px-4 py-3 text-sm font-semibold text-[#3C4636] transition hover:bg-[#EFE9DA]"
      >
        <span aria-hidden="true">←</span>
        Back to site
      </Link>
    </div>
  );
}
