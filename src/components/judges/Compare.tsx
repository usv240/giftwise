import sources from "../../../content/sources.json";

const SRC = sources as Record<string, { title: string; url: string }>;

/**
 * The other ways people help someone on SSI with money, each from its own published pages: what it does well, and what
 * Giftwise adds beside it. Each of these does its own job well; Giftwise is built for the moment a gift is given.
 */
type Option = { name: string; well: string; adds: string; src?: [string, string][] };

const OPTIONS: Option[] = [
  {
    name: "Prepaid cards for people on benefits",
    well: "True Link's card lets a trustee or representative payee load money, set spending rules across more than 50 categories, block or allow shops and watch each purchase. It is used to pay a personal needs allowance and to spend from a special needs trust.",
    adds: "Giftwise works one step earlier: a family member's gift is routed before it arrives, to the shop or the ABLE account, so it never becomes money the person holds.",
    src: [["true-link-card", "True Link"]],
  },
  {
    name: "Special needs and pooled trusts",
    well: "A trustee pays shops and providers for the person, which SSA does not count as income, and a pooled trust, run by a nonprofit, has no age limit. They hold money for the long term; one pooled trust lists a $600 enrollment fee and a yearly fee from 1.75%.",
    adds: "For everyday gifts from many givers, Giftwise needs no account to set up: each gift is checked and paid where it keeps the check whole, and a family can use it alongside a trust.",
    src: [
      ["poms-si-01120-200", "POMS SI 01120.200"],
      ["poms-si-01120-203", "SI 01120.203"],
      ["arc-texas-pooled-fees", "The Arc of Texas"],
    ],
  },
  {
    name: "Benefits calculators",
    well: "Disability Benefits 101 estimates how a job may change a person's total income, benefits and health coverage, in 13 states.",
    adds: "Giftwise answers the same kind of question for a gift, before it is given, and then pays it the way that keeps the check whole.",
    src: [["db101", "DB101"]],
  },
  {
    name: "Benefits counselors",
    well: "Work Incentives Planning and Assistance counselors, funded by Social Security, give free, one-to-one counseling to people on Social Security and SSI.",
    adds: "A counselor can make the gift page with the family, and check every month's report against PayPal and the ledger from its link, with no login.",
    src: [
      ["ssa-wipa", "SSA"],
      ["ssa-wipa-findhelp", "Find help"],
    ],
  },
  {
    name: "Fundraising sites",
    well: "Raise money from many people for one cause, with a goal and updates.",
    adds: "Each stated use is paid straight to its shop or to the ABLE account, so the money raised does not arrive as cash. A fundraiser link can become a gift page.",
  },
  {
    name: "PayPal.me or a bank transfer",
    well: "Send money to someone you know, quickly.",
    adds: "The same PayPal checkout, paying the shop, the clinic and the ABLE account instead of the person, up to 10 recipients in one order.",
  },
  {
    name: "An ABLE plan's gift page",
    well: "Takes gifts straight into the person's ABLE account, by the plan's own gift link or Ugift code.",
    adds: "Giftwise works out the ABLE share of each gift and sends the giver to that page for it, and pays needs better paid at a shop through PayPal.",
  },
  {
    name: "Paying the shop yourself",
    well: "For one repair from one giver, it keeps the check whole, and it is what Giftwise does.",
    adds: "Rent and utility bills, which count even when paid straight to the landlord, go through ABLE instead, and many givers share one list, one ABLE limit and one monthly report.",
  },
];

export function Compare() {
  return (
    <ul className="cmp-list">
      {OPTIONS.map((o) => (
        <li key={o.name} className="cmp-item" data-ui>
          <p className="cmp-name">{o.name}</p>
          <p className="cmp-well">
            <span className="cmp-k">What it does well. </span>
            {o.well}
          </p>
          <p className="cmp-adds">
            <span className="cmp-k">What Giftwise adds. </span>
            {o.adds}
          </p>
          {o.src && (
            <p className="cmp-src muted">
              {o.src.map(([id, label], i) => (
                <span key={id}>
                  {i > 0 ? ", " : "Sources: "}
                  <a className="text-link" href={SRC[id].url} target="_blank" rel="noreferrer">
                    {label}
                  </a>
                </span>
              ))}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
