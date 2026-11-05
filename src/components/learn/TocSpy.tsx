"use client";

import { useEffect } from "react";

/**
 * Marks the contents link of the section being read with aria-current, so the sticky list shows where you are. The links
 * work without it; this only adds the marker.
 */
export function TocSpy({ nav }: { nav: string }) {
  useEffect(() => {
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(`${nav} a[href^="#"]`));
    const byId = new Map(links.map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
    const sections = [...byId.keys()].map((id) => document.getElementById(id)).filter((s): s is HTMLElement => Boolean(s));
    if (!sections.length) return;
    const visible = new Set<string>();
    const mark = () => {
      // The first section on screen, in page order; past the last one, keep the last.
      const id = sections.find((s) => visible.has(s.id))?.id;
      if (!id) return;
      for (const [k, a] of byId) {
        if (k === id) a.setAttribute("aria-current", "location");
        else a.removeAttribute("aria-current");
      }
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        mark();
      },
      { rootMargin: "-20% 0px -60% 0px" },
    );
    for (const s of sections) io.observe(s);
    return () => io.disconnect();
  }, [nav]);
  return null;
}
