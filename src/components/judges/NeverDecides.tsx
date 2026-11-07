/**
 * What the AI never decides: each money decision, made only by code, with the file that makes it (Technical view).
 * Each line was checked against that code; no model output reaches any of them except through the rules engine.
 */
const DECIDED_BY_CODE = [
  {
    what: "How much each payee gets",
    how: "The rules split the giver's amount across the open needs, to the cent, never past what a need still needs.",
    where: "routeGift() in src/lib/routing.ts. The server routes every gift again and ignores any split a browser or an agent sends (src/lib/paypal/gift-order.ts).",
  },
  {
    what: "Which rule applies",
    how: "Code maps each kind of need to its rule. A reviewer's reading of a bill counts only when both agree and both quotes check out word for word; otherwise code takes the route that is safe under either reading.",
    where: "evaluateGift() in src/lib/rules/engine.ts; referee() and routeForDecision() in src/lib/review/referee.ts.",
  },
  {
    what: "The benefit arithmetic",
    how: "Every exclusion, the in-kind support amount and the check two months later, computed by the rules engine.",
    where: "computeMonth() in src/lib/rules/engine.ts. The bill, reviewer and rulebook prompts tell the model never to compute benefit amounts (src/lib/ai/tasks.ts, src/lib/ai/reviewers.ts, src/lib/rulebook.ts).",
  },
  {
    what: "When money moves",
    how: "Only when a person acts: a giver approves in PayPal, or an organization sends its Payouts batch. Each capture happens once. An AI assistant can start a checkout, never approve one.",
    where: "captureAndRecord() with a PayPal-Request-Id in src/lib/paypal/capture.ts. startRoutedGift() in src/lib/paypal/gift-order.ts and POST /api/paypal/orders refuse any gift that would leave the check below the no-gift check.",
  },
  {
    what: "Who gets paid",
    how: "The need's route picks the payee from accounts the server holds. Housing needs go to her ABLE account.",
    where: "routeNeed() in src/lib/manage.ts and payeeEmail() in src/lib/households.ts.",
  },
  {
    what: "Her report to Social Security",
    how: "Built from the payments by code, in full and in Easy Read, with no model call.",
    where: "buildReport() in src/lib/report/ssa.ts and src/lib/report/easy.ts.",
  },
] as const;

export function NeverDecides() {
  return (
    <>
      <dl className="nd">
        {DECIDED_BY_CODE.map((d) => (
          <div key={d.what} className="nd-item">
            <dt>{d.what}</dt>
            <dd>{d.how}</dd>
            <dd className="nd-where tech-only">{d.where}</dd>
          </div>
        ))}
      </dl>
      <p className="nd-model" data-ui>
        <span className="nd-model-k">What the model does instead. </span>
        It reads bills and fundraiser pages into fields (who, how much, what kind) that the organizer sees before making a page, compares a bill with two rulebooks and quotes each word for word, and explains answers
        in plain words. Everything it reads goes through the rules engine before any of it reaches money.
      </p>
    </>
  );
}
