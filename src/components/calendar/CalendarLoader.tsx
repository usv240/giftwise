"use client";

import dynamic from "next/dynamic";
import { ensureBryntumTheme } from "./theme";

/** The Bryntum calendar runs only in the browser; the page around it renders on the server. */
export const CalendarLoader = dynamic(() => ensureBryntumTheme().then(() => import("./BenefitCalendar").then((m) => m.BenefitCalendar)), {
  ssr: false,
  loading: () => <p className="bc-loading muted">Loading the calendar&hellip;</p>,
});
