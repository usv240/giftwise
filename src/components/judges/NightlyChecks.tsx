import { connection } from "next/server";
import { latestRun, workflowTask, type CheckResult } from "@/lib/checks";
import { RunChecks } from "./RunChecks";

const GROUPS: { id: CheckResult["group"]; title: string }[] = [
  { id: "case", title: "Failure cases, against the PayPal sandbox" },
  { id: "path", title: "The judges' path, page by page" },
  { id: "api", title: "The public API" },
];
const WHEN = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" });

function ago(min: number) {
  if (min < 1) return "just now";
  if (min < 60) return `${min} ${min === 1 ? "minute" : "minutes"} ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  return `${Math.round(h / 24)} days ago`;
}

/** The latest outside check: what Render Workflows ran against the hosted demo, and a button to run it again. */
export async function NightlyChecks() {
  await connection();
  const run = await latestRun();
  const canStart = Boolean(workflowTask());
  if (!run) {
    return (
      <div className="nc" data-ui>
        <RunChecks canStart={canStart} />
        <p className="nc-empty">No run has been filed yet on this server. The first nightly run fills this in.</p>
      </div>
    );
  }
  const where = run.source === "render-workflow" ? `on Render Workflows${run.runId ? `, task run ${run.runId}` : ""}` : "locally, in development";
  const secs = Math.max(1, Math.round((Date.parse(run.finishedAt) - Date.parse(run.startedAt)) / 1000));
  return (
    <div className="nc" data-ui>
      <p className="nc-verdict" data-all={run.passed === run.total ? "" : undefined}>
        <span className="tabular">
          {run.passed} of {run.total}
        </span>{" "}
        checks passed {ago(run.ageMinutes)}.
      </p>
      <p className="nc-meta muted">
        {WHEN.format(new Date(run.finishedAt))} ET, {where}. Every check ran at once and the whole run took {secs} seconds.
      </p>
      <RunChecks canStart={canStart} />
      <div className="nc-groups">
        {GROUPS.map((g) => {
          const rows = run.results.filter((r) => r.group === g.id);
          if (!rows.length) return null;
          return (
            <section key={g.id} className="nc-group" aria-label={g.title}>
              <h3>
                {g.title} <span className="muted tabular">{rows.filter((r) => r.ok).length}/{rows.length}</span>
              </h3>
              <ul>
                {rows.map((r) => (
                  <li key={r.id} data-ok={r.ok ? "" : undefined}>
                    <span className="nc-state">{r.ok ? "Passed" : "Needs a look"}</span>
                    <span className="nc-title">{r.title}</span>
                    <span className="nc-ms tabular muted tech-only">{r.ms >= 1000 ? `${(r.ms / 1000).toFixed(1)} s` : `${r.ms} ms`}</span>
                    <span className="nc-detail tech-only">{r.detail}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
