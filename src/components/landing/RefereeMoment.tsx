import Link from "next/link";
import { cacheLife } from "next/cache";
import { modelName } from "@/lib/ai/model-name";
import { SAMPLE_REVIEW, reviewCase } from "@/lib/ai/replay-set";
import { reviewPayload, runReviewers } from "@/lib/ai/reviewers";
import { AUTHORITY } from "@/lib/review/referee";
import { DEFAULT_PROFILE, P, addMonths, checkMonthName, usd } from "@/lib/rules";

const YEAR = 60 * 60 * 24 * 365;
const ANSWER: Record<string, string> = { shelter: "A housing cost", not_shelter: "Not a housing cost", unclear: "Not settled by its rulebook" };
const ROUTE: Record<string, string> = { vendor: "pays the company directly", able: "sends it to her ABLE account" };

/**
 * One referee moment for the home page, from the replay set (content/ai-replay): the two reviewers' recorded answers on
 * the sample electric bill run through the real code now, at build time. The quote check, the referee and the rules
 * engine run on them exactly as on a live answer; no model is called and no usage is recorded.
 */
async function refereeMoment(day: string) {
  "use cache";
  // The recorded answers change only with a new build, so the home page keeps the one-year static lifetime it has
  // without this block (s-maxage=31536000, no stale-while-revalidate, which made browsers revalidate its prefetch).
  cacheLife({ stale: 300, revalidate: YEAR, expire: YEAR });
  try {
    const run = await runReviewers(reviewCase(SAMPLE_REVIEW, day), DEFAULT_PROFILE, { replayOnly: true });
    return { ...reviewPayload(run), model: run.model, recordedAt: run.recordedAt ?? null, day };
  } catch {
    return null;
  }
}

export async function RefereeMoment() {
  const day = process.env.NEXT_PUBLIC_BUILD_DAY || new Date().toISOString().slice(0, 10);
  const m = await refereeMoment(day);
  if (!m) return null;
  const month = checkMonthName(addMonths(day.slice(0, 7), P.rmaLagMonths));
  const recorded = m.recordedAt ? new Date(m.recordedAt).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" }) : null;
  return (
    <section className="refm" data-ui aria-labelledby="refm-h">
      <h2 id="refm-h" className="refm-h">
        Is a {usd(SAMPLE_REVIEW.amount)} electric bill a housing cost? Two reviewers answer from two rulebooks.
      </h2>
      <div className="refm-votes">
        {m.reviews.map((v) => (
          <figure key={v.authority} className="refm-vote">
            <figcaption className="refm-who">
              <span>{AUTHORITY[v.authority].name}</span>
              <span className="refm-answer" data-answer={v.answer}>
                {ANSWER[v.answer] ?? v.answer}
              </span>
            </figcaption>
            <blockquote className="refm-quote" cite={v.url ?? undefined}>
              <p>&ldquo;{v.quote}&rdquo;</p>
            </blockquote>
            <p className="refm-cite">
              {v.url ? (
                <a className="text-link" href={v.url} target="_blank" rel="noreferrer">
                  {v.cite}
                </a>
              ) : (
                v.cite
              )}
              . {v.quote_checked ? "Found word for word by code." : `Set aside: ${v.set_aside_reason}`}
            </p>
          </figure>
        ))}
      </div>
      <p className="refm-verdict">
        <span className="refm-k">The referee, in code.</span> {m.referee.summary}{" "}
        {m.outcome.route && m.outcome.check_after !== null && (
          <>
            Giftwise {ROUTE[m.outcome.route]}, and her {month} check stays <span className="tabular">{usd(m.outcome.check_after)}</span>.
          </>
        )}
      </p>
      <p className="refm-src muted">
        Replayed: {modelName(m.model)}&rsquo;s recorded answers{recorded ? ` of ${recorded}` : ""}, run through the same quote check, referee and rules engine.{" "}
        <Link className="text-link" href="/evidence/rules#referee">
          When the reviewers disagree
        </Link>
      </p>
    </section>
  );
}
