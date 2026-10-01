"use client";
import { useEffect } from "react";

export function PageMotion() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const sections = document.querySelectorAll("main > section[id]");
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.remove("reveal-pending"); observer.unobserve(entry.target); } });
    }, { threshold: 0.06 });
    sections.forEach(section => { section.classList.add("reveal-section", "reveal-pending"); observer.observe(section); });
    return () => { observer.disconnect(); sections.forEach(section => section.classList.remove("reveal-pending")); };
  }, []);
  return null;
}
