import { and, eq } from "drizzle-orm";
import sample from "../../../content/sample-year.json";
import { db, dbConfigured, schema } from "@/lib/db";
import { SAMPLE, getHousehold } from "@/lib/households";
import { DEFAULT_PROFILE, type Category, type Delivery, type Profile } from "@/lib/rules";
import type { ReportGift } from "./ssa";

type Sample = { date: string; giver: string; need: string; paidTo: string; delivery: Delivery; category: Category; amount: number; recurring: boolean };

export type GiftSubject = { slug: string; name: string; isSample: boolean; profile: Profile; gifts: ReportGift[] };

/**
 * Every gift for one gift page, each with the record that proves where it went: the sample year for the demo
 * household, then every PayPal capture and every PayPal Payouts item the site recorded for that household.
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

    for (const p of data.payments) {
      const need = needOf(p.needId);
      gifts.push({
        id: `p${p.id}`,
        date: (p.capturedAt ?? p.createdAt).toISOString().slice(0, 10),
        amount: Number(p.amount),
        delivery: p.route as Delivery,
        category: (need?.category ?? "other") as Category,
        giver: p.payerName?.split(" ")[0] || "A giver",
        need: need?.title ?? "Savings",
        paidTo: p.payeeName,
        recurring: false,
        evidence: { kind: "paypal_capture", orderId: p.orderId, captureId: p.captureId },
      });
    }

    // Grants a fund sent through PayPal Payouts that PayPal reports as paid.
    const grants = await db()
      .select()
      .from(schema.payouts)
      .where(and(eq(schema.payouts.householdId, data.household.id), eq(schema.payouts.status, "SUCCESS")));
    for (const g of grants) {
      const need = needOf(g.needId);
      gifts.push({
        id: `o${g.id}`,
        date: g.updatedAt.toISOString().slice(0, 10),
        amount: Number(g.amount),
        delivery: g.route as Delivery,
        category: (need?.category ?? "other") as Category,
        giver: g.funder.replace(/ \(sample\)$/, ""),
        need: need?.title ?? "Savings",
        paidTo: g.payeeName,
        recurring: false,
        evidence: { kind: "paypal_payout", batchId: g.batchId, transactionId: g.transactionId },
      });
    }
  } else if (!isMaya) {
    return null;
  }

  gifts.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return { slug, name, isSample, profile, gifts };
}
