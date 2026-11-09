"use client";

import { useEffect, useState } from "react";
import type { AiBudget as Budget } from "@/lib/ai/budget";

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** The line itself, from the budget the server reports; shared so a run's own answer can update it in place. */
export function budgetLine(b: Budget, recorded = false): { tone: "live" | "replayed" | "saved"; text: string } {
  if (b.next === "live") return { tone: "live", text: `The next run is live. Today's AI budget: ${money(b.left)} of ${money(b.cap)} left.` };
  // The assistant on /agents has no replay: when it cannot run live, its recorded run stays in view.
  if (recorded && b.why === "budget") return { tone: "saved", text: `Today's AI budget of ${money(b.cap)} is spent, so the recorded run stays in view. It resets at midnight Pacific time.` };
  if (recorded) return { tone: "saved", text: "No AI key on this server, so the recorded run stays in view." };
  if (b.next === "replayed" && b.why === "budget")
    return { tone: "replayed", text: `Today's AI budget of ${money(b.cap)} is spent, so the samples replay Claude's recorded answers through the same code. It resets at midnight Pacific time.` };
  if (b.next === "replayed") return { tone: "replayed", text: "No AI key on this server, so the samples replay Claude's recorded answers through the same code; other documents need the key." };
  return { tone: "saved", text: "No AI key on this server, so the saved run is shown." };
}

/**
 * Beside a live AI step: today's spend against the site's daily budget (from ai_usage, via /api/live/ai-budget), and
 * whether the next run is live or replayed. `refresh` changes after a run, so the figure follows it.
 */
export function AiBudget({ refresh = 0, id, recorded = false }: { refresh?: number; id?: string; recorded?: boolean }) {
  const [b, setB] = useState<Budget | null>(null);
  useEffect(() => {
    let gone = false;
    fetch("/api/live/ai-budget")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => !gone && j?.data && setB(j.data as Budget))
      .catch(() => undefined);
    return () => {
      gone = true;
    };
  }, [refresh]);
  const line = b ? budgetLine(b, recorded) : null;
  return (
    <p id={id} className="ai-budget" data-tone={line?.tone ?? "checking"}>
      {line ? line.text : "Checking today's AI budget…"}
    </p>
  );
}
