/**
 * How giving to someone on SSI works today, side by side. Each of these does its own job well; Giftwise is built for the
 * moment before the gift, and hands the ABLE share to the plan's own gift page and the rest to shops through PayPal.
 */
const OPTIONS = ["Giftwise", "Fundraising sites", "PayPal.me or a bank transfer", "An ABLE plan's gift page", "Paying the shop yourself"] as const;

const ROWS: { label: string; cells: [string, string, string, string, string] }[] = [
  { label: "Built for", cells: ["Giving to someone on SSI so the check stays whole", "Raising money from many people for one cause", "Sending money to someone you know", "Saving for disability expenses, tax-free", "One giver who knows the shop"] },
  { label: "Where the money lands", cells: ["The shop, the clinic or the ABLE account", "The organizer's or the person's bank account", "The person's account", "The ABLE account", "The shop"] },
  { label: "Checks SSI's rules for that month first", cells: ["Yes, with the rule and its source", "", "", "", ""] },
  { label: "Several recipients in one checkout", cells: ["Up to 10 in one PayPal order", "", "", "", ""] },
  { label: "Many givers, one list", cells: ["One list of needs", "One goal", "", "One account", ""] },
  { label: "The month's report for Social Security", cells: ["Written, with a code anyone can check", "", "", "", ""] },
  { label: "AI assistants can ask first", cells: ["Yes, over MCP", "", "", "", ""] },
];

export function Compare() {
  return (
    <div className="cmp-wrap" data-ui>
      <table className="cmp">
        <caption className="sr-only">How Giftwise compares with other ways to give to someone on SSI</caption>
        <thead>
          <tr>
            <td />
            {OPTIONS.map((o, i) => (
              <th key={o} scope="col" data-gw={i === 0 ? "" : undefined}>
                {o}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              {r.cells.map((c, i) => (
                <td key={OPTIONS[i]} data-label={OPTIONS[i]} data-gw={i === 0 ? "" : undefined} data-empty={c ? undefined : ""}>
                  {c || (
                    <>
                      <span className="cmp-none" aria-hidden="true" />
                      <span className="sr-only">Not part of what it does</span>
                    </>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
