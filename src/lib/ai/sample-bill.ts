import { readFile } from "node:fs/promises";
import path from "node:path";
import recorded from "../../../content/reviews/electric-bill-read.json";
import { DEFAULT_PROFILE, checkMonthName, evaluateGift, type Category } from "../rules";
import { aiSpentToday } from "./budget";
import { AI_DAILY_CAP_USD, AiUnavailableError, aiAvailable } from "./claude";
import { readBill, type Bill } from "./tasks";
import { prepareFile, type PreparedFile } from "./upload";

export { aiSpentToday };

/**
 * The one live AI step on the visitor's path: Claude reads the sample electric bill (public/samples) now, and the rules
 * engine prices it. It runs live while the day's AI spend is under the site's daily budget (AI_DAILY_CAP_USD, the
 * figure /ops shows). With no key, or once the budget is spent, the same request is answered from Claude's recorded
 * answer to it (content/ai-replay), so the real reader and rules engine run and the result says "replayed"; on a
 * checkout without the recording, the saved reading in content/reviews/electric-bill-read.json is shown, labelled.
 */
export const SAMPLE_BILL = "northside-electric-bill.png";
/** The preset's gift date, so the live reading prices the same check the example on the page does. */
const GIFT_DATE = "2026-04-10";

export type SampleRead = {
  mode: "live" | "replayed" | "recorded";
  /** Why it is not live: no AI key on this server, the day's budget spent, or the live call failed. */
  reason: "no_key" | "budget" | "error" | null;
  read_at: string;
  model: string;
  ms: number | null;
  bill: Pick<Bill, "vendor_name" | "vendor_category" | "amount_due" | "due_date" | "is_shelter_cost" | "confidence" | "explanation">;
  check: { month: string; paid_to_company: number; through_able: number; full: number; rule_ids: string[] };
  budget: { spent_today: number; cap: number };
};

/** The engine's answer for a reading: the check paid to the company, and through her ABLE account. */
export function priceReading(bill: Pick<Bill, "vendor_category" | "amount_due" | "vendor_name">) {
  const gift = { id: "sample-bill", date: GIFT_DATE, amount: bill.amount_due, category: bill.vendor_category as Category, recurring: true, label: bill.vendor_name };
  const vendor = evaluateGift({ ...gift, delivery: "vendor" }, DEFAULT_PROFILE);
  const able = evaluateGift({ ...gift, delivery: "able" }, DEFAULT_PROFILE);
  return { month: checkMonthName(vendor.paymentMonth), paid_to_company: vendor.checkAfter, through_able: able.checkAfter, full: vendor.checkBaseline, rule_ids: vendor.ruleIds };
}

const pick = (b: Bill): SampleRead["bill"] => ({
  vendor_name: b.vendor_name,
  vendor_category: b.vendor_category,
  amount_due: b.amount_due,
  due_date: b.due_date,
  is_shelter_cost: b.is_shelter_cost,
  confidence: b.confidence,
  explanation: b.explanation,
});

/** The recorded reading, labelled with why it is shown. */
export function recordedRead(reason: SampleRead["reason"], spent: number): SampleRead {
  const bill = recorded.data as Bill;
  return { mode: "recorded", reason, read_at: recorded.recorded_at, model: recorded.model, ms: recorded.ms, bill: pick(bill), check: priceReading(bill), budget: { spent_today: spent, cap: AI_DAILY_CAP_USD } };
}

/** Claude reads the sample bill: one structured call, the same one /api/v1/read-bill makes for this file. */
export async function readSampleBillLive(how: { replayOnly?: boolean } = {}): Promise<{ bill: Bill; model: string; ms: number; replayed: boolean; recordedAt?: string }> {
  const file = await sampleBillFile();
  const t = Date.now();
  const { data, model, replayed, recordedAt } = await readBill(file, how);
  return { bill: data, model, ms: Date.now() - t, replayed, recordedAt };
}

/** The sample bill as an upload of it is sent (src/lib/ai/upload.ts). */
export async function sampleBillFile(): Promise<PreparedFile> {
  return prepareFile(await readFile(path.join(process.cwd(), "public", "samples", SAMPLE_BILL)), "image/png");
}

/**
 * Live when the key is set and today's spend is under the budget. With no key, or the budget spent, the reader runs on
 * Claude's recorded answer to this exact request ("replayed"); the saved reading is shown when there is no recording,
 * and when a live call fails. Each says why it is not live.
 */
export async function sampleBillRead(): Promise<SampleRead> {
  const spent = await aiSpentToday().catch(() => 0);
  const live = aiAvailable();
  const why: SampleRead["reason"] = !live ? "no_key" : spent >= AI_DAILY_CAP_USD ? "budget" : null;
  try {
    const { bill, model, ms, replayed, recordedAt } = await readSampleBillLive({ replayOnly: why !== null });
    return {
      mode: replayed ? "replayed" : "live",
      reason: replayed ? why : null,
      read_at: recordedAt ?? new Date().toISOString(),
      model,
      ms: replayed ? null : ms,
      bill: pick(bill),
      check: priceReading(bill),
      budget: { spent_today: spent, cap: AI_DAILY_CAP_USD },
    };
  } catch (e) {
    if (why && e instanceof AiUnavailableError) return recordedRead(why, spent);
    return recordedRead("error", spent);
  }
}
