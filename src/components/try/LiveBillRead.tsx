"use client";

import { useState } from "react";
import type { SampleRead } from "@/lib/ai/sample-bill";
import { usd } from "@/lib/rules";

const WHY: Record<NonNullable<SampleRead["reason"]>, string> = {
  no_key: "The AI service is not connected on this server, so this is the recorded run.",
  budget: "Today's AI budget is spent, so this is the recorded run. It resets at midnight Pacific time.",
  error: "The live call did not finish, so this is the recorded run.",
};
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" });

/**
 * The one live AI step on the main path: press, and Claude reads the sample bill now; the rules engine prices what it
 * read. Counted against the site's daily AI budget; the recorded run is shown, and labelled, when that is spent or no
 * key is set.
 */
export function LiveBillRead({ cap }: { cap: number }) {
  const [state, setState] = useState<"idle" | "reading" | "done" | "failed">("idle");
  const [r, setR] = useState<SampleRead | null>(null);

  const read = async () => {
    setState("reading");
    try {
      const res = await fetch("/api/live/sample-bill", { method: "POST" });
      const j = await res.json();
      if (!res.ok || !j.data) throw new Error();
      setR(j.data as SampleRead);
      setState("done");
    } catch {
      setState("failed");
    }
  };

  return (
    <section id="read-live" className="live-read" data-ui aria-labelledby="read-live-h">
      <div className="live-read-head">
        <h2 id="read-live-h" className="presets-title">
          Read this bill live
        </h2>
        <span className="live-read-tag">Live AI</span>
      </div>
      <p className="muted">
        Claude reads the sample bill now, and the rules engine prices what it read. Each press is one Claude call, counted against the site&rsquo;s daily AI budget of {usd(cap)}.
      </p>
      <button type="button" className="btn btn-primary live-read-btn" onClick={read} disabled={state === "reading"} aria-describedby="read-live-status">
        {state === "reading" ? "Claude is reading the bill…" : r ? "Read it again" : "Read this bill live"}
      </button>
      <div id="read-live-status" aria-live="polite" className="live-read-out">
        {state === "failed" && <p data-tone="attention">The reading could not start. Please try again.</p>}
        {r && state !== "reading" && (
          <>
            <p className="live-read-mode" data-mode={r.mode}>
              {r.mode === "live" ? `Live, read ${when(r.read_at)} in ${((r.ms ?? 0) / 1000).toFixed(1)} s` : `Recorded run, ${when(r.read_at)}`}
              {r.reason ? `. ${WHY[r.reason]}` : ""}
            </p>
            <dl className="live-read-facts">
              <div>
                <dt>Claude read</dt>
                <dd>
                  {r.bill.vendor_name}, {r.bill.vendor_category === "utility" ? "a utility" : r.bill.vendor_category}, <span className="tabular">{usd(r.bill.amount_due)}</span>
                  {r.bill.due_date ? `, due ${r.bill.due_date}` : ""}
                </dd>
              </div>
              <div>
                <dt>In plain words</dt>
                <dd>{r.bill.explanation.plain}</dd>
              </div>
              <div>
                <dt>The rules engine</dt>
                <dd>
                  Paid to the company, her {r.check.month} check would be <span className="tabular">{usd(r.check.paid_to_company)}</span>; through her ABLE account it stays{" "}
                  <span className="tabular">{usd(r.check.through_able)}</span>. Claude reads; code decides the route.
                </dd>
              </div>
            </dl>
          </>
        )}
      </div>
    </section>
  );
}
