import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "./db";
import { DEFAULT_PROFILE, SHELTER_CATEGORIES, evaluateGift, pronounWords, type Category, type Pronoun } from "./rules";

export type NeedRow = typeof schema.needs.$inferSelect;
export type PaymentRow = typeof schema.payments.$inferSelect;

/** The sample household used across the demo. Vendors are fictional; payees are PayPal sandbox accounts. */
export const SAMPLE = {
  slug: "maya",
  name: "Maya",
  caregiverName: "Rosa",
  note: "Maya is 29 and lives on her own. She uses a wheelchair and is starting community college. Thank you for helping with these. Every gift on this page goes straight to the shop, so her SSI check stays the same. With love, Rosa (her mom)",
  profile: { pronoun: "she", couple: false, livesInAnothersHousehold: false, otherUnearnedMonthly: 0, earnedMonthly: 0, ableEligible: true, savings: 1240 },
  needs: [
    { title: "Wheelchair repair", detail: "New push rims and a brake adjustment.", category: "equipment", route: "vendor", payeeName: "Riverside Mobility Repair", payeeAccount: "vendor:riverside", amount: "420.00", recurring: false },
    { title: "Laptop for college", detail: "For her online classes this spring.", category: "education", route: "vendor", payeeName: "Eastgate College Bookstore", payeeAccount: "vendor:eastgate", amount: "649.00", recurring: false },
    { title: "Electric bill, this month", detail: "Utilities count as housing support, so this goes to her ABLE account and she pays the bill herself.", category: "utility", route: "able", payeeName: "Maya's ABLE account", payeeAccount: "able", amount: "138.00", recurring: true },
    { title: "Therapy co-pay", detail: "Weekly physical therapy.", category: "medical", route: "vendor", payeeName: "Northside Physical Therapy", payeeAccount: "vendor:northside", amount: "90.00", recurring: false },
  ],
} as const;

/** Create the sample household if it does not exist yet. Safe to call on every request. */
export async function ensureSample() {
  const d = db();
  const [existing] = await d.select().from(schema.households).where(eq(schema.households.slug, SAMPLE.slug)).limit(1);
  if (existing) return existing;
  const [h] = await d
    .insert(schema.households)
    .values({ slug: SAMPLE.slug, name: SAMPLE.name, caregiverName: SAMPLE.caregiverName, note: SAMPLE.note, profile: SAMPLE.profile, isSample: true })
    .onConflictDoNothing()
    .returning();
  const household = h ?? (await d.select().from(schema.households).where(eq(schema.households.slug, SAMPLE.slug)).limit(1))[0];
  if (h) {
    await d.insert(schema.needs).values(SAMPLE.needs.map((n, i) => ({ ...n, householdId: household.id, sortOrder: i })));
  }
  return household;
}

export async function getHousehold(slug: string) {
  if (slug === SAMPLE.slug) await ensureSample();
  const d = db();
  const [h] = await d.select().from(schema.households).where(eq(schema.households.slug, slug)).limit(1);
  if (!h) return null;
  const needs = await d.select().from(schema.needs).where(eq(schema.needs.householdId, h.id)).orderBy(asc(schema.needs.sortOrder));
  const pays = await d
    .select()
    .from(schema.payments)
    .where(and(eq(schema.payments.householdId, h.id), eq(schema.payments.status, "captured")))
    .orderBy(desc(schema.payments.capturedAt));
  return { household: h, needs, payments: pays };
}

export async function getNeedWithHousehold(id: number) {
  const [n] = await db().select().from(schema.needs).where(eq(schema.needs.id, id)).limit(1);
  return n ?? null;
}

/** Open needs in priority order, in the shape the router uses. */
export function openNeeds(needs: NeedRow[]) {
  return needs
    .filter((n) => n.status !== "paid")
    .map((n) => ({
      id: n.id,
      title: n.title,
      category: n.category,
      route: n.route,
      payeeName: n.payeeName,
      payeeAccount: n.payeeAccount,
      amount: Number(n.amount),
      funded: Number(n.funded),
      recurring: n.recurring,
    }));
}

export async function getNeed(id: number) {
  const [n] = await db().select().from(schema.needs).where(eq(schema.needs.id, id)).limit(1);
  return n ?? null;
}

/**
 * Resolve the sandbox account for a payee. The browser never chooses where money goes. A sample shop ("vendor:riverside")
 * has its own sandbox business account when PAYPAL_VENDOR_EMAIL_RIVERSIDE is set, so each shop is paid separately;
 * otherwise every shop shares the one test business account in PAYPAL_VENDOR_EMAIL.
 */
export function payeeEmail(account: string) {
  const shop = account.startsWith("vendor:") ? process.env[`PAYPAL_VENDOR_EMAIL_${account.slice(7).toUpperCase()}`]?.trim() : undefined;
  const email = account === "able" ? process.env.PAYPAL_ABLE_EMAIL : shop || process.env.PAYPAL_VENDOR_EMAIL;
  if (!email) throw new Error(`No sandbox payee configured for ${account}`);
  return email.trim();
}

/** Reset the sample so every judge sees the same starting state. */
export async function resetSample() {
  const d = db();
  const [h] = await d.select().from(schema.households).where(eq(schema.households.slug, SAMPLE.slug)).limit(1);
  if (!h) return;
  const needs = await d.select({ id: schema.needs.id }).from(schema.needs).where(eq(schema.needs.householdId, h.id));
  await d.delete(schema.payments).where(eq(schema.payments.householdId, h.id));
  // Fund grants to the sample household go too; PayPal and the audit ledger keep their own records.
  await d.delete(schema.payouts).where(eq(schema.payouts.householdId, h.id));
  if (needs.length) {
    await d.delete(schema.payments).where(inArray(schema.payments.needId, needs.map((n) => n.id)));
    await d.update(schema.needs).set({ status: "open", funded: "0" }).where(eq(schema.needs.householdId, h.id));
  }
  // Bring each sample need back in line with the code (title, wording, payee), so a database made by an older build
  // matches the current sample after one reset. Needs are matched by their place in the list.
  const rows = await d.select({ id: schema.needs.id, sortOrder: schema.needs.sortOrder }).from(schema.needs).where(eq(schema.needs.householdId, h.id));
  for (const row of rows) {
    const n = SAMPLE.needs[row.sortOrder];
    if (n) await d.update(schema.needs).set({ title: n.title, detail: n.detail, payeeName: n.payeeName, payeeAccount: n.payeeAccount }).where(eq(schema.needs.id, row.id));
  }
}

export type NewNeed = { title: string; amount: number; category: Category; vendor?: string | null; recurring?: boolean };

/** "a van conversion shop" -> "Van conversion shop". */
function payeeLabel(vendor: string | null | undefined) {
  const v = (vendor ?? "").trim().replace(/^(a|an|the)\s+/i, "");
  return v ? v[0].toUpperCase() + v.slice(1, 80) : "The shop";
}

/**
 * Create a gift page from a fundraiser's stated uses. The rules engine, not the caller, decides each route:
 * housing goes to the person's ABLE account; everything else is paid straight to the shop.
 */
export async function createGiftPage(o: { name: string; pronoun: Pronoun; organizer?: string; note?: string; sourceUrl?: string; needs: NewNeed[] }) {
  const d = db();
  const w = pronounWords(o.pronoun);
  const slug = `${o.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "page"}-${randomBytes(3).toString("hex")}`;
  const note =
    o.note?.trim() ||
    `${o.name} receives SSI. Every gift on this page is paid straight to the shop or to ${w.poss} ABLE account, so ${w.poss} SSI check stays the same.${o.organizer ? ` With thanks, ${o.organizer}.` : ""}`;
  const [household] = await d
    .insert(schema.households)
    .values({ slug, name: o.name, caregiverName: o.organizer ?? "", note, profile: { ...DEFAULT_PROFILE, pronoun: o.pronoun }, isSample: false })
    .returning();
  const rows = o.needs.map((n, i) => {
    const housing = SHELTER_CATEGORIES.includes(n.category);
    const r = evaluateGift({ id: `new-${i}`, date: new Date().toISOString().slice(0, 10), amount: n.amount, delivery: housing ? "able" : "vendor", category: n.category, recurring: n.recurring }, { ...DEFAULT_PROFILE, pronoun: o.pronoun });
    const row = {
      householdId: household.id,
      title: n.title.slice(0, 80),
      detail: housing ? `Housing paid by someone else lowers the check, so this goes to ${w.poss} ABLE account.` : (o.sourceUrl ? "From the fundraiser." : ""),
      category: n.category,
      route: housing ? "able" : "vendor",
      payeeName: housing ? `${o.name}'s ABLE account` : payeeLabel(n.vendor),
      payeeAccount: housing ? "able" : "vendor",
      amount: n.amount.toFixed(2),
      recurring: Boolean(n.recurring),
      sortOrder: i,
    };
    return { row, checkAfter: r.checkAfter };
  });
  await d.insert(schema.needs).values(rows.map((x) => x.row));
  return { slug, household, needs: rows.map(({ row, checkAfter }) => ({ title: row.title, route: row.route, payee: row.payeeName, amount: Number(row.amount), check_after: checkAfter })) };
}
