import { readFile } from "node:fs/promises";
import path from "node:path";
import { prepareFile, type PreparedFile } from "./upload";

/**
 * The sample letter the "Read her letter" step offers: a made-up notice for a fictional person, Sam, drawn by
 * scripts/make-sample-letter.mjs in Giftwise's own type, marked on the page as a sample made for this demo and not from
 * Social Security. Claude's answer to each file is recorded once (scripts/record-letter-read.ts, content/reviews) and
 * kept in the replay set, so the sample reads with no AI key, labelled Replayed.
 */
export const SAMPLE_LETTER = { png: "sam-ssa-letter-sample.png", pdf: "sam-ssa-letter-sample.pdf" } as const;
export type SampleLetterKind = keyof typeof SAMPLE_LETTER;
export const SAMPLE_LETTER_TYPE: Record<SampleLetterKind, string> = { png: "image/png", pdf: "application/pdf" };

/** The sample letter's bytes, and the file as an upload of it is sent to Claude (src/lib/ai/upload.ts). */
export async function sampleLetterFile(kind: SampleLetterKind): Promise<{ bytes: Buffer; prepared: PreparedFile }> {
  const bytes = await readFile(path.join(process.cwd(), "public", "samples", SAMPLE_LETTER[kind]));
  return { bytes, prepared: await prepareFile(bytes, SAMPLE_LETTER_TYPE[kind]) };
}
