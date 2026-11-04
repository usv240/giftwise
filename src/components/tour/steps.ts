/** The guided tour: the five-minute path on /judges, one stop per thing to look at. */
export type TourStep = { path: string; target: string; title: string; text: string };

export const TOUR: TourStep[] = [
  {
    path: "/",
    target: ".checker",
    title: "The problem in one number",
    text: "In the Gift Checker, $1,000 sent as cash leaves Maya a $74 check two months later. Press Pay the shop: she keeps all $994.",
  },
  {
    path: "/g/maya",
    target: ".give-any",
    title: "Give, and pay in the sandbox",
    text: "Type any amount. The rules split it across her needs and her ABLE account, and one PayPal payment pays every recipient directly. The sandbox buyer login is further down this column.",
  },
  {
    path: "/g/maya/report?month=2026-10",
    target: ".rp-verdict",
    title: "Her report to Social Security",
    text: "Written from the gifts themselves: nothing counts this month, with the rule and the PayPal record behind every line. Press As cash for the report the same gifts would have needed.",
  },
  {
    path: "/g/maya/report?month=2026-10",
    target: ".rp-verify",
    title: "A report anyone can check",
    text: "Every report carries a code. Open it and Giftwise rebuilds the report, asks PayPal for each payment live and checks the audit ledger, with no login.",
  },
  {
    path: "/g/maya/report/easy?month=2026-10&lang=es",
    target: ".er-sheet",
    title: "Her own copy, in Easy Read",
    text: "The same report written to Maya, one idea per line with a picture, here in Spanish. Press Listen to hear it, or add the reminder for the 10th.",
  },
  {
    path: "/agents",
    target: ".ag-steps",
    title: "An AI assistant asks first",
    text: "A Claude assistant with no SSI knowledge calls Giftwise's MCP server, talks June out of sending cash, starts a checkout only she can approve, and reads the order back from PayPal's own MCP server.",
  },
  {
    path: "/g/maya/calendar?month=2026-10",
    target: ".bc-bar",
    title: "Her benefit calendar",
    text: "Press As cash, then drag Aunt June's $150 from October 28 to November 2. A different check drops, because SSI counts income by calendar month.",
  },
  {
    path: "/judges",
    target: ".jr",
    title: "Checked four ways",
    text: "Each result opens its cases: Social Security's own examples, federal court cases, labeled bills and 100,000 random gifts. Further down: failure cases run live against PayPal, and the rules watching the Federal Register.",
  },
];

export const TOUR_KEY = "giftwise.tour";

/** True when the page in view is the step's page: the same path, and every query value the step names. */
export function onStepPage(step: TourStep, loc: { pathname: string; search: string }) {
  const want = new URL(step.path, "http://x");
  if (want.pathname !== loc.pathname) return false;
  const have = new URLSearchParams(loc.search);
  return [...want.searchParams].every(([k, v]) => have.get(k) === v);
}
