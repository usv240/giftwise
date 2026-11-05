"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import { initialReport } from "./report";
import type { GiftRow, MonthRow } from "@/lib/dashboard/data";

/**
 * While Studio loads: the dashboard's own layout, each card at its final size with its title, and a flat block where
 * its figures or chart will be. Nothing moves when the data lands, and nothing spins.
 */
function StudioSkeleton() {
  const page = initialReport.pages[0];
  const layout = Object.entries(page.widgetLayout ?? {}).flatMap(([id, l]) => (l ? [{ id, l }] : []));
  return (
    <div className="fd fd-wait">
      <div className="fd-bar">
        <p className="muted">Filter by giver, or switch to editing to build your own view.</p>
        <span className="fd-skel-btn" aria-hidden="true" />
      </div>
      <p className="sr-only" role="status">
        Loading the dashboard
      </p>
      <div className="fd-studio fd-skel" aria-hidden="true">
        {layout.map(({ id, l }) => {
          const text = (page.widgets?.[id] as { format?: { title?: { text?: string } } } | undefined)?.format?.title?.text;
          return (
            <div key={id} className="fd-skel-card" data-k={id} style={{ gridColumn: `${l.xTrack + 1} / span ${l.xSpan}`, gridRow: `${l.yTrack + 1} / span ${l.ySpan}` }}>
              {text && <p className="fd-skel-title">{text}</p>}
              <div className="fd-skel-block" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// AG Studio runs in the browser only; until it loads, the page shows the skeleton above.
const FamilyStudio = dynamic(() => import("./FamilyStudio"), { ssr: false, loading: () => <StudioSkeleton /> });

/** Studio is laid out for a laptop or larger. On a phone the page shows the year's totals as a list instead. */
const WIDE = "(min-width: 701px)";
const watchWide = (onChange: () => void) => {
  const m = window.matchMedia(WIDE);
  m.addEventListener("change", onChange);
  return () => m.removeEventListener("change", onChange);
};

export function FamilyDashboard(props: { gifts: GiftRow[]; months: MonthRow[] }) {
  // null on the server and the first paint: the skeleton shows (CSS hides it on a phone) until the width is known.
  const wide = useSyncExternalStore<boolean | null>(watchWide, () => window.matchMedia(WIDE).matches, () => null);
  if (wide === null) return <StudioSkeleton />;
  if (!wide) return null;
  return <FamilyStudio {...props} />;
}
