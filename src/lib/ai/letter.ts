import { z } from "zod";
import { normalizeQuote } from "../review/referee";
import { letterCheck, type Answers, type LetterCheck } from "../situation";
import type { Pronoun } from "../rules";
import { structured, type StructuredOpts } from "./claude";

/**
 * Claude reads a person's letter from Social Security about their SSI payment into the answers an organizer would
 * otherwise type: the payment and its month, the Social Security or other unearned income counted, wages counted, where
 * the person lives, and whether the payment is a couple's. Each fact carries a short quote from the letter. Claude never
 * computes the check: the rules engine computes it from the facts read and compares it with the payment the letter
 * states (letterCheck). The file is read in memory and never stored; only the answers the organizer confirms are saved.
 */

const quote = z.string().nullable().describe("A short quote, copied word for word from the letter, that states this fact: one sentence or one table line, under 200 characters. Null when the letter does not state it.");

export const LetterSchema = z.object({
  is_ssa_letter: z.boolean().describe("True when the document is a notice or letter about SSI (Supplemental Security Income) payments."),
  ssi_payment: z
    .object({
      amount: z.number().nullable().describe("The monthly SSI payment the letter says the person will receive, in dollars, as one monthly figure."),
      month: z
        .string()
        .nullable()
        .describe("The month that payment is for or starts in, as YYYY-MM. For example, 'Beginning January 2027' is 2027-01. Null when the letter names no month."),
      quote,
    })
    .describe("The monthly SSI payment the letter states."),
  other_income: z
    .array(
      z.object({
        kind: z.enum(["social_security", "other"]).describe("social_security for Social Security benefits (retirement, disability or survivor); other for any other unearned income, such as a pension or VA benefits."),
        monthly_amount: z.number().describe("The amount counted each month, in dollars, before any exclusion."),
        quote,
      }),
    )
    .describe("Unearned income the letter says Social Security counted each month. Not wages, not the SSI payment itself, and not the one-third reduction. Empty when none is stated."),
  wages: z
    .object({ monthly_amount: z.number().nullable().describe("Gross wages counted each month, in dollars, or null when the letter states none."), quote })
    .describe("Wages from work the letter says were counted."),
  living_arrangement: z
    .object({
      in_anothers_household: z
        .boolean()
        .nullable()
        .describe("True when the letter says the person lives in another person's household, or gets food or shelter from someone they live with. False when it says they live in their own household or pay their share. Null when not stated."),
      gets_all_meals: z
        .boolean()
        .nullable()
        .describe("Only when in another's household: true when the letter says that household provides both food and shelter, false when it says shelter only. Null when not stated."),
      quote,
    })
    .describe("Where the person lives, as the letter states it."),
  couple: z
    .object({ is_couple: z.boolean().nullable().describe("True when the payment is for a married couple who both receive SSI; false when it is for one person. Null when not stated."), quote })
    .describe("Whether the letter is about an eligible couple."),
  explanation: z.object({
    plain: z.string().describe("Under 40 words, everyday language, warm and direct: what the letter is and the payment it states. No advice."),
    technical: z.string().describe("Which lines were read for each field and how each was chosen."),
  }),
});
export type Letter = z.infer<typeof LetterSchema>;

const LETTER_SYSTEM = `You read letters and notices from Social Security about a person's SSI payment, for Giftwise, a tool that helps families give to someone on SSI without lowering their check.
Extract only what the letter states. If a fact is not stated, use null (or an empty list). Each quote is copied word for word from the letter, one sentence or table line.
Never return, and never include in any quote, a Social Security number, claim number, BNC or reference number, street address, phone number, or date of birth. When the only sentence stating a fact also holds one of these, quote a different line or leave the quote null.
Never compute benefit amounts and never give advice: Giftwise's rules engine computes the check from the facts you read and compares it with the payment the letter states.`;

/** The request that reads a letter: the document as data, the fields to fill. Its replay key names the file by `fileSha256`. */
export function letterRequest(file: { base64: string; mediaType: string; fileSha256?: string }): StructuredOpts<typeof LetterSchema> {
  const block =
    file.mediaType === "application/pdf"
      ? ({ type: "document", source: { type: "base64", media_type: "application/pdf", data: file.base64 } } as const)
      : ({ type: "image", source: { type: "base64", media_type: file.mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif", data: file.base64 } } as const);
  return {
    schema: LetterSchema,
    system: LETTER_SYSTEM,
    effort: "medium",
    maxTokens: 8000,
    content: [block, { type: "text", text: "Read this letter and fill in the fields." }],
    fileSha256: file.fileSha256,
  };
}

export async function readLetter(file: { base64: string; mediaType: string; fileSha256?: string }, how: { replayOnly?: boolean } = {}) {
  return structured(letterRequest(file), how);
}

/**
 * A Social Security number or claim number (nine digits, with or without dashes, a letter or two after a claim number),
 * a date of birth, a street address or a ZIP code. A quote holding one is set aside, whatever the model was told.
 */
const PRIVATE = [
  /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}(?:[A-Z]{1,2}\d?)?\b/i,
  /\b(?:date of birth|born on|birth ?date|DOB)\b/i,
  /\b\d{1,6}\s+(?:[A-Z][a-z]+\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Boulevard|Blvd|Court|Ct|Way|Place|Pl)\b\.?/,
  /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/,
  /\b(?:claim number|BNC|social security number|SSN)\b/i,
];
export const holdsPrivate = (s: string) => PRIVATE.some((r) => r.test(s));

/** A quote with anything private set aside: null in its place. */
const safeQuote = (q: string | null | undefined) => (q && !holdsPrivate(q) ? q.slice(0, 240) : null);

/** Whether a quote appears in the letter's own text: true, false, or null when there is no text layer to check. */
export function quoteFound(q: string | null, text: string | null): boolean | null {
  if (!q || !text) return null;
  const want = normalizeQuote(q).replace(/^["'\s.]+|["'\s.]+$/g, "");
  if (want.length < 8) return null;
  const hay = normalizeQuote(text);
  // A PDF's text layer can split words where the letter's layout breaks a line, so spaces are compared loosely too.
  return hay.includes(want) || hay.replace(/\s+/g, "").includes(want.replace(/\s+/g, ""));
}

/** The facts read, mapped onto the plain questions. A fact the letter does not state stays unanswered. */
export function answersFromLetter(l: Letter): Answers {
  const a: Answers = {};
  const living = l.living_arrangement;
  if (living.in_anothers_household === true) {
    a.home = "other";
    if (typeof living.gets_all_meals === "boolean") a.meals = living.gets_all_meals;
  } else if (living.in_anothers_household === false) a.home = "own";
  if (l.other_income.length) a.benefits = Math.round(l.other_income.reduce((s, x) => s + Math.max(0, x.monthly_amount), 0) * 100) / 100;
  if (typeof l.wages.monthly_amount === "number") a.wages = Math.max(0, l.wages.monthly_amount);
  if (typeof l.couple.is_couple === "boolean") a.couple = l.couple.is_couple;
  return a;
}

export type LetterReading = {
  is_ssa_letter: boolean;
  ssi_payment: { amount: number | null; month: string | null; quote: string | null; quote_found: boolean | null };
  other_income: { kind: "social_security" | "other"; monthly_amount: number; quote: string | null; quote_found: boolean | null }[];
  wages: { monthly_amount: number | null; quote: string | null; quote_found: boolean | null };
  living_arrangement: { in_anothers_household: boolean | null; gets_all_meals: boolean | null; quote: string | null; quote_found: boolean | null };
  couple: { is_couple: boolean | null; quote: string | null; quote_found: boolean | null };
  explanation: { plain: string; technical: string };
};

/**
 * What a reading returns: the facts with their quotes (anything private set aside, and each quote checked against the
 * letter's text layer when it has one), the answers they fill in, and the rules engine's check against the letter.
 */
export function letterResult(l: Letter, text: string | null, pronoun?: Pronoun): { letter: LetterReading; answers: Answers; check: LetterCheck; quotes: { checked: number; found: number; set_aside: number; text_layer: boolean } } {
  let setAside = 0;
  const q = (s: string | null | undefined) => {
    const safe = safeQuote(s);
    if (s && !safe) setAside++;
    return { quote: safe, quote_found: quoteFound(safe, text) };
  };
  const letter: LetterReading = {
    is_ssa_letter: l.is_ssa_letter,
    ssi_payment: { amount: l.ssi_payment.amount, month: l.ssi_payment.month, ...q(l.ssi_payment.quote) },
    other_income: l.other_income.map((x) => ({ kind: x.kind, monthly_amount: x.monthly_amount, ...q(x.quote) })),
    wages: { monthly_amount: l.wages.monthly_amount, ...q(l.wages.quote) },
    living_arrangement: { in_anothers_household: l.living_arrangement.in_anothers_household, gets_all_meals: l.living_arrangement.gets_all_meals, ...q(l.living_arrangement.quote) },
    couple: { is_couple: l.couple.is_couple, ...q(l.couple.quote) },
    explanation: { plain: holdsPrivate(l.explanation.plain) ? "Claude read the letter." : l.explanation.plain, technical: holdsPrivate(l.explanation.technical) ? "" : l.explanation.technical },
  };
  const all = [letter.ssi_payment, ...letter.other_income, letter.wages, letter.living_arrangement, letter.couple].map((x) => x.quote_found).filter((x) => x !== null);
  const answers = answersFromLetter(l);
  return {
    letter,
    answers,
    check: letterCheck(answers, { amount: l.ssi_payment.amount, month: l.ssi_payment.month }, pronoun),
    quotes: { checked: all.length, found: all.filter(Boolean).length, set_aside: setAside, text_layer: Boolean(text) },
  };
}
