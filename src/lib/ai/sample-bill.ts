import { readFile } from "node:fs/promises";
import path from "node:path";
import { sql } from "drizzle-orm";
import sharp from "sharp";
import recorded from "../../../content/reviews/electric-bill-read.json";
import { db, dbConfigured } from "../db";
import { rowsOf } from "../rate-limit";
import { DEFAULT_PROFILE, checkMonthName, evaluateGift, type Category } from "../rules";
import { AI_DAILY_CAP_USD, aiAvailable } from "./claude";
import { readBill, type Bill } from "./tasks";

/**
 * The one live AI step on the judge's path: Claude reads the sample electric bill (public/samples) now, and the rules
 * engine prices it. It runs only while the day's AI spend is under the site's daily budget (AI_DAILY_CAP_USD, the
 * figure /ops shows), and otherwise shows the recorded reading in content/reviews/electric-bill-read.json, labelled.
 */
export const SAMPLE_BILL = "northside-electric-bill.png";
/** The preset's gift date, so the live reading prices the same check the example on the page does. */
const GIFT_DATE = "2026-04-10";

export type SampleRead = {
  mode: "live" | "recorded";
  /** Why the recording is shown: no AI key on this server, the day's budget spent, or the live call failed. */
  reason: "no_key" | "budget" | "error" | null;
  read_at: string;
  model: string;
  ms: number | null;
  bill: Pick<Bill, "vendor_name" | "vendor_category" | "amount_due" | "due_date" | "is_shelter_cost" | "confidence" | "explanation">;
  check: { month: string; paid_to_company: number; through_able: number; full: number; rule_ids: string[] };
  budget: { spent_today: number; cap: number };
};

/** What the site's AI calls cost today, in US Pacific time, from the ai_usage table /ops reads. */
export async function aiSpentToday(): Promise<number> {
  if (!dbConfigured()) return 0;
  const r = await db().execute(sql`select coalesce(sum(cost_usd), 0) as cost from ai_usage where created_at >= (date_trunc('day', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles')`);
  return Number(rowsOf<{ cost: string }>(r)[0]?.cost ?? 0);
}

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

/** Claude reads the sample bill now: one structured call, the same one /api/v1/read-bill makes. */
export async function readSampleBillLive(): Promise<{ bill: Bill; model: string; ms: number }> {
  const buf = await readFile(path.join(process.cwd(), "public", "samples", SAMPLE_BILL));
  const out = await sharp(buf).resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  const t = Date.now();
  const { data, model } = await readBill({ base64: out.toString("base64"), mediaType: "image/jpeg" });
  return { bill: data, model, ms: Date.now() - t };
}

/** Live when the key is set and today's spend is under the budget; the recording otherwise, saying why. */
export async function sampleBillRead(): Promise<SampleRead> {
  const spent = await aiSpentToday().catch(() => 0);
  if (!aiAvailable()) return recordedRead("no_key", spent);
  if (spent >= AI_DAILY_CAP_USD) return recordedRead("budget", spent);
  try {
    const { bill, model, ms } = await readSampleBillLive();
    return { mode: "live", reason: null, read_at: new Date().toISOString(), model, ms, bill: pick(bill), check: priceReading(bill), budget: { spent_today: spent, cap: AI_DAILY_CAP_USD } };
  } catch {
    return recordedRead("error", spent);
  }
}
