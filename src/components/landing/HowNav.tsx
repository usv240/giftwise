"use client";

import { useEffect, useState } from "react";

/**
 * Previous and Next for "How it works" on a phone, where the four steps sit in one row that scrolls sideways. The next
 * step always peeks in at the edge, every step stays in the page (a swipe, the keyboard or these buttons reach it),
 * and on a wide screen, where all four show at once, CSS hides the buttons.
 */
export function HowNav({ track, count }: { track: string; count: number }) {
  const [at, setAt] = useState(0);

  useEffect(() => {
    const el = document.getElementById(track);
    if (!el) return;
    // The row takes keyboard focus only while it scrolls, so a wide screen gets no empty tab stop.
    const focusable = () => {
      if (el.scrollWidth > el.clientWidth + 1) el.tabIndex = 0;
      else el.removeAttribute("tabindex");
    };
    const onScroll = () => {
      const step = (el.firstElementChild as HTMLElement | null)?.offsetWidth || el.clientWidth;
      const end = el.scrollLeft >= el.scrollWidth - el.clientWidth - 2;
      setAt(end ? count - 1 : Math.round(el.scrollLeft / step));
    };
    focusable();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", focusable);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", focusable);
    };
  }, [track, count]);

  const go = (d: number) => {
    const el = document.getElementById(track);
    const next = el?.children[Math.max(0, Math.min(count - 1, at + d))] as HTMLElement | undefined;
    if (!el || !next) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // The row is positioned, so each step's offsetLeft is measured from the row's own start.
    el.scrollTo({ left: next.offsetLeft, behavior: still ? "auto" : "smooth" });
  };

  return (
    <div className="how-nav">
      <span className="how-count tabular" aria-hidden="true">
        {at + 1} of {count}
      </span>
      <button type="button" className="how-arrow" aria-label="Previous step" aria-controls={track} aria-disabled={at === 0 || undefined} onClick={() => go(-1)}>
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button type="button" className="how-arrow" aria-label="Next step" aria-controls={track} aria-disabled={at === count - 1 || undefined} onClick={() => go(1)}>
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
