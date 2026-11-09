"use client";

import { useState } from "react";
import { Info } from "../Info";
import { usePrefs } from "../prefs";
import { referee, routeForDecision, type Review } from "@/lib/review/referee";
import { DEFAULT_PROFILE, P, addMonths, checkMonthName, evaluateGift, usd, type Category, type Gift } from "@/lib/rules";
import { modelName } from "@/lib/ai/model-name";
import { AiBudget } from "./AiBudget";

export type ReviewInput = { description: string; amount: number; category: Category; date: string; recurring?: boolean };
export type ReviewOut = {
  authority: "regs" | "poms";
  answer: "shelter" | "not_shelter" | "unclear";
  passage_id: string;
  cite: string | null;
  url: string | null;
  quote: string;
  quote_checked: boolean;
  set_aside_reason: string | null;
  reason: { plain: string; technical: string };
  confidence: number;
};
export type ReviewData = {
  reviews: ReviewOut[];
  referee: { decision: "shelter" | "not_shelter" | "unsure"; agreed: boolean; summary: string };
  outcome: { route: "vendor" | "able" | null; check_after: number | null; readings: string[]; routes: { delivery: string; possible: boolean; check: number }[]; rule_ids: string[] };
};
export type RecordedReview = { recorded_at: string; model: string; input: ReviewInput; data: ReviewData };

const WHO = {
  regs: { name: "Regulations reviewer", reads: "Reads only the federal regulations and the Federal Register." },
  poms: { name: "Manual reviewer", reads: "Reads only Social Security's operating manual (POMS)." },
};
const ANSWER = { shelter: "A housing cost", not_shelter: "Not a housing cost", unclear: "Its rulebook does not settle it" };
const ROUTE = { vendor: "pay the company directly", able: "send it to her ABLE account" };

// A test answer we wrote: the Manual reviewer claims a rule that is not in the manual.
const MADE_UP_QUOTE = "Electric bills paid by a family member are never counted as income.";

/** The line under a replayed run: whose answers, when they were recorded, and that the checks ran on them just now. */
export const replayedSource = (meta: { model?: string; recorded_at?: string }) =>
  `Replayed: ${modelName(meta.model)}'s recorded answers${meta.recorded_at ? ` of ${new Date(meta.recorded_at).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" })}` : ""}, run just now through the same quote check, referee and rules engine.`;

const toReview = (r: ReviewOut): Review => ({ authority: r.authority, answer: r.answer, passage_id: r.passage_id, quote: r.quote, reason_plain: r.reason.plain, reason_technical: r.reason.technical, confidence: r.confidence });

/**
 * The two reviewers, the referee's verdict, and the rules engine's route. Shows a recorded run, or one that already ran
 * live (a bill upload asks them on its own), and can run live again.
 */
export function ReviewPanel({ input, recorded, ran }: { input: ReviewInput; recorded?: RecordedReview; ran?: { data: ReviewData; source: string } }) {
  const { prefs } = usePrefs();
  const [data, setData] = useState<ReviewData | null>(ran?.data ?? recorded?.data ?? null);
  const [source, setSource] = useState(ran?.source ?? (recorded ? `Recorded ${new Date(recorded.recorded_at).toLocaleDateString("en-US", { dateStyle: "medium" })} with ${modelName(recorded.model)}.` : ""));
  const [status, setStatus] = useState<"idle" | "running" | "error">("idle");
  const [note, setNote] = useState("");
  const [test, setTest] = useState(false);
  const [runs, setRuns] = useState(0);
  const gift: Gift = { id: "review", date: input.date, amount: input.amount, delivery: "vendor", category: input.category, recurring: input.recurring };

  async function run() {
    setStatus("running");
    setNote("");
    setTest(false);
    try {
      const r = await fetch("/api/v1/review-bill", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "The reviewers could not run. Please try again.");
      setData(j.data);
      setSource(j.meta?.replayed ? replayedSource(j.meta) : `Run live just now with ${modelName(j.meta?.model)}, in ${Math.round((j.meta?.latency_ms ?? 0) / 1000)} seconds.`);
      setStatus("idle");
    } catch (e) {
      setNote((e as Error).message);
      setStatus("error");
    }
    setRuns((n) => n + 1);
  }

  // The "wrong answer" test runs the same referee code in the browser, on the same reviews with one quote replaced.
  let shown = data;
  let trusted: number | null = null;
  if (data && test) {
    const reviews = data.reviews.map((r) =>
      r.authority === "poms"
        ? { ...r, answer: "not_shelter" as const, quote: MADE_UP_QUOTE, reason: { plain: "Test answer: it claims family-paid electric bills are never counted. The manual says no such thing.", technical: "Written by us to test the referee." } }
        : r,
    );
    const ref = referee(reviews.map(toReview));
    const out = routeForDecision(gift, ref.decision, DEFAULT_PROFILE);
    shown = {
      reviews: ref.votes.map((v, i) => ({ ...reviews[i], quote_checked: v.valid, set_aside_reason: v.setAsideReason ?? null })),
      referee: { decision: ref.decision, agreed: ref.agreed, summary: ref.summary },
      outcome: { route: out.route, check_after: out.check, readings: out.readings, routes: out.routes, rule_ids: out.ruleIds },
    };
    trusted = evaluateGift({ ...gift, delivery: "vendor" }, DEFAULT_PROFILE).checkAfter;
  }

  return (
    <section className="rv" aria-labelledby="rv-h">
      <div className="title-row">
        <h2 id="rv-h" className="rv-title">
          Two reviewers, two rulebooks
        </h2>
        <Info id="review.panel" />
      </div>
      <p className="rv-lede">Is this bill a housing cost? Each reviewer answers from its own rulebook and quotes it word for word. A program checks every quote before Giftwise acts.</p>

      {shown && (
        <>
          {test && <p className="rv-test">Test answer, written by us: the Manual reviewer claims a rule that is not in the manual.</p>}
          <div className="rv-grid">
            {shown.reviews.map((r) => (
              <article key={r.authority} className="rv-card" data-ui data-set-aside={r.quote_checked ? undefined : ""}>
                <div className="title-row">
                  <p className="rv-name">{WHO[r.authority].name}</p>
                  <Info id={`review.${r.authority}`} label="" />
                </div>
                <p className="rv-reads">{WHO[r.authority].reads}</p>
                <p className="rv-answer">{ANSWER[r.answer]}</p>
                <blockquote className="rv-quote" cite={r.url ?? undefined}>
                  &ldquo;{r.quote}&rdquo;
                </blockquote>
                {r.cite && r.url && (
                  <p className="rv-cite">
                    <a className="text-link" href={r.url} target="_blank" rel="noreferrer">
                      {r.cite}
                    </a>
                  </p>
                )}
                <p className="rv-check" data-ok={r.quote_checked ? "" : undefined}>
                  {r.quote_checked ? "Quote checked: found word for word in that passage." : `Set aside. ${r.set_aside_reason}`}
                </p>
                <p className="rv-reason">{r.reason.plain}</p>
                {prefs.mode === "technical" && (
                  <p className="result-tech">
                    {r.reason.technical} Passage {r.passage_id}. Confidence {Math.round(r.confidence * 100)}%.
                  </p>
                )}
              </article>
            ))}
          </div>
          <div className="rv-verdict" data-ui role="status">
            <p className="result-k">The referee</p>
            <p className="rv-summary">{shown.referee.summary}</p>
            {shown.outcome.route && shown.outcome.check_after !== null && (
              <p className="rv-outcome">
                Giftwise will {ROUTE[shown.outcome.route]}. Her {checkMonthName(addMonths(input.date.slice(0, 7), P.rmaLagMonths))} check stays{" "}
                <span className="tabular rv-check-v">{usd(shown.outcome.check_after)}</span>.
              </p>
            )}
            {trusted !== null && <p className="rv-trusted">Had Giftwise trusted that answer and paid the company, her check would have been {usd(trusted)}.</p>}
            {prefs.mode === "technical" && (
              <p className="result-tech">
                Decision {shown.referee.decision}. Readings checked: {shown.outcome.readings.join(" and ")}. Routes, worst case:{" "}
                {shown.outcome.routes.map((r) => `${r.delivery} ${usd(r.check)}`).join(", ")}. Rules {shown.outcome.rule_ids.join(", ")}.
              </p>
            )}
          </div>
        </>
      )}

      <div className="rv-actions" aria-live="polite">
        <button type="button" className="btn btn-primary" onClick={run} disabled={status === "running"}>
          {status === "running" ? "The reviewers are reading…" : data ? "Run the reviewers again, live" : "Ask the two reviewers"}
        </button>
        {data && (
          <button type="button" className="btn btn-quiet" onClick={() => setTest((t) => !t)} aria-pressed={test}>
            {test ? "Back to the real answers" : "What if a reviewer gets it wrong?"}
          </button>
        )}
        <AiBudget refresh={runs} />
        {status === "running" && <p className="muted">Both reviewers read their rulebooks at the same time. This takes about 20 seconds.</p>}
        {status === "error" && <p className="result-attention">{note}</p>}
        {source && status !== "running" && <p className="muted rv-source">{source}</p>}
      </div>
    </section>
  );
}
