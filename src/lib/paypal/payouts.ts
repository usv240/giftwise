import { and, eq, isNull, sql } from "drizzle-orm";
import { today } from "@/lib/api/envelope";
import { audit } from "@/lib/audit";
import { db, schema } from "@/lib/db";
import { log } from "@/lib/log";
import { getHousehold, openNeeds, payeeEmail } from "@/lib/households";
import { paypalRest } from "@/lib/paypal/client";
import { routeGift } from "@/lib/routing";
import { DEFAULT_PROFILE, usd, type Profile } from "@/lib/rules";

/**
 * PayPal Payouts for organizations that already hold money for families: a disability foundation, a mutual-aid fund,
 * a church. One batch pays many households' needs at once, each grant routed by the rules engine, and every item goes
 * straight to the shop or the ABLE account. The money leaves the organization's own PayPal account (in the sandbox,
 * this app's business account); Giftwise never holds it.
 */
export const FUNDER = "Brookfield Disability Fund (sample)";
export const LIMITS = { perHousehold: 250, perBatch: 500, households: 5, batchesPerVisitorPerDay: 3, totalPerDay: 1500 } as const;

type PayoutItem = { payout_item_id?: string; transaction_id?: string; transaction_status?: string; payout_item?: { sender_item_id?: string } };
type PayoutBatch = { batch_header?: { payout_batch_id?: string; batch_status?: string }; items?: PayoutItem[]; name?: string; message?: string; details?: { issue?: string }[] };

export type Grant = { slug: string; amount: number };
export type PlannedItem = { senderItemId: string; householdId: number; household: string; needId: number | null; title: string; payeeName: string; payeeEmail: string; route: string; amount: number; ruleIds: string[] };

/** Route each household's grant with the rules engine. Every line keeps that household's check whole, or the grant is refused. */
export async function planGrants(grants: Grant[]) {
  const items: PlannedItem[] = [];
  const households: { slug: string; name: string; checkWithGrant: number; checkIfCash: number; unplaced: number }[] = [];
  for (const g of grants) {
    const data = await getHousehold(g.slug);
    if (!data) return { error: `No gift page named "${g.slug}".` } as const;
    const profile: Profile = { ...DEFAULT_PROFILE, ...(data.household.profile as Partial<Profile>) };
    const plan = routeGift(g.amount, openNeeds(data.needs), today(), profile, `${data.household.name}'s ABLE account`);
    if (plan.lines.length === 0) return { error: `There is no benefit-safe place for a grant to ${data.household.name} right now.` } as const;
    if (plan.checkWithRouting < plan.baseline) return { error: `A grant to ${data.household.name} would lower the SSI check, so it was not sent.` } as const;
    for (const l of plan.lines) {
      items.push({
        senderItemId: `h${data.household.id}-${l.referenceId}`.slice(0, 63),
        householdId: data.household.id,
        household: data.household.name,
        needId: l.needId,
        title: l.title,
        payeeName: l.payeeName,
        payeeEmail: payeeEmail(l.payeeAccount),
        route: l.route,
        amount: l.amount,
        ruleIds: l.ruleIds,
      });
    }
    households.push({ slug: g.slug, name: data.household.name, checkWithGrant: plan.checkWithRouting, checkIfCash: plan.checkIfCash, unplaced: plan.unplaced });
  }
  return { items, households } as const;
}

/** Send one Payouts batch for the planned items and record every item. */
export async function sendBatch(items: PlannedItem[]) {
  const senderBatchId = `giftwise-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const res = await paypalRest<PayoutBatch>("/v1/payments/payouts", {
    method: "POST",
    requestId: senderBatchId,
    body: JSON.stringify({
      sender_batch_header: { sender_batch_id: senderBatchId, email_subject: "A benefit-safe grant through Giftwise", email_message: `${FUNDER} sent this through Giftwise.` },
      items: items.map((i) => ({
        recipient_type: "EMAIL",
        receiver: i.payeeEmail,
        amount: { value: i.amount.toFixed(2), currency: "USD" },
        note: `${i.title} for ${i.household}, from ${FUNDER}`.slice(0, 4000),
        sender_item_id: i.senderItemId,
      })),
    }),
  });
  const batchId = res.body.batch_header?.payout_batch_id;
  if (res.status >= 400 || !batchId) {
    const issue = res.body.details?.[0]?.issue ?? res.body.name ?? "PAYOUT_FAILED";
    log.warn("payout batch not started", { issue, debugId: res.debugId, status: res.status, items: items.length });
    return { ok: false as const, issue, message: issue === "INSUFFICIENT_FUNDS" ? "The fund's sandbox balance is too low for this batch." : "PayPal could not start the payout. Please try again.", debugId: res.debugId };
  }
  await db()
    .insert(schema.payouts)
    .values(items.map((i) => ({ batchId, senderItemId: i.senderItemId, funder: FUNDER, householdId: i.householdId, needId: i.needId, title: i.title, payeeName: i.payeeName, payeeEmail: i.payeeEmail, route: i.route, amount: i.amount.toFixed(2) })));
  log.info("payout batch created", { batchId, items: items.length, batchStatus: res.body.batch_header?.batch_status ?? "PENDING" });
  await audit("person", "paypal.payout_batch.created", `payout:${batchId}`, {
    funder: FUNDER,
    total: items.reduce((s, i) => s + i.amount, 0),
    items: items.map((i) => ({ ref: i.senderItemId, amount: i.amount, route: i.route, rules: i.ruleIds })),
  });
  return { ok: true as const, batchId, status: res.body.batch_header?.batch_status ?? "PENDING" };
}

/**
 * Ask PayPal for the batch and record each item's status. A succeeded item counts toward its need once: the
 * counted_at guard means a resync, a webhook and a page view can all call this without counting twice.
 */
export async function syncBatch(batchId: string, actor: "person" | "webhook" = "person") {
  const res = await paypalRest<PayoutBatch>(`/v1/payments/payouts/${batchId}?page_size=100`, { method: "GET" });
  if (res.status >= 400) return { ok: false as const, status: res.status };
  const d = db();
  let counted = 0;
  for (const it of res.body.items ?? []) {
    const ref = it.payout_item?.sender_item_id;
    if (!ref) continue;
    const status = it.transaction_status ?? "PENDING";
    const [row] = await d
      .update(schema.payouts)
      .set({ status, itemId: it.payout_item_id ?? null, transactionId: it.transaction_id ?? null, updatedAt: new Date() })
      .where(and(eq(schema.payouts.batchId, batchId), eq(schema.payouts.senderItemId, ref)))
      .returning();
    if (row && status === "SUCCESS") {
      const [claimed] = await d
        .update(schema.payouts)
        .set({ countedAt: new Date() })
        .where(and(eq(schema.payouts.id, row.id), isNull(schema.payouts.countedAt)))
        .returning();
      if (claimed?.needId) {
        await d
          .update(schema.needs)
          .set({
            funded: sql`${schema.needs.funded} + ${claimed.amount}`,
            status: sql`case when ${schema.needs.funded} + ${claimed.amount} >= ${schema.needs.amount} then 'paid' else 'partial' end`,
          })
          .where(eq(schema.needs.id, claimed.needId));
      }
      if (claimed) counted++;
    }
  }
  if (counted) await audit(actor, "paypal.payout_items.succeeded", `payout:${batchId}`, { counted });
  return { ok: true as const, batchStatus: res.body.batch_header?.batch_status ?? "PENDING", counted };
}

export async function batchRows(batchId: string) {
  return db().select().from(schema.payouts).where(eq(schema.payouts.batchId, batchId)).orderBy(schema.payouts.id);
}

export const describeItem = (r: { amount: string; payeeName: string; title: string }) => `${usd(Number(r.amount))} to ${r.payeeName} (${r.title})`;
