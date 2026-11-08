import { randomBytes } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { have, suiteName } from "./helpers/needs";

/**
 * The shared sample page can be reset by anyone at any moment. A reset reopens the needs but never deletes a payment:
 * earlier receipts keep opening, and a capture that is still at PayPal when the reset lands is recorded and shown on
 * its receipt without counting toward the reopened needs.
 *
 * These run against a copy of the sample on its own slug, so they never touch /g/maya. PayPal is mocked (no network)
 * and so is the ledger, so the test leaves no entries in the hash chain.
 */

const pay = vi.hoisted(() => ({ gate: null as Promise<void> | null, started: 0, body: {} as unknown }));
vi.mock("@/lib/paypal/client", () => ({
  paypalRest: vi.fn(async (path: string, init: { method?: string } = {}) => {
    if (init.method === "POST" && path.endsWith("/capture")) {
      pay.started++;
      if (pay.gate) await pay.gate;
    }
    return { status: 201, body: pay.body, debugId: null };
  }),
  paypalConfigured: () => true,
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => "test") }));

// A database that answers (DATABASE_URL in .env.local; CI's Postgres has it too); otherwise these skip and say why.
const database = await have("database");

describe.skipIf(!database.ok)(suiteName("resetting the sample page keeps every payment", "database", database), () => {
  const slug = `reset-test-${randomBytes(4).toString("hex")}`;
  const orderId = () => `TEST${randomBytes(7).toString("hex").toUpperCase()}`;
  let householdId = 0;
  // Imported after DATABASE_URL is set, so the pool connects to the right database.
  let m: {
    db: typeof import("@/lib/db");
    households: typeof import("@/lib/households");
    receipt: typeof import("@/lib/receipt");
    capture: typeof import("@/lib/paypal/capture");
    report: typeof import("@/lib/report/data");
  };

  beforeAll(async () => {
    process.env.DATABASE_URL ??= database.url;
    m = {
      db: await import("@/lib/db"),
      households: await import("@/lib/households"),
      receipt: await import("@/lib/receipt"),
      capture: await import("@/lib/paypal/capture"),
      report: await import("@/lib/report/data"),
    };
    const { db, schema } = m.db;
    const { SAMPLE } = m.households;
    const [h] = await db()
      .insert(schema.households)
      .values({ slug, name: SAMPLE.name, caregiverName: "E2E", note: SAMPLE.note, profile: SAMPLE.profile, isSample: false })
      .returning();
    householdId = h.id;
    await db()
      .insert(schema.needs)
      .values(SAMPLE.needs.map((n, i) => ({ ...n, householdId, sortOrder: i })));
  });

  afterAll(async () => {
    if (!householdId) return;
    const { db, schema } = m.db;
    const needs = await db().select({ id: schema.needs.id }).from(schema.needs).where(eq(schema.needs.householdId, householdId));
    await db().delete(schema.payments).where(eq(schema.payments.householdId, householdId));
    if (needs.length) await db().delete(schema.payments).where(inArray(schema.payments.needId, needs.map((n) => n.id)));
    await db().delete(schema.needs).where(eq(schema.needs.householdId, householdId));
    await db().delete(schema.households).where(eq(schema.households.id, householdId));
  });

  const needAt = async (sortOrder: number) => {
    const { db, schema } = m.db;
    const rows = await db().select().from(schema.needs).where(and(eq(schema.needs.householdId, householdId), eq(schema.needs.sortOrder, sortOrder)));
    return rows.find((r) => !r.archivedAt)!;
  };

  it("a receipt from before the reset still opens, marked as an earlier round, and stops counting", async () => {
    const { db, schema } = m.db;
    const need = await needAt(0);
    const id = orderId();
    await db().insert(schema.payments).values({
      needId: need.id,
      householdId,
      orderId: id,
      referenceId: `need-${need.id}`,
      payeeName: need.payeeName,
      route: need.route,
      status: "captured",
      captureId: "CAPBEFORERESET",
      amount: need.amount,
      payeeEmail: "shop@example.com",
      payerName: "Ana Test",
      capturedAt: new Date(),
    });
    await db().update(schema.needs).set({ funded: need.amount, status: "paid" }).where(eq(schema.needs.id, need.id));
    // An organizer's own need that received a gift, too.
    const [own] = await db()
      .insert(schema.needs)
      .values({ householdId, title: "Bus pass", category: "transport", route: "vendor", payeeName: "City transit office", payeeAccount: "vendor", amount: "64.00", funded: "64.00", status: "paid", sortOrder: 9 })
      .returning();
    const ownOrder = orderId();
    await db().insert(schema.payments).values({ needId: own.id, householdId, orderId: ownOrder, referenceId: `need-${own.id}`, payeeName: own.payeeName, status: "captured", captureId: "CAPOWN", amount: "64.00", payeeEmail: "transit@example.com", capturedAt: new Date() });

    expect((await m.households.getHousehold(slug))?.payments).toHaveLength(2);
    await m.households.resetSample(slug);

    const r = await m.receipt.loadReceipt(id);
    expect(r).not.toBeNull();
    expect(r!.earlierRound).toBe(true);
    expect(r!.rows.map((x) => [x.status, x.captureId])).toEqual([["captured", "CAPBEFORERESET"]]);
    expect(r!.needs[0]?.title).toBe("Wheelchair repair");
    const rOwn = await m.receipt.loadReceipt(ownOrder);
    expect(rOwn?.needs[0]?.title).toBe("Bus pass");
    expect(rOwn?.earlierRound).toBe(true);

    // The page, its needs and its report start again from zero, with the sample's four needs.
    const page = await m.households.getHousehold(slug);
    expect(page?.payments).toHaveLength(0);
    expect(page?.needs.map((n) => [n.title, n.status, Number(n.funded)])).toEqual(m.households.SAMPLE.needs.map((n) => [n.title, "open", 0]));
    expect((await m.report.giftSubject(slug))?.gifts).toHaveLength(0);
    // The organizer's need is off the page but still on record for its receipt.
    const [kept] = await db().select().from(schema.needs).where(eq(schema.needs.id, own.id));
    expect(kept?.archivedAt).not.toBeNull();
    expect(await m.households.getNeed(own.id)).toBeNull();
  });

  it("a capture still at PayPal when the reset lands is recorded and shown on its receipt, without counting toward the reopened need", async () => {
    const { db, schema } = m.db;
    const need = await needAt(1);
    const id = orderId();
    const ref = `need-${need.id}`;
    await db().insert(schema.payments).values({ needId: need.id, householdId, orderId: id, referenceId: ref, payeeName: need.payeeName, route: need.route, status: "created", amount: need.amount, payeeEmail: "shop@example.com" });
    pay.body = { status: "COMPLETED", payer: { name: { given_name: "Ana", surname: "Test" } }, purchase_units: [{ reference_id: ref, payments: { captures: [{ id: "CAPRACE", amount: { value: need.amount } }] } }] };
    let release!: () => void;
    pay.gate = new Promise<void>((r) => (release = r));
    pay.started = 0;

    // The giver's capture reaches PayPal; while PayPal is still answering, someone resets the page.
    const capturing = m.capture.captureAndRecord(id);
    for (let i = 0; i < 100 && pay.started === 0; i++) await new Promise((r) => setTimeout(r, 20));
    expect(pay.started).toBe(1);
    await m.households.resetSample(slug);
    release();
    const out = await capturing;
    pay.gate = null;

    expect(out.kind).toBe("captured");
    if (out.kind === "captured") expect(out.captures.map((c) => c.capture_id)).toEqual(["CAPRACE"]);
    const r = await m.receipt.loadReceipt(id);
    expect(r?.rows.map((x) => [x.status, x.captureId])).toEqual([["captured", "CAPRACE"]]);
    expect(r?.earlierRound).toBe(true);
    // The reopened need is untouched, and the page's totals leave the earlier round out.
    const after = await needAt(1);
    expect([after.status, Number(after.funded)]).toEqual(["open", 0]);
    expect((await m.households.getHousehold(slug))?.payments).toHaveLength(0);
  });

  it("a gift captured after the reset counts toward the reopened need as before", async () => {
    const { db, schema } = m.db;
    const need = await needAt(3);
    const id = orderId();
    const ref = `need-${need.id}`;
    await db().insert(schema.payments).values({ needId: need.id, householdId, orderId: id, referenceId: ref, payeeName: need.payeeName, route: need.route, status: "created", amount: need.amount, payeeEmail: "shop@example.com" });
    pay.body = { status: "COMPLETED", purchase_units: [{ reference_id: ref, payments: { captures: [{ id: "CAPAFTER", amount: { value: need.amount } }] } }] };
    const out = await m.capture.captureAndRecord(id);
    expect(out.kind).toBe("captured");
    const after = await needAt(3);
    expect([after.status, Number(after.funded)]).toEqual(["paid", Number(need.amount)]);
    expect((await m.receipt.loadReceipt(id))?.earlierRound).toBe(false);
    expect((await m.households.getHousehold(slug))?.payments.map((p) => p.orderId)).toEqual([id]);
  });
});
