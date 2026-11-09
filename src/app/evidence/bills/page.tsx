import type { Metadata } from "next";
import Link from "next/link";
import results from "../../../../content/eval-results.json";
import { BillList } from "@/components/evidence/EvalResults";
import "../../pages.css";
import "../../developers/dev.css";
import "../evidence.css";

const S = results.summary.referee;

export const metadata: Metadata = {
  title: "The labeled bills",
  description: `${S.all_cases} bills paid by someone else, each labeled from the rule text, with Claude's answer with no rulebook, each reviewer's and the referee's route.`,
};

/** Every labeled bill and every answer, kept off the Evidence page so it stays light. */
export default function BillsPage() {
  return (
    <div className="page frame evidence evidence-sub">
      <header className="page-head">
        <p className="jx-crumb">
          <Link className="text-link" href="/evidence/rules#evaluation">
            Evidence
          </Link>
        </p>
        <h1 className="page-title">The labeled bills</h1>
        <p className="lede">
          <span className="tabular">
            {S.check_kept_whole} of {S.all_cases}
          </span>{" "}
          bills routed so her check stays whole. Each row shows the bill&rsquo;s label from the rule text, Claude&rsquo;s answer with no rulebook, each reviewer&rsquo;s reading and the route Giftwise took.
        </p>
      </header>
      <BillList />
    </div>
  );
}
