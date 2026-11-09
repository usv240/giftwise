import { and, eq, isNotNull } from "drizzle-orm";
import sample from "../../../content/sample-year.json";
import { db, dbConfigured, schema } from "@/lib/db";
import { SAMPLE, getHousehold } from "@/lib/households";
import { RECORDED_RECEIPT } from "@/lib/sample-receipt";
import { DEFAULT_PROFILE, type Category, type Delivery, type Profile } from "@/lib/rules";
import { paymentDay, payoutDay } from "@/lib/time";
import type { ReportGift } from "./ssa";

type Sample = { date: string; giver: string; need: string; paidTo: string; delivery: Delivery; category: Category; amount: number; recurring: boolean };

export type GiftSubject = { slug: string; name: string; isSample: boolean; profile: Profile; gifts: ReportGift[] };

type Need = { title: string; category: string } | undefined;
type PaymentRow = Pick<typeof schema.payments.$inferSelect, "id" | "capturedAt" | "createdAt" | "amount" | "route" | "payerName" | "payeeName" | "orderId" | "captureId">;
type PayoutRow = Pick<typeof schema.payouts.$inferSelect, "id" | "updatedAt" | "amount" | "route" | "funder" | "payeeName" | "batchId" | "transactionId">;

/**
 * A PayPal capture as a gift on the report. Its date is the income date: the day PayPal captured it, in Pacific time
 * (src/lib/time.ts), the same day the receipt shows and the routing priced it in.
 */
export function paymentGift(p: PaymentRow, need: Need): ReportGift {
  return {
    id: `p${p.id}`,
    date: paymentDay(p),
    amount: Number(p.amount),
    delivery: p.route as Delivery,
    category: (need?.category ?? "other") as Category,
    giver: p.payerName?.split(" ")[0] || "A giver",
    need: need?.title ?? "Savings",
    paidTo: p.payeeName,
    recurring: false,
    evidence: { kind: "paypal_capture", orderId: p.orderId, captureId: p.captureId },
  };
}

/** A grant PayPal Payouts reports as paid, dated the day it was reported paid, in Pacific time. */
export function payoutGift(g: PayoutRow, need: Need): ReportGift {
  return {
    id: `o${g.id}`,
    date: payoutDay(g),
    amount: Number(g.amount),
    delivery: g.route as Delivery,
    category: (need?.category ?? "other") as Category,
    giver: g.funder.replace(/ \(sample\)$/, ""),
    need: need?.title ?? "Savings",
    paidTo: g.payeeName,
    recurring: false,
    evidence: { kind: "paypal_payout", batchId: g.batchId, transactionId: g.transactionId },
  };
}

/**
 * Every gift for one gift page, each with the record that proves where it went: the sample year for the demo
 * household, then every PayPal capture and every PayPal Payouts item the site recorded for that household.
 *
 * The sample page also carries its recorded sandbox order (content/sample-receipt.json): a real capture kept as an
 * earlier round, so it never counts toward the page's open needs. It is listed in the month it was captured, so that
 * month's report names real PayPal captures and its check page asks PayPal for each one.
 */
export async function giftSubject(slug: string): Promise<GiftSubject | null> {
  const isMaya = slug === SAMPLE.slug;
  const gifts: ReportGift[] = isMaya
    ? (sample.gifts as Sample[]).map((g, i) => ({ id: `s${i}`, date: g.date, amount: g.amount, delivery: g.delivery, category: g.category, giver: g.giver, need: g.need, paidTo: g.paidTo, recurring: g.recurring, evidence: { kind: "sample" } }))
    : [];
  let name: string = SAMPLE.name;
  let profile: Profile = { ...DEFAULT_PROFILE, ...(SAMPLE.profile as Partial<Profile>) };
  let isSample = isMaya;

  if (dbConfigured()) {
    const data = await getHousehold(slug);
    if (!data) return isMaya ? { slug, name, isSample, profile, gifts } : null;
    name = data.household.name;
    isSample = data.household.isSample;
    profile = { ...DEFAULT_PROFILE, ...(data.household.profile as Partial<Profile>) };
    const needOf = (id: number | null) => data.needs.find((n) => n.id === id);

    // The current round's captures, then the recorded order's (archived) rows when this page is the sample.
    const recorded = isMaya
      ? await db()
          .select()
          .from(schema.payments)
          .where(and(eq(schema.payments.householdId, data.household.id), eq(schema.payments.orderId, RECORDED_RECEIPT.order_id), eq(schema.payments.status, "captured"), isNotNull(schema.payments.archivedAt)))
      : [];
    for (const p of [...data.payments, ...recorded.filter((r) => !data.payments.some((c) => c.id === r.id))]) gifts.push(paymentGift(p, needOf(p.needId)));

    // Grants a fund sent through PayPal Payouts that PayPal reports as paid.
    const grants = await db()
      .select()
      .from(schema.payouts)
      .where(and(eq(schema.payouts.householdId, data.household.id), eq(schema.payouts.status, "SUCCESS")));
    for (const g of grants) gifts.push(payoutGift(g, needOf(g.needId)));
  } else if (!isMaya) {
    return null;
  }

  gifts.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return { slug, name, isSample, profile, gifts };
}
