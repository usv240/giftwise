import type { Metadata } from "next";
import Link from "next/link";
import { Info } from "@/components/Info";
import { OpenOnHash } from "@/components/OpenOnHash";
import { Adoption, Pilot } from "@/components/evidence/Adoption";
import { Compare, OPTIONS } from "@/components/evidence/Compare";
import { Fold } from "@/components/evidence/Fold";
import { StakeLaw, StakeLimit, StakeScale, StakeUptake } from "@/components/evidence/Stake";
import { PayPalShare, PayYourself, Reach } from "@/components/evidence/WhyGiftwise";
import { ASKED_BASIS, ASKED_SENTENCE, FAMILY_BASIS, FAMILY_SENTENCE, IMPACT, KEPT_BASIS, KEPT_SENTENCE, housingReach, payItYourself, paypalShareSentence } from "@/lib/impact";
import { ABLE_MARKET, EXCESS_RESOURCES, ISM_COUNTED, LAW, SCALE, UPTAKE } from "@/lib/research";
import { checkMonthName, usd } from "@/lib/rules";
import "../../pages.css";
import "../../developers/dev.css";
import "../evidence.css";

export const metadata: Metadata = {
  title: "What it changes, and for whom",
  description: "What routing would have kept in real court cases, who each route reaches, why one shared page beats paying the shop yourself, how it compares, and who runs it first.",
};

const cents = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/**
 * What Giftwise changes, opening short: one result line, then every section closed under its heading with one line of
 * what it holds. A link to any part of a section opens it (OpenOnHash). The long tables live in the sections and in
 * docs/results.md and docs/real-world.md.
 */
export default function ImpactPage() {
  const year = payItYourself();
  const housing = housingReach();
  const later = housing.years[housing.years.length - 1];
  return (
    <div className="page frame evidence evidence-sub">
      <OpenOnHash />
      <header className="page-head">
        <p className="jx-crumb">
          <Link className="text-link" href="/evidence">
            Evidence
          </Link>
        </p>
        <h1 className="page-title">What it changes, and for whom</h1>
        <p className="lede ev-result">
          Routed through Giftwise, the help in two real court cases would have kept the families <span className="tabular">{cents(IMPACT.familyTotal)}</span>, and one shared page keeps{" "}
          <span className="tabular">{cents(year.totalLowered)}</span> of Maya&rsquo;s sample year whole.
        </p>
        <p className="ev-fold-note muted">
          Each section opens on a press. Every figure is the rules engine run on real cases or the sample year, or a published count with its source.{" "}
          <Link className="text-link" href="/about#real">
            How it works for real
          </Link>
        </p>
      </header>

      <div className="ev-folds">
        <Fold id="kept" title="What routing would have kept, family by family" what={`${cents(IMPACT.familyTotal)} for two families; ${usd(Math.round(IMPACT.keptMin))} to ${usd(Math.round(IMPACT.keptMax))} a month in ${IMPACT.routedCases} of ${IMPACT.scoredCases} court cases`}>
          <p className="page-prose jp-intro">
            {FAMILY_SENTENCE} {FAMILY_BASIS} These are the engine&rsquo;s counterfactuals on each case&rsquo;s facts, not outcomes anyone saw.
          </p>
          <dl className="why-list">
            {IMPACT.familyCases.map((c) => (
              <div key={c.id} className="why-row">
                <dt>
                  <span className="why-fig tabular">{cents(c.total)}</span> over {c.months} months
                </dt>
                <dd>
                  {c.title}: {cents(c.perMonth)} a month. <span className="muted">{c.citation.replace(/^.*?,\s*(No\.)/, "$1")}</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="page-prose why-next">
            {KEPT_SENTENCE} {KEPT_BASIS}
          </p>
          <dl className="why-list">
            {IMPACT.keptCases.map((c) => (
              <div key={c.id} className="why-row">
                <dt>
                  <span className="why-fig tabular">{cents(c.kept)}</span> a month
                </dt>
                <dd>
                  {c.title}. <span className="muted">{c.citation.replace(/^.*?,\s*(No\.)/, "$1")}</span>
                </dd>
              </div>
            ))}
          </dl>
        </Fold>

        <Fold id="asked" title="What SSA asked back, and what the engine finds" what={`${IMPACT.askedCases.map((c) => cents(c.amount)).join(" and ")} asked back; paid into ABLE, nothing to ask back`}>
          <p className="page-prose jp-intro">
            {ASKED_SENTENCE} {ASKED_BASIS}
          </p>
          <dl className="why-list">
            {IMPACT.askedCases.map((c) => (
              <div key={c.id} className="why-row">
                <dt>
                  <span className="why-fig tabular">{cents(c.amount)}</span> asked back
                </dt>
                <dd>
                  {c.title}
                  {c.period !== "not stated" ? `, ${c.period}` : ""}. As given, the engine puts her savings over the $2,000 limit, as SSA found.
                  {c.avoidedThroughAble ? " Paid into an ABLE account instead, her savings stay under it every month." : ""}
                </dd>
              </div>
            ))}
          </dl>
          <p className="muted why-src">
            overpaymentCheck() in scripts/run-field-cases.ts, written to content/eval/field-cases-results.json.{" "}
            <Link className="text-link" href="/evidence/court-cases">
              All the court cases
            </Link>
          </p>
        </Fold>

        <Fold id="stake" title="The problem, measured by Social Security" what={`${ISM_COUNTED.people.toLocaleString("en-US")} checks lowered for help with shelter in ${ISM_COUNTED.month}, and ${SCALE.length - 1} more measures`}>
          <StakeScale />
        </Fold>

        <Fold id="limit" title="The $2,000 limit, and ABLE&rsquo;s reach" what={`${EXCESS_RESOURCES.suspended.toLocaleString("en-US")} payments suspended in 2024 for savings over the limit; ${ABLE_MARKET.accounts} ABLE accounts`}>
          <StakeLimit />
        </Fold>

        <Fold id="reach" title="Who each route reaches" what={`Paying a shop reaches everyone on SSI; without ABLE, ${usd(housing.amount)} of rent leaves the ${checkMonthName(later.paymentMonth)} check at ${usd(later.rentWithoutAble)}`}>
          <Reach />
        </Fold>

        <Fold id="why" title="Why not pay the shop yourself?" what={`Each giver paying alone lowers ${year.monthsLowered} of Maya's checks, ${cents(year.totalLowered)} in all; one shared page keeps every check whole`}>
          <PayYourself />
        </Fold>

        <Fold id="paypal-share" title="The part PayPal carries" what={paypalShareSentence()}>
          <PayPalShare />
        </Fold>

        <Fold id="compare" title="How it compares" what={`${OPTIONS.length} other ways to help, each from its own pages with the date it was read`}>
          <p className="page-prose jp-intro">
            Each of these does its own job well, described from its own published pages with the date it was read. Beside each is the one step it does not do that Giftwise does; Giftwise is built for the moment a gift is
            given, and works alongside them. <Info id="evidence.compare" label="" />
          </p>
          <Compare />
        </Fold>

        <Fold id="adoption" title="Who runs it first" what="Three groups that already help people on SSI with money every month, and a first pilot">
          <p className="page-prose jp-intro">Three groups already help people on SSI with money every month. Each can run Giftwise as it is today.</p>
          <Adoption />
          <Pilot />
        </Fold>

        <Fold id="uptake" title="Simpler processes raise take-up" what={`${UPTAKE.length} published studies, each as what it measured`}>
          <StakeUptake />
        </Fold>

        <Fold id="law" title="The law, the code and the test" what={`${LAW.length} routes, each with the section, the rule and the test`}>
          <StakeLaw />
        </Fold>
      </div>
    </div>
  );
}
