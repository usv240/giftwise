import data from "../../../content/eval/held-out.json";
import r from "../../../content/eval/held-out-results.json";
import main from "../../../content/eval/ssa-examples-results.json";
import second from "../../../content/eval/held-out-2-results.json";
import secondSet from "../../../content/eval/held-out-2.json";
import third from "../../../content/eval/held-out-3-results.json";
import thirdSet from "../../../content/eval/held-out-3.json";
import fourth from "../../../content/eval/held-out-4-results.json";
import fourthSet from "../../../content/eval/held-out-4.json";
import { HELD_OUT_2_NEW_FIELDS, HELD_OUT_3_NEW_FIELDS, HELD_OUT_4_NEW_FIELDS, heldOut2AfterFix, heldOut3AfterFix, heldOut4AfterFix, type HeldOutCase } from "@/lib/held-out";
import * as rules from "@/lib/rules";

const date = (iso: string) => new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" });
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: Number.isInteger(n) ? 0 : 2 });
const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen"];
const MEASURE: Record<string, string> = { after_infrequent: "income after the one-off exclusion", ism_value: "in-kind support", ssi_amount: "SSI amount" };

/**
 * The held-out check: SSA examples that were never scored or used to change the engine, run on the engine frozen at
 * one commit, every result shown, including the miss and the two corrections made after the first run.
 */
export function HeldOut() {
  const s = r.summary;
  // The current engine on the second set, after the rules it showed were added: labelled as such, never as held out.
  const after = heldOut2AfterFix(secondSet.cases as unknown as HeldOutCase[], rules);
  const titleOf = (id: string) => secondSet.cases.find((c) => c.id === id)?.title.toLowerCase() ?? id;
  // The third set the same way: the frozen run from its results file, and the current engine labelled as after the fix.
  const after3 = heldOut3AfterFix(thirdSet.cases as unknown as HeldOutCase[], rules);
  const titleOf3 = (id: string) => thirdSet.cases.find((c) => c.id === id)?.title.toLowerCase() ?? id;
  const s3 = third.summary;
  // The fourth set: fifteen cases, the frozen run from its results file and the current engine labelled as after the fix.
  const after4 = heldOut4AfterFix(fourthSet.cases as unknown as HeldOutCase[], rules);
  const s4 = fourth.summary;
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

      <h3 id="held-out-2" className="ev-sub">
        Five more, written before the run
      </h3>
      <p className="page-prose">
        A second set of SSA examples, each with SSA&rsquo;s answer, was written and fixed first (content/eval/held-out-2.json, git blob <code>{second.set.git_blob.slice(0, 10)}</code>), then run once on the same frozen
        engine, {date(second.ran_at)}. <strong className="tabular">{second.summary.engine_matches} of {second.summary.cases}</strong> match. The others showed three housing rules, now in the engine, each citing
        SSA&rsquo;s section: a home given as itself counts at the presumed maximum value in the month it is given (<span className="rule-id">R-SHEL-03</span>), a co-owner&rsquo;s payment counts in each month it covers (<span className="rule-id">R-SHEL-04</span>), and rent below
        market from a parent or child counts as the lesser of the market rent and that value, less the rent paid (<span className="rule-id">R-SHEL-05</span>).
      </p>
      <p className="page-prose" id="held-out-2-after">
        <strong>After the fix, not a held-out result:</strong> the three rules were written after seeing these five, so this line shows only that the current engine now follows them. On the same five as written,{" "}
        <strong className="tabular">
          {after.asWritten.matches} of {after.asWritten.cases}
        </strong>{" "}
        match. The other {WORDS[after.asWritten.misses.length]} ({after.asWritten.misses.map(titleOf).join("; ")}) turn on a fact the engine had no field for when the set was written; with that fact from each
        case&rsquo;s own situation in the new field ({after.newFields.map((id) => `“${HELD_OUT_2_NEW_FIELDS[id].fact}”`).join(" and ")}),{" "}
        <strong className="tabular">
          {after.withFields.matches} of {after.withFields.cases}
        </strong>{" "}
        match. The frozen run&rsquo;s record is unchanged.
      </p>
      <details className="dsc">
        <summary>
          <span className="dsc-k">The five cases, SSA&rsquo;s answer and the frozen engine&rsquo;s</span>
        </summary>
        <div className="doc-table-wrap" tabIndex={0} role="region" aria-label="Second held-out set, case by case">
          <table className="doc-table">
            <thead>
              <tr>
                <th scope="col">SSA&rsquo;s example</th>
                <th scope="col">SSA&rsquo;s answer</th>
                <th scope="col">The frozen engine</th>
              </tr>
            </thead>
            <tbody>
              {second.cases.map((c) => (
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
                    {c.match ? "Matches" : "Differs"}
                    {c.values.map((v) => `; ${MEASURE[v.measure]} ${v.month} ${money(v.got)}`).join("")}.
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <h3 id="held-out-3" className="ev-sub">
        A third five, written before the run
      </h3>
      <p className="page-prose">
        A third set, from sections of SSA&rsquo;s manual neither earlier set used, was written and fixed first with SSA&rsquo;s answers and the way each gift is entered (content/eval/held-out-3.json, git blob{" "}
        <code>{third.set.git_blob.slice(0, 10)}</code>), then run once on the engine frozen at commit <code>{third.engine.commit}</code>, {date(third.ran_at)}.{" "}
        <strong className="tabular">
          {s3.engine_matches} of {s3.cases}
        </strong>{" "}
        match on every value, and{" "}
        <strong className="tabular">
          {s3.counts_matches} of {s3.cases}
        </strong>{" "}
        agree with SSA on whether the gift counts. The others showed three rules, now in the engine, each citing SSA&rsquo;s section: a housing bill paid by the week counts as a monthly amount, the weekly amount
        times 13 divided by 3 (<span className="rule-id">R-SHEL-06</span>, POMS SI 00835.474 B.3); housing help for the whole household is divided among the people who live there (
        <span className="rule-id">R-SHEL-07</span>, SI 00835.350 B.4); and the part of an ABLE account over $100,000 counts toward savings, so a month over the savings limit pays no SSI, with Medicaid continuing
        when the ABLE balance is the reason (<span className="rule-id">R-ABLE-03</span> with <span className="rule-id">R-RES-01</span>, SI 01130.740 D.1).
      </p>
      <p className="page-prose" id="held-out-3-after">
        <strong>After the fix, not a held-out result:</strong> these rules were written after seeing the five, so this line shows only that the current engine now follows them. On the same five as written,{" "}
        <strong className="tabular">
          {after3.asWritten.matches} of {after3.asWritten.cases}
        </strong>{" "}
        match. The other {WORDS[after3.asWritten.misses.length]} ({after3.asWritten.misses.map(titleOf3).join("; ")}) turn on a fact the engine had no field for when the set was written; with that fact from
        each case&rsquo;s own situation in the new field ({after3.newFields.map((id) => `“${HELD_OUT_3_NEW_FIELDS[id].fact}”`).join(" and ")}),{" "}
        <strong className="tabular">
          {after3.withFields.matches} of {after3.withFields.cases}
        </strong>{" "}
        match. The frozen run&rsquo;s record is unchanged.
      </p>
      <details className="dsc">
        <summary>
          <span className="dsc-k">The third five, SSA&rsquo;s answer and the frozen engine&rsquo;s</span>
        </summary>
        <div className="doc-table-wrap" tabIndex={0} role="region" aria-label="Third held-out set, case by case">
          <table className="doc-table">
            <thead>
              <tr>
                <th scope="col">SSA&rsquo;s example</th>
                <th scope="col">SSA&rsquo;s answer</th>
                <th scope="col">The frozen engine</th>
              </tr>
            </thead>
            <tbody>
              {third.cases.map((c) => (
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
      </details>

      <h3 id="held-out-4" className="ev-sub">
        A fourth set of {WORDS[s4.cases]}, written before the run
      </h3>
      <p className="page-prose">
        A fourth set, from sections of SSA&rsquo;s manual no earlier set used (loans of food and shelter, sharing a household&rsquo;s costs, earmarked sharing, cash from outside the household, and gifts to
        children with life-threatening conditions), was written and fixed first with SSA&rsquo;s answers and the way each case is entered (content/eval/held-out-4.json, git blob{" "}
        <code>{fourth.set.git_blob.slice(0, 10)}</code>), then run once on the engine frozen at commit <code>{fourth.engine.commit}</code>, {date(fourth.ran_at)}.{" "}
        <strong className="tabular">
          {s4.engine_matches} of {s4.cases}
        </strong>{" "}
        match on every value, and{" "}
        <strong className="tabular">
          {s4.counts_matches} of {s4.cases}
        </strong>{" "}
        agree with SSA on whether the help counts. The others showed two rules, now in the engine, each citing SSA&rsquo;s section: living in someone else&rsquo;s household and paying less than a pro rata share
        of its costs, more than {money(rules.P.sharingTolerance)} short, the household&rsquo;s shelter lowers the check every month, gift or not, by the one-third reduction when it gives all meals (
        <span className="rule-id">R-SHEL-08</span>, 20 CFR 416.1133, POMS SI 00835.160 C.2, SI 00835.170, SI 00835.450); and a bona fide loan, one she must repay whatever happens with her benefits, agreed
        when it was given, with a plan she can meet, is not income, while a loan of housing counts only for what she need not repay (<span className="rule-id">R-LOAN-01</span>,{" "}
        <span className="rule-id">R-LOAN-02</span>, 20 CFR 416.1103(f), POMS SI 00835.482, SI 01120.220).
      </p>
      <p className="page-prose" id="held-out-4-after">
        <strong>After the fix, not a held-out result:</strong> these rules were written after seeing the {WORDS[s4.cases]}, so this line shows only that the current engine now follows them. On the same{" "}
        {WORDS[s4.cases]} as written,{" "}
        <strong className="tabular">
          {after4.asWritten.matches} of {after4.asWritten.cases}
        </strong>{" "}
        match: the three arrangements SSA found were not loans now count the household&rsquo;s shelter from the profile alone. With the facts {WORDS[after4.newFields.length]} cases state in the new fields
        (the loan, the household&rsquo;s costs or the person&rsquo;s share, and what the person pays, such as &ldquo;{HELD_OUT_4_NEW_FIELDS["sharing-short-by-20"].fact}&rdquo;),{" "}
        <strong className="tabular">
          {after4.withFields.matches} of {after4.withFields.cases}
        </strong>{" "}
        match. Each share is the household&rsquo;s housing costs only: food has not been one of them since September 30, 2024. The frozen run&rsquo;s record is unchanged.
      </p>
      <details className="dsc">
        <summary>
          <span className="dsc-k">The fourth set, SSA&rsquo;s answer and the frozen engine&rsquo;s</span>
        </summary>
        <div className="doc-table-wrap" tabIndex={0} role="region" aria-label="Fourth held-out set, case by case">
          <table className="doc-table">
            <thead>
              <tr>
                <th scope="col">SSA&rsquo;s example</th>
                <th scope="col">SSA&rsquo;s answer</th>
                <th scope="col">The frozen engine</th>
              </tr>
            </thead>
            <tbody>
              {fourth.cases.map((c) => (
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
      </details>
    </section>
  );
}
