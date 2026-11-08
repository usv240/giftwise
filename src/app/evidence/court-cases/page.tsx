import type { Metadata } from "next";
import Link from "next/link";
import results from "../../../../content/eval/field-cases-results.json";
import { FieldCaseList } from "@/components/judges/FieldCases";
import "../../pages.css";
import "../../developers/dev.css";
import "../evidence.css";

const S = results.summary;

export const metadata: Metadata = {
  title: "Real cases, from federal courts",
  description: `${S.scored} real SSI cases from federal court opinions, each with what the court held and what routing the same help keeps, and ${S.cases - S.scored} on other questions.`,
};

/** The court cases one by one, kept off the Evidence page so it stays light. */
export default function CourtCasesPage() {
  return (
    <div className="page frame evidence evidence-sub">
      <header className="page-head">
        <p className="jx-crumb">
          <Link className="text-link" href="/evidence/rules#field-cases">
            Evidence
          </Link>
        </p>
        <h1 className="page-title">Real cases, from federal courts</h1>
        <p className="lede">
          <span className="tabular">
            {S.agreed} of {S.scored}
          </span>{" "}
          reach the outcome SSA and the court did. Each case shows what the court held, what routing the same help keeps, and a link to the opinion.
        </p>
      </header>
      <FieldCaseList />
    </div>
  );
}
