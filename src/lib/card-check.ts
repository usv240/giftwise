import { asc, eq } from "drizzle-orm";
import { connectPayPalMcp } from "./agent/paypal-mcp";
import { db, schema } from "./db";
import { SAMPLE, payeeEmail } from "./households";
import { captureAndRecord } from "./paypal/capture";
import { paypalRest } from "./paypal/client";
import { paypalEnv } from "./paypal/env";
import { startRoutedGift } from "./paypal/gift-order";
import { usd } from "./rules";
import { failureKind } from "./scrub";

/**
 * The nightly card check: one gift paid end to end with no PayPal login, the way PayPal's guest card form pays one.
 *
 * 1. The rules engine routes a small gift for a check-only copy of the sample page: Maya's four needs, with her shops,
 *    her ABLE account and her profile, at small amounts, so the gift fills all four and leaves some for savings.
 * 2. startRoutedGift, the same code the gift page's button calls, creates ONE Orders v2 order with a purchase unit,
 *    and a payee, for every recipient.
 * 3. PayPal's published sandbox test card pays it (confirm-payment-source with payment_source.card), standing in for
 *    the card form a giver fills in.
 * 4. captureAndRecord, the code the button's approval calls, captures it and records every unit.
 * 5. PayPal's own copy of the order is read back, from the Orders API and from PayPal's MCP server (get_order), and
 *    every purchase unit must be captured, for its routed amount, to its routed payee.
 *
 * Maya's own page is never touched: the copy has its own needs, reopened before each run, and every receipt stays.
 * The copy is marked as the test suites' own page (organizer "E2E"), so /organizations leaves it out, and like every
 * page that is not the sample it is not indexed.
 */

/** PayPal's published sandbox Visa (developer.paypal.com/tools/sandbox/card-testing), any future expiry, any CVV. */
export const TEST_CARD = { number: "4012888888881881", expiry: "2030-12", name: "Dana Check", security_code: "123" } as const;

export const CHECK_PAGE = {
  slug: "maya-card-check",
  name: SAMPLE.name,
  organizer: "E2E",
  note: "The nightly card check pays this copy of Maya's sample page with a PayPal sandbox test card, so her own page stays as visitors left it. Its needs reopen before each run, and every receipt stays.",
  /** The sample's needs, in order, at these amounts: distinct, so a unit paid the wrong amount is caught. */
  amounts: ["30.00", "25.00", "20.00", "15.00"],
  /**
   * Fills all four needs and sends the last $10 to her ABLE account as savings: five units, four payees. Given as cash
   * instead, $100 is past the $20 and $60 exclusions, so it would lower her check; routed, it does not.
   */
  gift: 100,
} as const;

export type PlannedUnit = { referenceId: string; amount: number; payeeEmail: string; payeeName: string };
export type PayPalOrder = {
  id?: string;
  status?: string;
  purchase_units?: { reference_id?: string; amount?: { value?: string }; payee?: { email_address?: string; merchant_id?: string }; payments?: { captures?: { id?: string; status?: string; amount?: { value?: string } }[] } }[];
};
export type UnitCheck = { reference_id: string; payee: string; amount: string; capture_id: string | null; ok: boolean; problem: string | null };

/**
 * Hold PayPal's copy of an order to the plan: the same units, each captured once, COMPLETED, for its routed amount,
 * to its routed payee. Payees are compared by sandbox account email, which never leaves the server.
 */
export function verifySplit(planned: PlannedUnit[], order: PayPalOrder): { ok: boolean; units: UnitCheck[]; problems: string[] } {
  const problems: string[] = [];
  if (order.status !== "COMPLETED") problems.push(`order is ${order.status ?? "missing"}, not COMPLETED`);
  const pus = order.purchase_units ?? [];
  if (pus.length !== planned.length) problems.push(`${pus.length} purchase units, ${planned.length} routed`);
  const extra = pus.filter((pu) => !planned.some((p) => p.referenceId === pu.reference_id)).map((pu) => pu.reference_id ?? "unnamed");
  if (extra.length) problems.push(`units not routed: ${extra.join(", ")}`);
  const units = planned.map((p): UnitCheck => {
    const pu = pus.find((u) => u.reference_id === p.referenceId);
    const caps = pu?.payments?.captures ?? [];
    const cap = caps[0];
    const want = p.amount.toFixed(2);
    const problem = !pu
      ? "missing at PayPal"
      : caps.length !== 1
        ? `${caps.length} captures`
        : cap.status !== "COMPLETED"
          ? `capture ${cap.status ?? "without status"}`
          : cap.amount?.value !== want
            ? `captured ${cap.amount?.value ?? "nothing"}, routed ${want}`
            : (pu.payee?.email_address ?? "").toLowerCase() !== p.payeeEmail.toLowerCase()
              ? "paid to a different account"
              : null;
    if (problem) problems.push(`${p.referenceId}: ${problem}`);
    return { reference_id: p.referenceId, payee: p.payeeName, amount: want, capture_id: cap?.id ?? null, ok: !problem, problem };
  });
  return { ok: problems.length === 0, units, problems };
}

/** Find or make the check's copy of the sample page, and reopen its needs. Its payments, and so its receipts, stay. */
export async function readyCheckPage() {
  const d = db();
  let [h] = await d.select().from(schema.households).where(eq(schema.households.slug, CHECK_PAGE.slug)).limit(1);
  if (!h) {
    [h] = await d
      .insert(schema.households)
      .values({ slug: CHECK_PAGE.slug, name: CHECK_PAGE.name, caregiverName: CHECK_PAGE.organizer, note: CHECK_PAGE.note, profile: SAMPLE.profile, isSample: false })
      .onConflictDoNothing()
      .returning();
    h ??= (await d.select().from(schema.households).where(eq(schema.households.slug, CHECK_PAGE.slug)).limit(1))[0];
  }
  const want = SAMPLE.needs.map((n, i) => ({ ...n, amount: CHECK_PAGE.amounts[i], householdId: h.id, sortOrder: i, status: "open", funded: "0" }));
  const have = await d.select().from(schema.needs).where(eq(schema.needs.householdId, h.id)).orderBy(asc(schema.needs.sortOrder));
  for (const n of want) {
    const row = have.find((r) => r.sortOrder === n.sortOrder);
    if (row) await d.update(schema.needs).set(n).where(eq(schema.needs.id, row.id));
    else await d.insert(schema.needs).values(n);
  }
  await d.update(schema.households).set({ name: CHECK_PAGE.name, note: CHECK_PAGE.note, profile: SAMPLE.profile, status: "open" }).where(eq(schema.households.id, h.id));
  return h;
}

export type CardCheck = {
  ok: boolean;
  order_id: string | null;
  amount: number;
  payees: number;
  units: UnitCheck[];
  mcp: { via: string; ok: boolean | null; detail: string };
  evidence: string[];
  ms: number;
};

/**
 * Read the captured order again through PayPal's own MCP server (its get_order tool, the one the assistant on /agents
 * uses) and hold that copy to the same plan. A copy that disagrees fails the check; a server that cannot be reached or
 * cannot run the call is noted (ok null), since the Orders API has already confirmed the split.
 */
export async function confirmViaPayPalMcp(orderId: string, planned: PlannedUnit[]): Promise<CardCheck["mcp"]> {
  let mcp: Awaited<ReturnType<typeof connectPayPalMcp>> | null = null;
  try {
    mcp = await connectPayPalMcp(15_000);
    const via = mcp.via === "local" ? `@paypal/mcp ${mcp.version}` : "PayPal's hosted MCP server";
    const r = await mcp.call("get_order", { id: orderId });
    let order: (PayPalOrder & { ok?: boolean; code?: string }) | null = null;
    try {
      order = JSON.parse(r.content.map((c) => c.text ?? "").join(""));
    } catch {
      order = null;
    }
    if (r.isError || !order || order.ok === false || !order.id) return { via, ok: null, detail: `get_order answered ${order?.code ?? "an error"}` };
    const v = verifySplit(planned, order);
    return { via, ok: v.ok, detail: v.ok ? "agrees on every unit" : v.problems.join("; ") };
  } catch (e) {
    return { via: "PayPal's MCP server", ok: null, detail: `not reached (${failureKind(e)})` };
  } finally {
    mcp?.close();
  }
}

/** The test card works only in PayPal's sandbox, and the check must never move real money: null when it may run. */
export function cardCheckBlocked(env = paypalEnv()): string | null {
  return env === "sandbox" ? null : "The card check pays with PayPal's sandbox test card, so it runs only while PAYPAL_ENV is sandbox.";
}

/** A failure the card check describes in its own plain words, safe to show on /evidence and /status. */
export class CardCheckError extends Error {}

export async function runCardCheck(): Promise<CardCheck> {
  const blocked = cardCheckBlocked();
  if (blocked) throw new CardCheckError(blocked);
  const t = Date.now();
  const page = await readyCheckPage();
  const started = await startRoutedGift(CHECK_PAGE.slug, CHECK_PAGE.gift, { actor: "system", tag: "card-check" });
  if (!started.ok) throw new CardCheckError(`The routed order was not created: ${started.message}`);
  const { orderId, plan } = started;
  const planned: PlannedUnit[] = plan.lines.map((l) => ({ referenceId: l.referenceId, amount: l.amount, payeeEmail: payeeEmail(l.payeeAccount), payeeName: l.payeeName }));
  const payees = new Set(planned.map((p) => p.payeeEmail.toLowerCase())).size;

  // The card stands in for the giver's approval, the way PayPal's card form attaches it to the order.
  const confirm = await paypalRest<{ status?: string; name?: string }>(`/v2/checkout/orders/${orderId}/confirm-payment-source`, {
    method: "POST",
    body: JSON.stringify({ payment_source: { card: TEST_CARD } }),
  });
  if (confirm.status >= 500) throw new CardCheckError(`PayPal answered ${confirm.status} to the test card`);
  const captured = confirm.status < 300 ? await captureAndRecord(orderId, { actor: "system" }) : null;

  const live = await paypalRest<PayPalOrder>(`/v2/checkout/orders/${orderId}`, { method: "GET" });
  const split = verifySplit(planned, live.body);
  const mcp = split.ok ? await confirmViaPayPalMcp(orderId, planned) :{ via: "PayPal's MCP server", ok: null, detail: "not asked, the Orders API already differs" };
  const rows = await db().select().from(schema.payments).where(eq(schema.payments.orderId, orderId));
  const recorded = rows.length === planned.length && rows.every((r) => r.status === "captured" && r.householdId === page.id && split.units.some((u) => u.reference_id === r.referenceId && u.capture_id === r.captureId));
  const needs = await db().select().from(schema.needs).where(eq(schema.needs.householdId, page.id));
  const filled = needs.length > 0 && needs.every((n) => n.status === "paid");
  const safe = plan.checkWithRouting === plan.baseline && plan.checkIfCash < plan.baseline;

  const ok = safe && plan.lines.length >= 2 && payees >= 2 && confirm.status < 300 && captured?.kind === "captured" && split.ok && mcp.ok !== false && recorded && filled;
  // Short lines: the workflow files at most 600 characters, and adds the public receipt's answer at the end.
  const evidence = [
    `${usd(plan.amount)} routed into PayPal order ${orderId}: ${plan.lines.length} units, ${payees} payees; her check stays ${usd(plan.checkWithRouting)} (as cash, ${usd(plan.checkIfCash)})`,
    `Sandbox Visa, no login: confirm-payment-source ${confirm.status} ${confirm.body.status ?? confirm.body.name ?? ""}, capture ${captured?.kind ?? "not tried"}`,
    split.ok ? `PayPal's record: ${split.units.map((u) => `${u.payee} $${u.amount}`).join(", ")}, each captured once to its own account` : `PayPal's record differs: ${split.problems.join("; ")}`,
    `${mcp.via} get_order: ${mcp.detail}`,
    recorded && filled ? "Recorded with capture ids on the check's own page, not Maya's" :`Recorded ${rows.filter((r) => r.status === "captured").length} of ${planned.length} units; check page paid: ${filled}`,
  ];
  return { ok, order_id: orderId, amount: plan.amount, payees, units: split.units, mcp, evidence, ms: Date.now() - t };
}
