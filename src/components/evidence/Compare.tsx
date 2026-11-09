import sources from "../../../content/sources.json";

const SRC = sources as Record<string, { title: string; url: string; date?: string }>;

/**
 * The other ways people help someone on SSI with money, each from its own published pages (the date each was read is
 * in content/sources.json): what it does, and the one step it does not do that Giftwise does. Each of these does its
 * own job well; Giftwise is built for the moment a gift is given, and works alongside them.
 */
type Option = { slug: string; name: string; well: string; adds: string; src?: [string, string][] };

const OPTIONS: Option[] = [
  {
    slug: "true-link",
    name: "Prepaid cards for people on benefits (True Link)",
    well: "A trustee or representative payee loads money, sets spending rules across more than 50 categories, blocks or allows shops and watches each purchase. SSA's manual names it as an administrator-managed card (POMS SI 01120.201).",
    adds: "It controls how the person spends money already theirs. Giftwise acts one step earlier: a third party's gift is checked against the SSI rules and paid to the shop or the ABLE account before it becomes the person's money.",
    src: [
      ["true-link-card", "True Link"],
      ["poms-si-01120-201", "POMS SI 01120.201"],
    ],
  },
  {
    slug: "purple",
    name: "Purple, a bank app for people with disabilities",
    well: "Watches the person's own money: alerts as savings approach the $2,000 limit, a representative payee account, an ABLE account inside the app, spending controls with caregiver visibility, and a choice of which account pays for a purchase.",
    adds: "It does not take a gift from a third party and route it to a shop, a clinic or ABLE under SSA's rules, and it does not publish a report to Social Security that anyone can verify against PayPal. Giftwise does both.",
    src: [["purple-bank", "Purple"]],
  },
  {
    slug: "trusts",
    name: "Special needs and pooled trusts",
    well: "A trustee pays shops and providers for the person, which SSA does not count as income, and a pooled trust, run by a nonprofit, has no age limit. They hold money for the long term: published fee schedules list a $500 to $750 enrollment fee, 2 to 3 percent a year, a recommended $10,000 to start and 7 to 10 days per distribution.",
    adds: "For everyday gifts from many givers, Giftwise needs no trust to set up: each gift is checked and paid where it keeps the check whole, and a family can use it alongside a trust.",
    src: [
      ["poms-si-01120-200", "POMS SI 01120.200"],
      ["poms-si-01120-203", "SI 01120.203"],
      ["arc-texas-pooled-fees", "The Arc of Texas"],
      ["guardian-trust-pooled-fees", "Guardian Trust"],
      ["plan-ma-ri-fees", "PLAN of MA and RI"],
    ],
  },
  {
    slug: "talli",
    name: "Talli, trust disbursement software",
    well: "Pays out of a special needs trust: approval steps, direct payments to vendors, a record of the vendor and the SSI effect expected, and reconciliation of each payment.",
    adds: "It works on money already in a trust and records the expected SSI effect. Giftwise computes the route from the statute at the moment a third party gives, with no trust to set up, and the effect is on a report anyone can check.",
    src: [["talli-snt", "Talli"]],
  },
  {
    slug: "trusthelm",
    name: "TrustHelm, a guide for trustees",
    well: "A caregiver guide with a checker for whether a trust can pay for something: pay the provider directly, or proceed with caution because the in-kind support rule may lower SSI by up to a third.",
    adds: "The check is advice. Giftwise makes the same check in code for each gift, then pays the shop or the ABLE account through PayPal and keeps the record.",
    src: [["trusthelm-snt", "TrustHelm"]],
  },
  {
    slug: "calculators",
    name: "Benefits calculators",
    well: "Disability Benefits 101 estimates how a job may change a person's total income, benefits and health coverage, in 13 states, and its SSI pages work the rent example by hand: a grandfather paying $300 of rent is advised to put the money into an ABLE account instead of paying the landlord.",
    adds: "That is the route Giftwise automates. It answers the same question for each gift before it is given, then pays it the way that keeps the check whole and writes the report.",
    src: [
      ["db101", "DB101"],
      ["db101-il-ssi-limits", "DB101 Illinois, SSI limits"],
    ],
  },
  {
    slug: "counselors",
    name: "Benefits counselors",
    well: "Work Incentives Planning and Assistance counselors, funded by Social Security, give free, one-to-one counseling to people on Social Security and SSI.",
    adds: "A counselor can make the gift page with the family, and check every month's report against PayPal and the ledger from its link, with no login.",
    src: [
      ["ssa-wipa", "SSA"],
      ["ssa-wipa-findhelp", "Find help"],
    ],
  },
  {
    slug: "fundraising",
    name: "Fundraising sites",
    well: "Raise money from many people for one cause, with a goal and updates.",
    adds: "Each stated use is paid straight to its shop or to the ABLE account, so the money raised does not arrive as cash. A fundraiser link can become a gift page.",
  },
  {
    slug: "giftly",
    name: "Giftly, and PayPal.me or a bank transfer",
    well: "Giftly sends money with a spending suggestion; the recipient redeems it to a bank account, PayPal or a prepaid card and chooses where to spend it. PayPal.me and a transfer send money to someone you know, quickly.",
    adds: "Money that arrives as cash is unearned income for SSI. Giftwise never lets the gift become cash to the person: the same PayPal checkout pays the shop, the clinic and the ABLE account instead, up to 10 recipients in one order.",
    src: [["giftly-how", "Giftly"]],
  },
  {
    slug: "able-pages",
    name: "An ABLE plan's gift page",
    well: "ABLEnow and IAble take gifts by Ugift code at UgiftABLE.com, by bank transfer or check, fee free; CalABLE, ABLE United, PA ABLE and ABLE for ALL give each account its own gifting link, and some hold a gift for 10 business days.",
    adds: "A gift page takes money into ABLE only, with no rules check. Giftwise works out the ABLE share of each gift and sends the giver to that page for it, and pays the needs better paid at a shop through PayPal.",
    src: [
      ["ablenow-gifting", "ABLEnow"],
      ["ugiftable", "UgiftABLE"],
      ["calable-gifting", "CalABLE"],
      ["able-united-gifting", "ABLE United"],
      ["paable-gift", "PA ABLE"],
      ["ableforall-gifting", "ABLE for ALL"],
    ],
  },
  {
    slug: "yourself",
    name: "Paying the shop yourself",
    well: "For one repair from one giver, it keeps the check whole, and it is what Giftwise does.",
    adds: "Rent and utility bills, which count even when paid straight to the landlord, go through ABLE instead, and many givers share one list, one ABLE limit and one monthly report.",
  },
];

export function Compare() {
  return (
    <ul className="cmp-list">
      {OPTIONS.map((o) => (
        <li key={o.slug} id={`cmp-${o.slug}`} className="cmp-item" data-ui>
          <p className="cmp-name">{o.name}</p>
          <p className="cmp-well">
            <span className="cmp-k">What it does. </span>
            {o.well}
          </p>
          <p className="cmp-adds">
            <span className="cmp-k">The step Giftwise adds. </span>
            {o.adds}
          </p>
          {o.src && (
            <p className="cmp-src muted">
              {o.src.map(([id, label], i) => (
                <span key={id}>
                  {i > 0 ? "; " : "Sources: "}
                  <a className="text-link" href={SRC[id].url} target="_blank" rel="noreferrer">
                    {label}
                  </a>
                  {SRC[id].date ? ` (${SRC[id].date})` : ""}
                </span>
              ))}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
