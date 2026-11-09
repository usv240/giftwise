import authorities from "../../../content/authorities.json";
import billRead from "../../../content/reviews/electric-bill-read.json";
import docs from "../../app/developers/docs/recorded.json";
import { ENDPOINTS } from "../api/endpoints";
import { readBundledSample } from "../sponsors/kernel";
import type { Category } from "../rules";
import { replayKey } from "./claude";
import { reviewRequest, type ReviewCase } from "./reviewers";
import { sampleBillFile } from "./sample-bill";
import { billRequest, fundraiserRequest } from "./tasks";

/**
 * The committed replay set (content/ai-replay): Claude's recorded answers for the samples a visitor can run, each keyed
 * by the request the current code sends for that sample. Only recordings made with the prompt, schema and rulebook
 * passages the code sends now are used: the sample bill read (November 8), and the two reviewers and the sample
 * fundraiser from the API docs recording (November 5, after the passages were last fetched). scripts/build-ai-replay.ts
 * writes the set from here; tests/ai-replay.test.ts checks that every file on disk is one of these keys, so a changed
 * prompt, schema or passage shows up as a failing test until the sample is recorded again.
 */
export type ReplayEntry = { key: string; what: string; source: string; recorded_at: string; model: string; parsed_output: unknown };

/** A review input as the API and the Try page send it. */
export type SampleReviewInput = { description: string; amount: number; category: Category; date?: string; recurring?: boolean };

/** The sample bill as the reviewers are asked about it: the API docs' example, which /try and the home page run too. */
export const SAMPLE_REVIEW = ENDPOINTS.find((e) => e.id === "review-bill")!.example as SampleReviewInput;

/** The case the reviewers read for an input, as /api/v1/review-bill builds it (the date does not reach the prompt). */
export const reviewCase = (i: SampleReviewInput, date = i.date ?? "2026-04-10"): ReviewCase => ({
  description: i.description,
  gift: { id: "review", date, amount: i.amount, delivery: "vendor", category: i.category, recurring: i.recurring },
});

type RecordedVote = { authority: "regs" | "poms"; answer: string; passage_id: string; quote: string; reason: { plain: string; technical: string }; confidence: number };
/** A recorded vote, back in the shape the reviewer's schema asks Claude for. */
const asAnswer = (v: RecordedVote) => ({ answer: v.answer, passage_id: v.passage_id, quote: v.quote, reason_plain: v.reason.plain, reason_technical: v.reason.technical, confidence: v.confidence });

/** The sample fundraiser this site ships, named by its path. */
export const SAMPLE_FUNDRAISER = "/samples/fundraiser.html";

/** When the rulebook passages the reviewers read were last fetched: a reviewer recording older than this was asked with other passages. */
export const PASSAGES_FETCHED = authorities.fetched;

export async function replayEntries(): Promise<ReplayEntry[]> {
  const out: ReplayEntry[] = [];
  out.push({
    key: replayKey(billRequest(await sampleBillFile())),
    what: "Claude reads the sample electric bill (public/samples/northside-electric-bill.png)",
    source: "content/reviews/electric-bill-read.json",
    recorded_at: billRead.recorded_at,
    model: billRead.model,
    parsed_output: billRead.data,
  });
  const rb = docs.responses["review-bill"];
  for (const v of rb.data.reviews as RecordedVote[]) {
    out.push({
      key: replayKey(reviewRequest(v.authority, reviewCase(SAMPLE_REVIEW))),
      what: `The ${v.authority === "regs" ? "Regulations" : "Manual"} reviewer on "${SAMPLE_REVIEW.description}"`,
      source: "src/app/developers/docs/recorded.json (review-bill)",
      recorded_at: docs.recorded_at,
      model: rb.meta.model,
      parsed_output: asAnswer(v),
    });
  }
  const page = await readBundledSample(SAMPLE_FUNDRAISER);
  if (!page) throw new Error(`${SAMPLE_FUNDRAISER} is missing`);
  const fr = docs.responses["analyze-fundraiser"];
  out.push({
    key: replayKey(fundraiserRequest(page.text, SAMPLE_FUNDRAISER, SAMPLE_FUNDRAISER)),
    what: "Claude reads the sample fundraiser page (public/samples/fundraiser.html)",
    source: "src/app/developers/docs/recorded.json (analyze-fundraiser)",
    recorded_at: docs.recorded_at,
    model: fr.meta.model,
    parsed_output: fr.data.fundraiser,
  });
  return out;
}
