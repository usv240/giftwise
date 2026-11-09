import { ADVERSARIAL_BILL_LINE, runAdversarial } from "@/lib/review/adversarial";
import { AUTHORITY } from "@/lib/review/referee";
import { checkMonthName, usd } from "@/lib/rules";

const ANSWER: Record<string, string> = { shelter: "a housing cost", not_shelter: "not a housing cost", unclear: "not settled" };

/**
 * The referee's recorded adversarial set: five reviewer outputs built in code against the real rulebook passages (one
 * honest pair and four a model could send and must not be trusted), each run through the same referee() and
 * routeForDecision() the API uses. No model is called.
 */
export function Adversarial() {
  const rows = runAdversarial();
  const month = checkMonthName(rows[0].routed.routes[0].paymentMonth);
  return (
    <div className="jx-more">
      <details className="jx-disc" id="referee-adversarial">
        <summary>What the referee does with a wrong quote, the wrong rulebook, a made-up citation, or two reviewers who disagree</summary>
        <div className="jx-body">
          <p className="jp-test-what">
            Five reviewer outputs written in code against the real passages in content/authorities.json, for the {ADVERSARIAL_BILL_LINE}. Each runs through the same referee and router the
            API uses. Paid to the company under the housing reading, her {month} check would be {usd(rows[0].ifPaidShop)}; the right column is the check after the route the code took.
          </p>
          <div className="doc-table-wrap" tabIndex={0} role="region" aria-label="The referee's adversarial set, case by case">
            <table className="doc-table">
              <thead>
                <tr>
                  <th scope="col">What the reviewers sent</th>
                  <th scope="col">What the referee did</th>
                  <th scope="col">Paid to</th>
                  <th scope="col" className="num">
                    Her {month} check
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.sent}
                      <span className="ev-basis">
                        {r.reviews.map((v) => `${AUTHORITY[v.authority].name}: ${ANSWER[v.answer] ?? v.answer}, citing ${v.passage_id}`).join("; ")}
                      </span>
                    </td>
                    <td>{r.did}</td>
                    <td>{r.routed.route === "able" ? "Her ABLE account" : "The company"}</td>
                    <td className="tabular num" data-kept={r.checkWhole ? "" : undefined}>
                      {usd(r.check)} <span className="ev-basis">{month}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="jp-test-cmd tabular">src/lib/review/adversarial.ts; tests/referee-adversarial.test.ts</p>
        </div>
      </details>
    </div>
  );
}
