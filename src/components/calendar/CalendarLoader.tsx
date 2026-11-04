"use client";

import dynamic from "next/dynamic";
import { ensureBryntumScript, ensureBryntumTheme } from "./theme";

/**
 * The Bryntum calendar runs only in the browser; the page around it renders on the server. The theme goes on first,
 * then Bryntum's own script, then the component that uses it.
 */
export const CalendarLoader = dynamic(() => ensureBryntumTheme().then(ensureBryntumScript).then(() => import("./BenefitCalendar").then((m) => m.BenefitCalendar)), {
  ssr: false,
  loading: () => <p className="bc-loading muted">Loading the calendar&hellip;</p>,
});
