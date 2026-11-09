import type { Metadata } from "next";
import Link from "next/link";
import results from "../../../../content/eval/ssa-examples-results.json";
import { HeldOut } from "@/components/evidence/HeldOut";
import { SsaExampleList } from "@/components/evidence/SsaExamples";
import { P, usd } from "@/lib/rules";
import "../../pages.css";
import "../../developers/dev.css";
import "../../learn/disclosure.css";
import "../evidence.css";

const S = results.summary;

export const metadata: Metadata = {
  title: "Social Security's own examples",
  description: `${S.cases} worked examples from Social Security's operating manual and regulations, each with SSA's answer, the rules engine's and Claude's with no rulebook.`,
};

/** The worked examples one by one, kept off the Evidence page so it stays light. */
export default function SsaExamplesPage() {
  return (
    <div className="page frame evidence evidence-sub" data-check-year="">
      <header className="page-head">
        <p className="jx-crumb">
          <Link className="text-link" href="/evidence/rules#ssa-examples">
            Evidence
          </Link>
        </p>
        <h1 className="page-title">Social Security&rsquo;s own examples</h1>
        <p className="lede">
          <span className="tabular">
            {S.engine_matches} of {S.cases}
          </span>{" "}
          match SSA&rsquo;s answer with the rules engine; Claude with no rulebook,{" "}
          <span className="tabular">
            {S.claude_matches} of {S.claude_answered}
          </span>
          . Each example shows SSA&rsquo;s passage, its answer, and both answers to it.
        </p>
        <p className="page-prose muted">Each example&rsquo;s dates are moved to 2026, so its checks use the 2026 amounts: the full amount is {usd(P.fbrIndividual)} for one person.</p>
      </header>
      <SsaExampleList />
      <HeldOut />
    </div>
  );
}
