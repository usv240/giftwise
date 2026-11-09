import type { Metadata } from "next";
import Link from "next/link";
import billResults from "../../../../content/eval-results.json";
import fieldResults from "../../../../content/eval/field-cases-results.json";
import invResults from "../../../../content/eval/invariants-results.json";
import ssaResults from "../../../../content/eval/ssa-examples-results.json";
import { Info } from "@/components/Info";
import { OpenOnHash } from "@/components/OpenOnHash";
import { ErrorRates } from "@/components/evidence/ErrorRates";
import { EvalIntro, EvalResults } from "@/components/evidence/EvalResults";
import { FieldCases } from "@/components/evidence/FieldCases";
import { Fold } from "@/components/evidence/Fold";
import { Invariants, InvariantsIntro } from "@/components/evidence/Invariants";
import { NeverDecides } from "@/components/evidence/NeverDecides";
import { Lineage } from "@/components/evidence/Lineage";
import { Adversarial } from "@/components/evidence/Adversarial";
import { RefereeExample } from "@/components/evidence/RefereeExample";
import { Results } from "@/components/evidence/Results";
import { RulesWatch } from "@/components/evidence/RulesWatch";
import { SsaExamples } from "@/components/evidence/SsaExamples";
import { ERROR_RATES } from "@/lib/error-rates";
import { COURT_SCORE, IMPACT } from "@/lib/impact";
import { WhatAiAdds } from "@/components/evidence/WhatAiAdds";
import { reviewedWatch } from "@/lib/rules-watch";
import "../../pages.css";
import "../../developers/dev.css";
import "../evidence.css";

export const metadata: Metadata = {
  title: "How the rules were checked",
  description: "Social Security's own worked examples, real federal court cases, labeled bills, 100,000 random gifts, the two error rates that cost money, and the Federal Register watch.",
};

/**
 * Every check on the rules, opening short: one result line, then each check closed under its heading with one line of
 * what it holds. A link to anything inside a section (#referee, #evaluation, a bill) opens it (OpenOnHash).
 */
export default function RulesCheckedPage() {
  const ssa = ssaResults.summary;
  const fc = fieldResults.summary;
  const b = billResults.summary;
  const lowered = ERROR_RATES.lowered;
  const held = ERROR_RATES.held;
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
        <p className="lede ev-result">
          <span className="tabular">
            {lowered.errors} of {lowered.of}
          </span>{" "}
          gifts that would lower the check were let through, over Social Security&rsquo;s own examples, real court cases and labeled bills; the engine matches{" "}
          <span className="tabular">
            {ssa.engine_matches} of {ssa.cases}
          </span>{" "}
          of SSA&rsquo;s answers and{" "}
          <span className="tabular">
            {fc.agreed} of {fc.scored}
          </span>{" "}
          court outcomes scored, of <span className="tabular">{fc.cases}</span> cases.
        </p>
        <p className="ev-fold-note muted">Each check opens on a press, against answers Giftwise did not write.</p>
      </header>

      <div className="ev-folds">
        <Fold id="results" title="Four checks, at a glance" what={`${ssa.engine_matches} of ${ssa.cases} SSA examples; court cases, ${COURT_SCORE}; ${b.referee.check_kept_whole} of ${b.referee.all_cases} bills; ${invResults.gifts.toLocaleString("en-US")} random gifts`}>
          <Results />
        </Fold>

        <Fold id="errors" title="The two errors that cost money" what={`${lowered.errors} of ${lowered.of} gifts that would lower the check let through; ${held.errors} of ${held.of} fine gifts sent another way, each with her check whole`}>
          <ErrorRates />
        </Fold>

        <Fold id="referee-fold" title="One bill, two reviewers" what="Two Claude reviewers read different rulebooks and disagree; code checks both quotes and keeps her check whole either way; and what the AI adds over a router with no AI">
          <RefereeExample />
          <Adversarial />
          <WhatAiAdds />
        </Fold>

        <Fold id="lineage-fold" title="Where the two-reviewer design comes from" what="The published designs it builds on, and the one part that is new: independence from the text each reviewer reads">
          <Lineage />
        </Fold>

        <Fold id="evaluation" title="The two reviewers, measured" what={`${b.referee.all_cases} labeled bills; wrong routes accepted: referee ${b.referee.wrong_routes_accepted}, Claude with no rulebook ${b.baseline.wrong_routes_accepted}`}>
          <div className="jx-head">
            <Info id="evidence.eval" label="" />
            <EvalIntro />
          </div>
          <EvalResults />
        </Fold>

        <Fold id="ssa-examples" title="Checked against Social Security&rsquo;s own examples" what={`The engine matches ${ssa.engine_matches} of ${ssa.cases}; Claude with no rulebook, ${ssa.claude_matches} of ${ssa.claude_answered}`}>
          <p className="page-prose jp-intro">
            The {b.referee.all_cases} bills above were labeled by us from the rule text. These cases come from Social Security&rsquo;s operating manual, with SSA&rsquo;s own answers. Both the rules engine and Claude with no
            rulebook answered them. <Info id="evidence.ssa_examples" label="" />
          </p>
          <SsaExamples />
        </Fold>

        <Fold id="field-cases" title="Real cases, from federal courts" what={`Help from family was counted against the person in all ${IMPACT.countedCases}; the engine reaches SSA's and the court's outcome in ${COURT_SCORE}`}>
          <p className="page-prose jp-intro">
            The examples above are SSA&rsquo;s teaching cases. These are real people&rsquo;s cases: help from family that SSA counted, appealed to a federal court. Giftwise did not write them.{" "}
            <Info id="evidence.field_cases" label="" />
          </p>
          <FieldCases />
        </Fold>

        <Fold id="invariants" title={`${invResults.gifts.toLocaleString("en-US")} random gifts, every promise kept`} what={`${invResults.results.length} promises, each held by every gift`}>
          <div className="jx-head">
            <Info id="evidence.invariants" label="" />
            <InvariantsIntro />
          </div>
          <Invariants />
        </Fold>

        <Fold id="rules-watch" title="The rules watch the Federal Register" what="Asked live for every change to how SSI counts income and in-kind support, and each year's amounts">
          <p className="page-prose jp-intro">
            SSI&rsquo;s rules change in the Federal Register. This asks it, live, for every change to how SSI counts income and in-kind support and every notice of the year&rsquo;s amounts, and shows what
            Giftwise does with each one. <Info id="evidence.rules_watch" label="" />
          </p>
          <RulesWatch initial={reviewedWatch()} />
        </Fold>

        <Fold id="ai" title="What the AI never decides" what="Claude reads and explains; code decides every amount, payee and route, the same way every time">
          <p className="page-prose jp-intro">
            Claude reads and explains. Each decision about money below is made by code, the same way every time. <Info id="evidence.never_decides" label="" />
          </p>
          <NeverDecides />
        </Fold>
      </div>
    </div>
  );
}
