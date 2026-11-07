"use client";

import { useEffect } from "react";

export default function ScrollAnimations() {
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const hero = document.querySelector<HTMLElement>(".pm-hero");
    const preview = document.querySelector<HTMLElement>(".pm-overview-preview");
    let frame = 0;

    const update = () => {
      frame = 0;
      const scroll = window.scrollY;
      const viewport = window.innerHeight;
      if (hero) hero.style.setProperty("--pm-scroll-remaining", String(preference.matches ? 0 : 1 - Math.min(1, Math.max(0, scroll / 240))));
      if (preview) {
        const top = preview.getBoundingClientRect().top + scroll;
        const start = Math.max(0, top - viewport * 0.85);
        const progress = Math.min(1, Math.max(0, (scroll - start) / Math.max(1, viewport * 0.5)));
        preview.style.setProperty("--pm-scroll-remaining", String(preference.matches ? 0 : 1 - progress));
      }
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    preference.addEventListener("change", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      preference.removeEventListener("change", schedule);
      hero?.style.removeProperty("--pm-scroll-remaining");
      preview?.style.removeProperty("--pm-scroll-remaining");
    };
  }, []);

  return null;
}
