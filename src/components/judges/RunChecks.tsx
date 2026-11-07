"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Latest = { data?: { run: { runId: string } | null }; error?: { message: string } };

/** Start the outside checks on Render Workflows, then wait for the run to file its results and refresh the panel. */
export function RunChecks({ canStart, onDone }: { canStart: boolean; onDone?: () => void }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [note, setNote] = useState("");

  const start = async () => {
    setState("running");
    setNote("Starting the run on Render Workflows…");
    try {
      const r = await fetch("/api/checks/start", { method: "POST" });
      const j = (await r.json()) as { data?: { task_run_id: string }; error?: { message: string } };
      if (!j.data) {
        setState("error");
        setNote(j.error?.message ?? "The run did not start.");
        return;
      }
      const id = j.data.task_run_id;
      setNote(`Task run ${id} started. Every check runs as its own task, in parallel, with retries. This takes about a minute.`);
      const until = Date.now() + 6 * 60_000;
      while (Date.now() < until) {
        await new Promise((res) => setTimeout(res, 4000));
        const l = (await (await fetch("/api/checks/latest", { cache: "no-store" })).json()) as Latest;
        if (l.data?.run?.runId === id) {
          setState("done");
          setNote(`Task run ${id} finished. The results are below.`);
          if (onDone) onDone();
          else router.refresh();
          return;
        }
      }
      setState("error");
      setNote(`Task run ${id} is still going. Reload the page in a minute to see it.`);
    } catch {
      setState("error");
      setNote("Could not reach the server. Check your connection and try again.");
    }
  };

  if (!canStart) {
    return <p className="nc-note muted">The button to start a run lives on the hosted demo, where the workflow runs. The latest run is shown below.</p>;
  }
  return (
    <div className="nc-bar">
      <button type="button" className="btn btn-primary" onClick={start} disabled={state === "running"}>
        {state === "running" ? "Running on Render Workflows" : "Run the checks now"}
      </button>
      <p className="nc-note" role="status" aria-live="polite" data-tone={state === "error" ? "attention" : undefined}>
        {note}
      </p>
    </div>
  );
}
