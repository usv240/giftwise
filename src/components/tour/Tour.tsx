"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { TOUR, TOUR_KEY, onStepPage } from "./steps";

const read = () => {
  try {
    const v = sessionStorage.getItem(TOUR_KEY);
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
};
const write = (i: number | null) => {
  try {
    if (i === null) sessionStorage.removeItem(TOUR_KEY);
    else sessionStorage.setItem(TOUR_KEY, String(i));
  } catch {
    /* Private windows can refuse storage; the tour then lasts for this page only. */
  }
};

/**
 * The guided tour's card. It follows the judge from page to page in one tab: the step lives in sessionStorage,
 * the card names what to look at, and the element it describes gets a ring. Escape ends it.
 */
export function Tour() {
  const router = useRouter();
  const pathname = usePathname();
  const [step, setStep] = useState<number | null>(null);
  const [here, setHere] = useState(false);
  const head = useRef<HTMLHeadingElement>(null);

  // Read the step after each navigation, and mark the element it describes once it has rendered.
  useEffect(() => {
    const i = read();
    // The step is stored outside React, so it is read after each navigation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStep(i !== null && i >= 0 && i < TOUR.length ? i : null);
  }, [pathname]);

  useEffect(() => {
    document.querySelectorAll("[data-tour-target]").forEach((el) => el.removeAttribute("data-tour-target"));
    if (step === null) return;
    const s = TOUR[step];
    const on = onStepPage(s, window.location);
    // Whether the page in view is the step's own page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHere(on);
    if (!on) return;
    let tries = 0;
    const timer = window.setInterval(() => {
      const el = document.querySelector<HTMLElement>(s.target);
      if (el || ++tries > 40) window.clearInterval(timer);
      if (!el) return;
      el.setAttribute("data-tour-target", "");
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    }, 200);
    head.current?.focus({ preventScroll: true });
    return () => window.clearInterval(timer);
  }, [step, pathname]);

  const go = useCallback(
    (i: number | null) => {
      write(i);
      setStep(i);
      if (i === null) return;
      const s = TOUR[i];
      if (!onStepPage(s, window.location)) router.push(s.path);
    },
    [router],
  );

  useEffect(() => {
    if (step === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") go(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, go]);

  if (step === null) return null;
  const s = TOUR[step];
  const last = step === TOUR.length - 1;
  return (
    <aside className="tour" aria-label="Guided tour" data-ui>
      <p className="tour-k tabular">
        Tour, stop {step + 1} of {TOUR.length}
      </p>
      <h2 className="tour-title" ref={head} tabIndex={-1}>
        {s.title}
      </h2>
      <p className="tour-text">{s.text}</p>
      <div className="tour-actions">
        <button type="button" className="tour-btn" data-quiet="" onClick={() => go(step - 1)} disabled={step === 0}>
          Back
        </button>
        {here ? (
          <button type="button" className="tour-btn" onClick={() => go(last ? null : step + 1)}>
            {last ? "Finish" : "Next"}
          </button>
        ) : (
          <button type="button" className="tour-btn" onClick={() => router.push(s.path)}>
            Open this stop
          </button>
        )}
        <button type="button" className="tour-end" onClick={() => go(null)}>
          End tour
        </button>
      </div>
    </aside>
  );
}

/** The button on /judges that starts the tour from the first stop. */
export function TourStart() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn btn-ink tour-start"
      onClick={() => {
        write(0);
        router.push(TOUR[0].path);
      }}
    >
      Take the guided tour
    </button>
  );
}
