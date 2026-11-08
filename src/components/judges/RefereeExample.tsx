import Link from "next/link";
import { modelName } from "@/lib/ai/model-name";
import { AUTHORITY } from "@/lib/review/referee";
import { R, refereeExample } from "@/lib/review/example";
import { checkMonthName, usd } from "@/lib/rules";

const ANSWER: Record<string, string> = { shelter: "A housing cost", not_shelter: "Not a housing cost", unclear: "Not settled" };

/**
 * One recorded bill where the two Claude reviewers disagree, near the top of /evidence: both quotes, and the code that
 * decides where the money goes (src/lib/review/example.ts).
 */
export function RefereeExample() {
  const { c, ids, decided, routed, shop, able, payee, what } = refereeExample();
  const date = new Date(R.ran_at).toLocaleDateString("en-US", { dateStyle: "medium" });
  const where = routed.route === "able" ? "her ABLE account" : "the business";
  return (
    <section id="referee" className="jref" aria-labelledby="jref-h" data-ui>
      <div className="jref-top">
        <h2 id="jref-h" className="jref-h">
          Two Claude reviewers disagree. Code decides.
        </h2>
        <p className="jref-sub muted">
          One bill from the recorded run of {date}, read by {modelName(R.model)}. The decision and the route below are computed from that record by the same code the API runs.
        </p>
      </div>
      <p className="jref-bill">
        <span className="jref-k">The bill</span>
        <span>
          <span className="tabular">{usd(R.amount)}</span> to {payee}: {what.charAt(0).toLowerCase() + what.slice(1).replace(/\.$/, "")}.
        </span>
      </p>
      <div className="jref-votes">
        {ids.map((a, i) => {
          const v = decided.votes[i];
          return (
            <figure key={a} className="jref-vote">
              <figcaption>
                <span className="jref-who">{AUTHORITY[a].name}</span>
                <span className="jref-answer" data-answer={v.answer}>
                  {ANSWER[v.answer] ?? v.answer}
                </span>
              </figcaption>
              <p className="jref-reads muted">Reads only {AUTHORITY[a].reads}.</p>
              <blockquote className="jref-quote">
                <p>&ldquo;{c[a].quote}&rdquo;</p>
                <footer>
                  {c[a].cite}. <span className="jref-checked">{v.valid ? "Found word for word" : v.setAsideReason}</span>
                </footer>
              </blockquote>
            </figure>
          );
        })}
      </div>
      <div className="jref-call">
        <p className="jref-k">The referee, in code</p>
        <p className="jref-decision">
          {decided.agreed ? decided.summary : "Both quotes check out and the answers differ, so neither reading is acted on."} The rules engine scores each route under both readings: paying {payee} leaves her{" "}
          {checkMonthName(able.paymentMonth)} check at <span className="tabular">{usd(shop.check)}</span> if the bill is a housing cost; {where} keeps it at <span className="tabular">{usd(able.check)}</span> either way. The{" "}
          <span className="tabular">{usd(R.amount)}</span> goes to {where}.
        </p>
        <p className="jref-tech tech-only">
          referee() and routeForDecision() in src/lib/review/referee.ts, on the case {c.id} in content/eval-results.json.
        </p>
        <p className="jref-links">
          <Link className="text-link" href="/try/presets/electric-bill">
            Try the two reviewers on a bill
          </Link>
          <Link className="text-link" href="#evaluation">
            All {R.cases.length} bills, measured
          </Link>
        </p>
      </div>
    </section>
  );
}
