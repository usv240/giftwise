import type { Metadata } from "next";
import Link from "next/link";
import billResults from "../../../../content/eval-results.json";
import invResults from "../../../../content/eval/invariants-results.json";
import { Info } from "@/components/Info";
import { OpenOnHash } from "@/components/OpenOnHash";
import { ErrorRates } from "@/components/judges/ErrorRates";
import { EvalIntro, EvalResults } from "@/components/judges/EvalResults";
import { FieldCases } from "@/components/judges/FieldCases";
import { Invariants, InvariantsIntro } from "@/components/judges/Invariants";
import { NeverDecides } from "@/components/judges/NeverDecides";
import { Lineage } from "@/components/judges/Lineage";
import { RefereeExample } from "@/components/judges/RefereeExample";
import { Results } from "@/components/judges/Results";
import { RulesWatch } from "@/components/judges/RulesWatch";
import { SsaExamples } from "@/components/judges/SsaExamples";
import { reviewedWatch } from "@/lib/rules-watch";
import "../../pages.css";
import "../../developers/dev.css";
import "../evidence.css";

export const metadata: Metadata = {
  title: "How the rules were checked",
  description: "Social Security's own worked examples, real federal court cases, labeled bills, 100,000 random gifts, the two error rates that cost money, and the Federal Register watch.",
};

const TOC = [
  ["#errors", "The two errors that cost money"],
  ["#referee", "One bill, two reviewers"],
  ["#lineage", "Where it comes from"],
  ["#evaluation", "The two reviewers, measured"],
  ["#ssa-examples", "SSA's examples"],
  ["#field-cases", "Court cases"],
  ["#invariants", `${invResults.gifts.toLocaleString("en-US")} gifts`],
  ["#rules-watch", "Rules watch"],
  ["#ai", "What the AI never decides"],
] as const;

/** Every check on the rules, moved off the Evidence page so it opens with its three numbers and the five-minute path. */
export default function RulesCheckedPage() {
  return (
    <div className="page frame evidence evidence-sub">
      <OpenOnHash />
      <header className="page-head">
        <p className="jx-crumb">
          <Link className="text-link" href="/evidence">
            Evidence
          </Link>
        </p>
        <h1 className="page-title">How the rules were checked</h1>
        <p className="lede">Four checks, each against answers Giftwise did not write, then the two errors that cost money, counted over all of them.</p>
      </header>

      <section className="jr-band" aria-label="Results">
        <Results />
      </section>

      <div id="errors">
        <ErrorRates />
      </div>

      <nav className="jp-toc" aria-label="On this page">
        <ul>
          {TOC.map(([href, label]) => (
            <li key={href}>
              <a className="jp-toc-link" href={href}>
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <RefereeExample />

      <Lineage />

      <section id="evaluation" className="page-section jx" aria-labelledby="eval-h">
        <div className="jx-head">
          <div className="title-row">
            <h2 id="eval-h">The two reviewers, measured</h2>
            <Info id="evidence.eval" label="" />
          </div>
          <EvalIntro />
        </div>
        <EvalResults />
      </section>

      <section id="ssa-examples" className="page-section jx" aria-labelledby="ssa-ex-h">
        <div className="jx-head">
          <div className="title-row">
            <h2 id="ssa-ex-h">Checked against Social Security&rsquo;s own examples</h2>
            <Info id="evidence.ssa_examples" label="" />
          </div>
          <p className="page-prose jp-intro">
            The {billResults.summary.referee.all_cases} bills above were labeled by us from the rule text. These cases come from Social Security&rsquo;s operating manual, with SSA&rsquo;s own answers. Both the rules engine and Claude with no rulebook
            answered them.
          </p>
        </div>
        <SsaExamples />
      </section>

      <section id="field-cases" className="page-section jx" aria-labelledby="field-h">
        <div className="jx-head">
          <div className="title-row">
            <h2 id="field-h">Real cases, from federal courts</h2>
            <Info id="evidence.field_cases" label="" />
          </div>
          <p className="page-prose jp-intro">
            The examples above are SSA&rsquo;s teaching cases. These are real people&rsquo;s cases: help from family that SSA counted, appealed to a federal court. Giftwise did not write them.
          </p>
        </div>
        <FieldCases />
      </section>

      <section id="invariants" className="page-section jx" aria-labelledby="inv-h">
        <div className="jx-head">
          <div className="title-row">
            <h2 id="inv-h">{invResults.gifts.toLocaleString("en-US")} random gifts, every promise kept</h2>
            <Info id="evidence.invariants" label="" />
          </div>
          <InvariantsIntro />
        </div>
        <Invariants />
      </section>

      <section id="rules-watch" className="page-section jx" aria-labelledby="rw-h">
        <div className="jx-head">
          <div className="title-row">
            <h2 id="rw-h">The rules watch the Federal Register</h2>
            <Info id="evidence.rules_watch" label="" />
          </div>
          <p className="page-prose jp-intro">
            SSI&rsquo;s rules change in the Federal Register. This asks it, live, for every change to how SSI counts income and in-kind support and every notice of the year&rsquo;s amounts, and shows what
            Giftwise does with each one.
          </p>
        </div>
        <RulesWatch initial={reviewedWatch()} />
      </section>

      <section id="ai" className="page-section" aria-labelledby="ai-h">
        <div className="title-row">
          <h2 id="ai-h">What the AI never decides</h2>
          <Info id="evidence.never_decides" label="" />
        </div>
        <p className="page-prose jp-intro">Claude reads and explains. Each decision about money below is made by code, the same way every time.</p>
        <NeverDecides />
      </section>
    </div>
  );
}
