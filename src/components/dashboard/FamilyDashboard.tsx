"use client";

import dynamic from "next/dynamic";
import type { GiftRow, MonthRow } from "@/lib/dashboard/data";

// AG Studio runs in the browser only; the page renders a plain placeholder until it loads.
const FamilyStudio = dynamic(() => import("./FamilyStudio"), { ssr: false, loading: () => <p className="page-loading">Loading the dashboard…</p> });

export function FamilyDashboard(props: { gifts: GiftRow[]; months: MonthRow[] }) {
  return <FamilyStudio {...props} />;
}
