import Link from "next/link";
import facts from "../../../content/facts.json";
import inv from "../../../content/eval/invariants-results.json";
import sources from "../../../content/sources.json";
import { payItYourself, sampleYearSplit } from "@/lib/impact";
import { usd } from "@/lib/rules";

const SRC = sources as Record<string, { title: string; url: string }>;
const A = facts.audience;
const cents = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const Src = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <a className="text-link" href={SRC[id].url} target="_blank" rel="noreferrer">
    {children}
  </a>
);

/** Who each route reaches, from SSA's counts as CRS reports them and the ABLE age rule in SSA's manual. */
export function Reach() {
  return (
    <dl className="why-list">
      <div className="why-row">
        <dt>
          <span className="why-fig tabular">{A.ssi_jan2025_total.value}</span> can be paid for at a shop
        </dt>
        <dd>
          Paying the shop, the clinic or the landlord works for everyone on SSI, whatever their age or when their disability began: all {A.ssi_jan2025_total.value} people receiving SSI in January 2025 (
          <Src id="crs-if10482">CRS IF10482</Src>, from SSA&rsquo;s Monthly Statistical Snapshot).
        </dd>
      </div>
      <div className="why-row">
        <dt>
          <span className="why-fig tabular">{A.ssi_jan2025_children.value}</span> children, and adults whose disability began before {facts.values.able_onset_age.value}, can use ABLE
        </dt>
        <dd>
          The ABLE route needs blindness or a disability that began before age {facts.values.able_onset_age.value}, the rule since January 1, 2026 (<Src id="poms-si-01130-740">POMS SI 01130.740</Src>). That
          covers all {A.ssi_jan2025_children.value} children on SSI. The {A.ssi_jan2025_adults.value} adults aged 18 to 64 are all on SSI for blindness or disability, and those whose condition began before{" "}
          {facts.values.able_onset_age.value} qualify, as do people 65 or older whose blindness or disability began then. SSA counts recipients by age rather than by when a disability began, so the adult
          share is a range, not one number. About {A.able_newly_eligible.value} more people became eligible for ABLE on January 1, 2026 (
          <Src id="able-nrc-age-adjustment">ABLE National Resource Center</Src>).
        </dd>
      </div>
      <div className="why-row">
        <dt>Everyone else is routed to a shop</dt>
        <dd>Money goes to an ABLE account only for someone who can have one, a promise held on all {inv.gifts.toLocaleString("en-US")} random gifts; for everyone else, each need is paid at its shop.</dd>
      </div>
    </dl>
  );
}

/** "Why not pay the shop yourself?", answered with the sample year run through the engine. */
export function PayYourself({ short = false }: { short?: boolean }) {
  const y = payItYourself();
  const rows = [
    {
      k: "Housing help",
      v: `${y.housingGifts} of the ${y.gifts} gifts (${usd(y.housingAmount)}) were rent or a utility bill. Paid straight to the landlord or the utility, help with housing still lowers her check; Giftwise sends it through her ABLE account instead.`,
    },
    { k: "Gifts with no shop", v: `${y.cashGifts} gifts (${usd(y.cashAmount)}) were savings, with no shop behind them. Given on their own, they arrive as cash.` },
    {
      k: "Her check",
      v: `Each giver paying on their own, the engine lowers ${y.monthsLowered} of her monthly checks, ${cents(y.totalLowered)} in all. With one shared page, every check stays whole.`,
    },
    { k: "The report", v: `${y.reportMonthsAlone} months with income or housing help to tell Social Security about, against ${y.reportMonthsGiftwise} with Giftwise, which writes the report either way.` },
    {
      k: "ABLE's yearly limit",
      v: `${usd(y.ableLimit)} a year from every giver together. ${y.ableGivers} givers put in ${usd(y.ableAmount)} this year; Giftwise adds the page's ABLE gifts so far this year to the total before it routes the next one, so no giver needs to know what the others gave.`,
    },
    { k: "One checkout", v: `One PayPal order pays up to ${y.maxRecipients} recipients, so a giver pays the shops, the clinic and the ABLE account at once.` },
    { k: "No double paying", v: `On a shared page no need is paid past what it still needs, a promise held on all ${inv.gifts.toLocaleString("en-US")} random gifts. In the sample year each need had one giver.` },
  ];
  return (
    <div className="why-pay">
      <p className="why-lead">
        For one repair from one giver, paying the shop works, and it is what Giftwise does. A year of help from {y.givers} people across {y.needs} needs is where one shared page adds the rest. Measured on Maya&rsquo;s sample year,
        each of its {y.gifts} gifts priced by the rules engine both ways:
      </p>
      <dl className="why-list">
        {(short ? rows.slice(0, 4) : rows).map((r) => (
          <div key={r.k} className="why-row">
            <dt>{r.k}</dt>
            <dd>{r.v}</dd>
          </div>
        ))}
      </dl>
      <p className="muted why-src">payItYourself() in src/lib/impact.ts runs the same gifts through the engine, once as each giver would pay alone and once routed by Giftwise.</p>
    </div>
  );
}

/** Which part of a real year PayPal carries, and why the ABLE share goes through the plan's own gift page. */
export function PayPalShare() {
  const y = sampleYearSplit();
  return (
    <p className="why-lead">
      Of Maya&rsquo;s sample year, {usd(y.total)} in {y.gifts} gifts, PayPal carries {usd(y.paypal.amount)} ({y.paypal.gifts} gifts): everything paid to a shop or a clinic, in one checkout for each giver.
      The {usd(y.able.amount)} ({y.able.gifts} gifts) for her ABLE account goes through her ABLE plan&rsquo;s own gift page, because each plan takes gifts its own way (a gift link or a Ugift code);
      Giftwise works out that amount the same way and sends the giver there. The other {usd(y.item.amount)} is a jacket given as itself.{" "}
      <Link className="text-link" href="/about#real">
        How this works for real
      </Link>
    </p>
  );
}
