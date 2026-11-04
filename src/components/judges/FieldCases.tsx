import data from "../../../content/eval/field-cases.json";
import results from "../../../content/eval/field-cases-results.json";
import { usd } from "@/lib/rules";

type Dataset = { id: string; status: string; title: string; not_scored_reason?: string; source: { court: string; citation: string; url: string; date: string }; determination?: { held?: string } };
type Result = { id: string; title: string; url: string; engine: { match: boolean; rule_ids: string[] }; determination: { held?: string; overpayment?: number | null }; dollars?: { computed?: boolean; kept_per_month?: number | null } };

const CASES = data.cases as unknown as Dataset[];
const ROWS = results.cases as unknown as Result[];
const S = results.summary;
const D = S.dollars;
/** Court captions name the person; the docket number and court find the opinion without repeating the name. */
const docket = (c: Dataset) => `${c.source.court.replace(/^U\.S\. /, "")}, ${c.source.citation.replace(/^.*?,\s*(No\.)/, "$1")}`;
const byId = new Map(CASES.map((c) => [c.id, c]));

/** Real SSI cases decided by SSA and reviewed by federal courts, run through the rules engine. */
export function FieldCases() {
  const ran = new Date(results.ran_at).toLocaleDateString("en-US", { dateStyle: "medium" });
  const notScored = CASES.filter((c) => c.status !== "scored");
  return (
    <div className="sx" data-ui>
      <p className="sx-score">
        <span className="tabular">
          {S.agreed} of {S.scored}
        </span>{" "}
        real cases: the rules engine reaches the outcome SSA and the court did.
      </p>
      <p className="sx-vs">
        Whether the help counts: <strong className="tabular">{S.agreed_on_whether_it_counts} of {S.scored}</strong>. The way it is valued, where the opinion names it:{" "}
        <strong className="tabular">
          {S.rule_agreed} of {S.rule_named_in_opinion}
        </strong>
        . Amounts the opinion states:{" "}
        <strong className="tabular">
          {S.amounts_agreed} of {S.amounts_stated}
        </strong>
        .
      </p>
      <p className="sx-vs">
        In {D.as_shown_in_the_opinions.cases_where_routing_keeps_money} of these cases the facts allow a route Giftwise uses. The same help, routed that way, keeps{" "}
        <strong className="tabular">{usd(D.as_shown_in_the_opinions.kept_per_month_2026)} a month</strong> at 2026 rates. If each person qualified for an ABLE account, {D.if_each_person_is_able_eligible.cases_where_routing_keeps_money} cases
        and <span className="tabular">{usd(D.if_each_person_is_able_eligible.kept_per_month_2026)}</span> a month. In {S.overpayments_stated.scored.length} of the cases the opinion states what SSA asked to be paid back:{" "}
        <strong className="tabular">{usd(S.overpayments_stated.scored_total)}</strong>, from money family members gave or deposited for them.
      </p>
      <p className="sx-meta muted">
        From {S.opinions_downloaded} federal court opinions in GovInfo, which are public domain (17 U.S.C. 105): {S.opinions_read_closely} read closely, {S.cases} kept, {S.scored} scored. Every
        scored case is one where SSA counted the help and the court agreed; the opinions where help did not count turned on loans, shared rent or trusts, which Giftwise does not model, so they are
        listed with the reason instead of scored. Passages and amounts are checked against each opinion&rsquo;s text. The person&rsquo;s name is left out; each case links to the opinion. Run {ran}.
      </p>

      <div className="sx-findings">
        <div className="sx-finding">
          <p className="sx-finding-k">Found and fixed</p>
          <p>
            A woman living in her sons&rsquo; home bought her own food, and SSA valued her shelter under the presumed maximum value rule, not the one-third reduction. The current rule, 20 CFR
            416.1131(a)(3) as amended in 2024, applies the one-third reduction only when the household provides all meals. Giftwise applied it to anyone living in another person&rsquo;s home.
          </p>
          <p>The engine now checks who provides the meals, with a unit test, and agrees with SSA on that case.</p>
        </div>
      </div>

      <ol className="sx-list">
        {ROWS.filter((r) => byId.get(r.id)?.status === "scored").map((r) => {
          const c = byId.get(r.id)!;
          const kept = r.dollars?.computed ? (r.dollars.kept_per_month ?? 0) : null;
          return (
            <li key={r.id}>
              <details className="sx-case">
                <summary>
                  <span className="sx-title">{r.title}</span>
                  <span className="sx-sides">
                    <span className="sx-side">
                      <span className="sx-who">Giftwise</span>{" "}
                      <span className="sx-verdict" data-ok={r.engine.match ? "" : undefined}>
                        {r.engine.match ? "Agrees" : "Differs"}
                      </span>
                    </span>
                    <span className="sx-side tabular" data-slot="routed">
                      {kept !== null && kept > 0 && (
                        <>
                          <span className="sx-who">Routed</span> keeps {usd(kept)}/mo
                        </>
                      )}
                    </span>
                  </span>
                </summary>
                <div className="sx-body">
                  <p>
                    <strong>Held:</strong> {r.determination.held ?? c.determination?.held}
                  </p>
                  {r.determination.overpayment ? <p className="muted">Overpayment SSA assessed: {usd(r.determination.overpayment)}.</p> : null}
                  <p className="sx-rules tech-only">Rules {r.engine.rule_ids.join(", ")}</p>
                  <p>
                    <a className="text-link" href={c.source.url} target="_blank" rel="noreferrer">
                      {docket(c)}
                    </a>
                  </p>
                </div>
              </details>
            </li>
          );
        })}
      </ol>

      <details className="sx-out">
        <summary>
          {notScored.length} cases Giftwise does not model, and why
        </summary>
        <ul>
          {notScored.map((c) => (
            <li key={c.id}>
              <strong>{c.title}</strong>{" "}
              <a className="text-link muted" href={c.source.url} target="_blank" rel="noreferrer">
                ({docket(c)})
              </a>
              . {c.not_scored_reason}
            </li>
          ))}
        </ul>
      </details>
      <p className="sx-cmd muted tech-only">npx tsx --env-file=.env.local scripts/run-field-cases.ts</p>
    </div>
  );
}
