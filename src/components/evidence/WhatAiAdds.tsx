import { whatAiAdds, whatAiAddsSentence } from "@/lib/review/what-ai-adds";

const SHORT: Record<string, string> = { none: "No AI", regs: "Regulations alone", poms: "Manual alone", referee: "Both reviewers, referee" };

/**
 * What the AI adds, measured on the recorded run with no model call: a router that never reads the bill and always takes
 * the route safe under both readings, beside each reviewer alone and the referee (src/lib/review/what-ai-adds.ts).
 */
export function WhatAiAdds() {
  const t = whatAiAdds();
  return (
    <section id="what-ai-adds" className="ev-ai" aria-labelledby="ev-ai-h">
      <h3 id="ev-ai-h">What the AI adds, measured</h3>
      <p className="page-prose">{whatAiAddsSentence()}</p>
      <div className="doc-table-wrap ev-alone" tabIndex={0} role="region" aria-label="A router with no AI beside each reviewer alone and the referee, all bills">
        <table className="doc-table ev-table">
          <thead>
            <tr>
              <th scope="col">All {t.bills} bills</th>
              {t.columns.map((c) => (
                <th key={c.id} scope="col" title={c.label} data-ref={c.id === "referee" ? "" : undefined}>
                  {SHORT[c.id]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Her check kept whole</th>
              {t.columns.map((c) => (
                <td key={c.id} className="tabular" data-label={SHORT[c.id]} data-ref={c.id === "referee" ? "" : undefined}>
                  {c.whole} of {t.bills}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Wrong routes accepted</th>
              {t.columns.map((c) => (
                <td key={c.id} className="tabular" data-label={SHORT[c.id]} data-ref={c.id === "referee" ? "" : undefined}>
                  {c.wrong}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Settled with nothing left for her to do: paid straight to the business, of the {t.payable} that are not housing</th>
              {t.columns.map((c) => (
                <td key={c.id} className="tabular" data-label={SHORT[c.id]} data-ref={c.id === "referee" ? "" : undefined}>
                  {c.direct} of {t.payable}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted tech-only">
        src/lib/review/what-ai-adds.ts: the router with no AI is routeForDecision(gift, &quot;unsure&quot;) on every bill, scored against the true label as scripts/run-eval.ts scores the others, at the
        run&rsquo;s amount and date; the other columns are the recorded outcomes in content/eval-results.json.
      </p>
    </section>
  );
}
