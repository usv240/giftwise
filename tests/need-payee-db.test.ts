import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { have, suiteName } from "./helpers/needs";

/**
 * A payee per need, end to end on the database: the organizer's manage link stores the shop's PayPal email on the need,
 * and the one routed order for a gift names that email as the payee of the need's purchase unit. PayPal and the ledger
 * are mocked (no network, no ledger entries); the test page has its own slug and is removed afterwards.
 */
const sent = vi.hoisted(() => ({ units: [] as { payeeEmail: string; referenceId: string }[] }));
vi.mock("@/lib/paypal/orders", async (orig) => ({
  ...(await orig<typeof import("@/lib/paypal/orders")>()),
  createRoutedOrder: vi.fn(async (units: { payeeEmail: string; referenceId: string }[]) => {
    sent.units = units;
    return { id: `TEST${randomBytes(7).toString("hex").toUpperCase()}`, status: "CREATED", links: [] };
  }),
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => "test") }));

const database = await have("database");

describe.skipIf(!database.ok)(suiteName("a need's own PayPal payee, stored and paid", "database", database), () => {
  const slug = `payee-test-${randomBytes(4).toString("hex")}`;
  const token = `payee-${randomBytes(9).toString("hex")}`;
  let householdId = 0;
  let m: { db: typeof import("@/lib/db"); manage: typeof import("@/lib/manage"); gift: typeof import("@/lib/paypal/gift-order") };

  beforeAll(async () => {
    process.env.DATABASE_URL ??= database.url;
    delete process.env.PAYPAL_ENV;
    process.env.PAYPAL_ABLE_EMAIL ||= "able-test@business.example.com";
    process.env.PAYPAL_VENDOR_EMAIL ||= "vendor-test@business.example.com";
    m = { db: await import("@/lib/db"), manage: await import("@/lib/manage"), gift: await import("@/lib/paypal/gift-order") };
    const { db, schema } = m.db;
    const [h] = await db()
      .insert(schema.households)
      .values({ slug, name: "Lee", caregiverName: "Test", note: "", profile: { pronoun: "they", ableEligible: true }, isSample: false, manageTokenHash: m.manage.hashToken(token) })
      .returning();
    householdId = h.id;
  });

  afterAll(async () => {
    if (!householdId) return;
    const { db, schema } = m.db;
    await db().delete(schema.payments).where(eq(schema.payments.householdId, householdId));
    await db().delete(schema.needs).where(eq(schema.needs.householdId, householdId));
    await db().delete(schema.households).where(eq(schema.households.id, householdId));
  });

  it("stores the email on the need, refuses one that is not an email, and the order pays it", async () => {
    const bad = await m.manage.addNeed(token, { title: "Ramp", amount: 300, category: "equipment", vendor: "Hill Ramps", payeePaypal: "hill at example" });
    expect(bad).toMatchObject({ invalid: true });
    const row = await m.manage.addNeed(token, { title: "Ramp", amount: 300, category: "equipment", vendor: "Hill Ramps", payeePaypal: "Hill@Example.com" });
    if (!row || "error" in row) throw new Error("the need was not added");
    expect(row.payeeAccount).toBe("paypal:hill@example.com");

    const started = await m.gift.startRoutedGift(slug, 200, { actor: "system" });
    expect(started.ok).toBe(true);
    expect(sent.units).toEqual([expect.objectContaining({ referenceId: `need-${row.id}`, payeeEmail: "hill@example.com" })]);
    const { db, schema } = m.db;
    const [pay] = await db().select().from(schema.payments).where(eq(schema.payments.householdId, householdId));
    expect(pay.payeeEmail).toBe("hill@example.com");

    // Cleared on an edit, the need pays the shared sandbox shop account again.
    const edited = await m.manage.editNeed(token, row.id, { title: "Ramp", amount: 300, category: "equipment", vendor: "Hill Ramps", payeePaypal: null });
    if (!edited || "error" in edited) throw new Error("the need was not edited");
    expect(edited.payeeAccount).toBe("vendor");
  });
});
