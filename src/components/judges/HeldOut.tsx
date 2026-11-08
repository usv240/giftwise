import data from "../../../content/eval/held-out.json";
import r from "../../../content/eval/held-out-results.json";
import main from "../../../content/eval/ssa-examples-results.json";

const date = (iso: string) => new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" });
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: Number.isInteger(n) ? 0 : 2 });
const MEASURE: Record<string, string> = { after_infrequent: "income after the one-off exclusion", ism_value: "in-kind support", ssi_amount: "SSI amount" };

/**
 * The held-out check: SSA examples that were never scored or used to change the engine, run on the engine frozen at
 * one commit, every result shown, including the miss and the two corrections made after the first run.
 */
export function HeldOut() {
  const s = r.summary;
  return (
    <section id="held-out" className="page-section" aria-labelledby="held-out-h">
      <h2 id="held-out-h">Examples the engine never saw</h2>
      <p className="page-prose jp-intro">
        After the {main.summary.cases} examples above, the engine was frozen at commit <code>{r.engine.commit}</code> (rules {r.engine.rules_version}) and run on worked examples from SSA&rsquo;s manual that had never been
        scored or used to change it. <strong className="tabular">{s.engine_matches} of {s.cases}</strong> match SSA&rsquo;s answer. Gift cards are entered the way Giftwise treats every gift card, as cash,
        a choice made before the run. Run {date(r.ran_at)}, with no model call.
      </p>
      <div className="doc-table-wrap" tabIndex={0} role="region" aria-label="Held-out examples, case by case">
        <table className="doc-table">
          <thead>
            <tr>
              <th scope="col">SSA&rsquo;s example</th>
              <th scope="col">SSA&rsquo;s answer</th>
              <th scope="col">The frozen engine</th>
            </tr>
          </thead>
          <tbody>
            {r.cases.map((c) => (
              <tr key={c.id}>
                <td>
                  {c.title}
                  <span className="ev-basis">
                    <a className="text-link" href={c.url} target="_blank" rel="noreferrer">
                      {c.cite}
                    </a>
                    , {c.part}
                  </span>
                </td>
                <td>{c.ssa_answer}</td>
                <td>
                  {c.match ? "Matches" : "Differs"}: {c.engine_counts ? "counts" : "does not count"}
                  {c.values.map((v) => `; ${MEASURE[v.measure]} ${v.month} ${money(v.got)}`).join("")}.
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="page-prose">
        The one that differs is the office-supply certificate SSA does not count: it can buy neither food nor shelter and cannot be resold. Entered as cash, the engine counts it, so Giftwise would send the
        giver to the supplies themselves; her check stays whole either way. Not scored: {data.not_scored.map((n) => n.what.charAt(0).toLowerCase() + n.what.slice(1)).join("; ")}.
      </p>
      <p className="page-prose muted">
        Corrected after the first run ({r.first_run.engine_matches} of {r.first_run.cases}):{" "}
        {data.corrections.map((c) => `${c.case.split(", ").map((id) => data.cases.find((x) => x.id === id)?.title ?? id).join(" and ")}: ${c.what}`).join(" ")} scripts/run-held-out.ts on the engine copied out of git at{" "}
        {r.engine.commit} (tree {r.engine.git_tree_src_lib_rules.slice(0, 10)}); tests/held-out.test.ts checks the current engine gives the same answers.
      </p>
    </section>
  );
}
