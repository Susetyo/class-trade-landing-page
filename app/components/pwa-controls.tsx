"use client";
import { useEffect, useState } from "react";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaControls() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => { /* Installation remains optional. */ });
    }
    const standalone = window.matchMedia("(display-mode: standalone)");
    const sync = () => {
      const installed = standalone.matches || (navigator as Navigator & { standalone?: boolean }).standalone;
      setIsInstalled(Boolean(installed));
      setIos(!installed && /iPad|iPhone|iPod/.test(navigator.userAgent));
      if (installed) setPrompt(null);
    };
    const available = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    const installed = () => { setIsInstalled(true); setPrompt(null); setIos(false); setMessage("App installed. See you in the lab!"); };
    sync();
    window.addEventListener("beforeinstallprompt", available);
    window.addEventListener("appinstalled", installed);
    standalone.addEventListener("change", sync);
    return () => { window.removeEventListener("beforeinstallprompt", available); window.removeEventListener("appinstalled", installed); standalone.removeEventListener("change", sync); };
  }, []);
  async function install() {
    if (!prompt || installing) return;
    setInstalling(true);
    try { await prompt.prompt(); await prompt.userChoice; setPrompt(null); }
    catch { setMessage("Use your browser menu to install the app or add it to your home screen."); }
    finally { setInstalling(false); }
  }
  return <aside aria-label="Install academy app" className="pwa-controls relative border-t border-[#D8DDCE] bg-[#EFF4E8] px-6 py-8 text-center text-sm text-[#365C2A]">
    <p className="font-bold">A little more clarity. Wherever you go.</p>
    {prompt ? <button className="primary-button mt-4" disabled={installing} onClick={install}>{installing ? "Opening installer…" : "Install the academy app ↓"}</button> : <p className="mx-auto mt-2 max-w-lg text-xs leading-6">{isInstalled ? "Your academy is ready. Keep learning, one thoughtful decision at a time." : ios ? "In Safari, tap Share, then Add to Home Screen to keep the academy close." : "Keep the academy close: use your browser’s install or Add to Home Screen option when available."}</p>}
    <p role="status" className="mt-2 text-xs">{message}</p>
  </aside>;
}
