"use client";

import { useCallback, useEffect, useState } from "react";
import { RunChecks } from "./RunChecks";

type Group = "case" | "path" | "api";
type Result = { id: string; group: Group; title: string; ok: boolean; detail: string; ms: number };
type Run = { source: string; runId: string; passed: number; total: number; results: Result[]; startedAt: string; finishedAt: string };
type Latest = { run: Run | null; canStart: boolean };

const GROUPS: { id: Group; title: string }[] = [
  { id: "case", title: "Failure cases, against the PayPal sandbox" },
  { id: "path", title: "The product path, page by page" },
  { id: "api", title: "The public API" },
];
const WHEN = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" });
/** Runs filed before the page was renamed carry its old title. */
const titleOf = (t: string) => (t === "For judges" ? "Evidence" : t);

/** Whether a run checked exactly today's list: the same checks, each with the same promise. */
function sameList(run: Run, current: { id: string; title: string }[]) {
  if (run.results.length !== current.length) return false;
  const want = new Map(current.map((c) => [c.id, c.title]));
  return run.results.every((r) => want.get(r.id) === titleOf(r.title));
}

/** The latest outside check, read from GET /api/checks/latest, with the time it ran and what each check found. */
export function NightlyLive({ current, nightly }: { current: { id: string; title: string }[]; nightly: string }) {
  const [latest, setLatest] = useState<Latest | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  const load = useCallback(async () => {
    try {
      const j = await (await fetch("/api/checks/latest", { cache: "no-store" })).json();
      setLatest({ run: j.data?.run ?? null, canStart: Boolean(j.data?.can_start) });
      setUnreachable(false);
    } catch {
      setUnreachable(true);
    }
  }, []);
  useEffect(() => {
    // The first read happens once the page is in the browser; the button's refresh calls it again.
    void Promise.resolve().then(load);
  }, [load]);

  if (!latest) {
    return (
      <div className="jx-result nc" data-ui aria-busy={!unreachable}>
        <p className="nc-verdict">{unreachable ? "The latest run could not be read just now." : "Reading the latest run…"}</p>
        <p className="nc-meta muted">
          {current.length} checks run every night at {nightly}, and on demand.
        </p>
      </div>
    );
  }
  const { run, canStart } = latest;
  if (!run) {
    return (
      <div className="jx-result nc" data-ui>
        <RunChecks canStart={canStart} onDone={load} />
        <p className="nc-empty">No run has been filed on this server yet. The nightly run at {nightly} fills this in.</p>
      </div>
    );
  }
  const hosted = run.source === "render-workflow";
  const secs = Math.max(1, Math.round((Date.parse(run.finishedAt) - Date.parse(run.startedAt)) / 1000));
  const where = hosted ? `on Render Workflows${run.runId ? `, task run ${run.runId}` : ""}` : "on the developer's machine";
  const groups = GROUPS.map((g) => ({ ...g, rows: run.results.filter((r) => r.group === g.id) })).filter((g) => g.rows.length);
  const earlier = !sameList(run, current);
  return (
    <>
      <div className="jx-result nc" data-ui>
        <p className="nc-verdict" data-all={run.passed === run.total ? "" : undefined}>
          <span className="tabular">
            {run.passed} of {run.total}
          </span>{" "}
          checks passed in the latest run.
        </p>
        <p className="nc-meta muted">
          Last run <time dateTime={run.finishedAt}>{WHEN.format(new Date(run.finishedAt))} ET</time>, {where}. Every check ran at once and the whole run took {secs} seconds. The next nightly run starts at{" "}
          {nightly}.
        </p>
        {earlier && (
          <p className="nc-meta muted">
            This run used an earlier list of {run.total} checks. The next run uses today&rsquo;s {current.length}.
          </p>
        )}
        <RunChecks canStart={canStart} onDone={load} />
      </div>
      <div className="jx-more">
        <details className="jx-disc">
          <summary>All {run.total} checks, with each result</summary>
          <div className="jx-body">
            <div className="nc-groups">
              {groups.map((g) => (
                <section key={g.id} className="nc-group" aria-label={g.title}>
                  <h3>
                    {g.title}{" "}
                    <span className="muted tabular">
                      {g.rows.filter((r) => r.ok).length}/{g.rows.length}
                    </span>
                  </h3>
                  <ul>
                    {g.rows.map((r) => (
                      <li key={r.id} data-ok={r.ok ? "" : undefined}>
                        <span className="nc-state">{r.ok ? "Passed" : "Not passed"}</span>
                        <span className="nc-title">{titleOf(r.title)}</span>
                        <span className="nc-ms tabular muted tech-only">{r.ms >= 1000 ? `${(r.ms / 1000).toFixed(1)} s` : `${r.ms} ms`}</span>
                        {/* A check that did not pass says what it found in either view. */}
                        <span className={r.ok ? "nc-detail tech-only" : "nc-detail"}>{r.detail}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </details>
      </div>
    </>
  );
}
