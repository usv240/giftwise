import Link from "next/link";
import ssa from "../../../content/eval/ssa-examples-results.json";
import { Info } from "@/components/Info";
import { COURT_SCORE } from "@/lib/impact";
import { RECORDED_MONTH_NAME, RECORDED_REPORT_CHECK } from "@/lib/recorded-month";
import { MAX_UNITS } from "@/lib/routing";
import { HELD_OUT_COUNT, HELD_OUT_SCORES } from "@/lib/held-out-summary";

/**
 * What is first here, each tied to the comparison rows it rests on (src/components/evidence/Compare.tsx, every row from
 * that product's own pages). Stated as what the compared products do and the one step they do not; nothing wider.
 */
export function WhatIsFirst({
  headingId = "first-h",
  className,
  inFold = false,
}: {
  headingId?: string;
  className?: string;
  /** Inside a Fold, whose heading already names it: the four rows only, with no heading and no disclosure of their own. */
  inFold?: boolean;
}) {
  const FIRST = [
    {
      k: "A gift routed before it is the person's money",
      v: `A third party's gift is checked by a rules engine built from the statute and paid to the payee the rules picked, and one PayPal order pays up to ${MAX_UNITS} of them. True Link and Purple control or watch money the person already holds; Giftly delivers cash with a suggestion; ABLE gift pages take money into ABLE only; Talli, TrustHelm and trustees pay vendors from a trust by judgment.`,
      href: "/evidence/impact#compare",
      link: "The comparison, row by row",
    },
    {
      k: "A report to Social Security anyone can verify",
      v: "Each month's report carries a code; opening it asks PayPal live for every payment and recomputes the ledger's hash chain, with no login. None of the compared products publishes a report of this kind.",
      href: RECORDED_REPORT_CHECK,
      link: `${RECORDED_MONTH_NAME}'s report`,
    },
    {
      k: "Two rulebooks, quotes checked by code, a referee",
      v: "Two reviewers read two different rulebooks (20 CFR 416 and POMS); code checks every quote; when they disagree, the referee takes the route that keeps the check whole under either reading. Published designs abstain on one judge's confidence or vary the model; this one varies the text each reviewer reads.",
      href: "/evidence/rules#lineage",
      link: "Where the design comes from",
    },
    {
      k: "Accuracy published against SSA's own material",
      v: `${ssa.summary.engine_matches} of ${ssa.summary.cases} of Social Security's worked examples, ${HELD_OUT_SCORES} in the ${HELD_OUT_COUNT} sets the engine never saw, and federal court cases, ${COURT_SCORE}, each on its own page. None of the compared products publishes accuracy against SSA's material.`,
      href: "/evidence/rules",
      link: "How the rules were checked",
    },
  ];
  const list = (
    <dl className="why-list">
      {FIRST.map((f) => (
        <div key={f.k} className="why-row">
          <dt>{f.k}</dt>
          <dd>
            {f.v}{" "}
            <Link className="text-link" href={f.href}>
              {f.link}
            </Link>
          </dd>
        </div>
      ))}
    </dl>
  );
  if (inFold) return list;
  return (
    <section className={`first ${className ?? ""}`} aria-labelledby={headingId}>
      <div className="title-row">
        <h2 id={headingId} className="first-h">
          What is first here
        </h2>
        <Info id="evidence.first" label="" />
      </div>
      <p className="page-prose jp-intro">
        {FIRST.map((f) => f.k).join("; ")}: each tied to a comparison row, one
        press away.
      </p>
      <details className="jx-disc">
        <summary>The four, with the products each is measured against</summary>
        <div className="jx-body">{list}</div>
      </details>
    </section>
  );
}
