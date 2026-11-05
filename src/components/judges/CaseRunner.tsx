"use client";

import { useState } from "react";
import { CASES } from "@/lib/judges/list";

type Result = { id: string; outcome: "handled" | "problem"; evidence: string[]; ms: number };

/** Runs every failure case live against the PayPal sandbox and shows what happened, case by case. */
export function CaseRunner() {
  const [results, setResults] = useState<Record<string, Result> | null>(null);
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [note, setNote] = useState("");

  async function run() {
    setState("running");
    setNote("");
    try {
      const r = await fetch("/api/judges/run", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "The checks did not run. Please try again.");
      setResults(Object.fromEntries((j.data.results as Result[]).map((x) => [x.id, x])));
      setNote(`${j.data.handled} of ${j.data.total} handled, live against the PayPal sandbox.`);
      setState("done");
    } catch (e) {
      setNote((e as Error).message);
      setState("error");
    }
  }

  return (
    <div className="cases">
      <div className="cases-bar">
        <button type="button" className="btn btn-primary" onClick={run} disabled={state === "running"}>
          {state === "running" ? "Running against PayPal…" : results ? "Run all eight again" : "Run all eight checks"}
        </button>
        <p className="cases-note" role="status" data-tone={state === "error" ? "attention" : undefined}>
          {state === "running" ? "Creating real sandbox orders. This takes about 15 seconds." : note || "Each run creates small sandbox orders. No real money moves."}
        </p>
      </div>
      {/* Eight separate cases, not steps: a plain list, no numbers. */}
      <ul className="cases-list">
        {CASES.map((c) => {
          const r = results?.[c.id];
          return (
            <li key={c.id} className="case" data-ui data-outcome={r?.outcome}>
              <div className="case-body">
                <p className="case-title">{c.title}</p>
                <p className="case-expected">{c.expected}</p>
                {r && (
                  <ul className="case-evidence">
                    {r.evidence.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="case-state">{r ? (r.outcome === "handled" ? "Handled" : "Needs a look") : state === "running" ? "Running" : "Not run yet"}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
