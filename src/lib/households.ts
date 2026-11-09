import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "./db";
import { DEFAULT_PROFILE, evaluateGift, pronounWords, type Category, type Profile, type Pronoun } from "./rules";
import { SAMPLE_MANAGE_TOKEN, hashToken, newToken, resetSampleManage, routeNeed } from "./manage";
import { sampleNeedPositions, seedRecordedReceipt } from "./sample-receipt";

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

/** The cash gift every gift page compares with: this many dollars given in cash today. */
export const CASH_EXAMPLE_USD = 300;

/**
 * What the comparison cash gift does to the check: the figures under "Prefer to give cash?" on every gift page. The
 * recorded assistant on /agents is checked against the same figures (tests/agent-demo.test.ts), so the two never disagree.
 */
export function cashExample(profile: Profile, date: string) {
  return evaluateGift({ id: "cash", date, amount: CASH_EXAMPLE_USD, delivery: "cash", category: "other" }, profile);
}

/** Create the sample household if it does not exist yet. Safe to call on every request. */
export async function ensureSample() {
  const d = db();
  const [existing] = await d.select().from(schema.households).where(eq(schema.households.slug, SAMPLE.slug)).limit(1);
  if (existing && !existing.manageTokenHash) {
    // Deployments made before manage links: give the sample its public organizer link.
    const [h] = await d.update(schema.households).set({ manageTokenHash: hashToken(SAMPLE_MANAGE_TOKEN) }).where(eq(schema.households.id, existing.id)).returning();
    return h;
  }
  if (existing) {
    await seedRecordedReceipt(existing.id, await sampleNeedPositions(existing.id), payeeEmail);
    return existing;
  }
  const [h] = await d
    .insert(schema.households)
    .values({ slug: SAMPLE.slug, name: SAMPLE.name, caregiverName: SAMPLE.caregiverName, note: SAMPLE.note, profile: SAMPLE.profile, isSample: true, manageTokenHash: hashToken(SAMPLE_MANAGE_TOKEN) })
    .onConflictDoNothing()
    .returning();
  const household = h ?? (await d.select().from(schema.households).where(eq(schema.households.slug, SAMPLE.slug)).limit(1))[0];
  if (h) {
    await d.insert(schema.needs).values(SAMPLE.needs.map((n, i) => ({ ...n, householdId: household.id, sortOrder: i })));
  }
  // The recorded sandbox receipt (content/sample-receipt.json) travels with the sample, as an earlier round.
  await seedRecordedReceipt(household.id, await sampleNeedPositions(household.id), payeeEmail);
  return household;
}

/**
 * ABLE's yearly limit counts every giver's deposits together. The profile carries what went in from elsewhere; the
 * page's own ABLE gifts captured this calendar year are added to it, so each new gift is routed against the real total.
 */
export function withAbleSoFar(profile: Profile, payments: { route: string; amount: string | number; capturedAt: Date | null }[], now = new Date()): Profile {
  const year = now.getUTCFullYear();
  const onPage = payments.filter((p) => p.route === "able" && p.capturedAt && p.capturedAt.getUTCFullYear() === year).reduce((s, p) => s + Number(p.amount), 0);
  return onPage > 0 ? { ...profile, ableContributedThisYear: Math.round((profile.ableContributedThisYear + onPage) * 100) / 100 } : profile;
}

/** The sample is created once and never deleted (a reset reopens its needs), so each server process checks for it once. */
let sampleReady = false;

export async function getHousehold(slug: string) {
  const d = db();
  // The sample's row is read once: ensureSample already selects it, so the page's first read is one query, not two.
  let h: typeof schema.households.$inferSelect | undefined;
  if (slug === SAMPLE.slug && !sampleReady) {
    h = await ensureSample();
    sampleReady = Boolean(h);
  } else {
    [h] = await d.select().from(schema.households).where(eq(schema.households.slug, slug)).limit(1);
  }
  if (!h) return null;
  // The needs and the payments do not depend on each other, so they are read at the same time. Rows from an earlier
  // round of the sample page (before its last reset) stay on record for their receipts but are not part of the page.
  const [needs, pays] = await Promise.all([
    d.select().from(schema.needs).where(and(eq(schema.needs.householdId, h.id), isNull(schema.needs.archivedAt))).orderBy(asc(schema.needs.sortOrder)),
    d
      .select()
      .from(schema.payments)
      .where(and(eq(schema.payments.householdId, h.id), eq(schema.payments.status, "captured"), isNull(schema.payments.archivedAt)))
      .orderBy(desc(schema.payments.capturedAt)),
  ]);
  return { household: h, needs, payments: pays };
}

export async function getNeedWithHousehold(id: number) {
  const [n] = await db().select().from(schema.needs).where(and(eq(schema.needs.id, id), isNull(schema.needs.archivedAt))).limit(1);
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

/** A need on the page now; one a reset took off the page (kept only for its receipts) is not found. */
export async function getNeed(id: number) {
  const [n] = await db().select().from(schema.needs).where(and(eq(schema.needs.id, id), isNull(schema.needs.archivedAt))).limit(1);
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

/**
 * How the sample page's payees map to sandbox accounts, as counts only (no address leaves the server): the sample
 * shops, how many separate business accounts they resolve to, and whether her ABLE account is its own. Shown on /status.
 */
export function samplePayees() {
  const shops = [...new Set(SAMPLE.needs.map((n) => n.payeeAccount).filter((a) => a.startsWith("vendor:")))];
  const resolve = (a: string) => {
    try {
      return payeeEmail(a).toLowerCase();
    } catch {
      return null;
    }
  };
  const shopEmails = shops.map(resolve);
  const able = resolve("able");
  if (shopEmails.some((e) => !e) || !able) return null;
  const distinct = new Set(shopEmails).size;
  return { shops: shops.length, shopAccounts: distinct, ableOwn: !shopEmails.includes(able) };
}

/**
 * Reset the sample so every visitor sees the same starting state. Nothing a giver paid is deleted: the payments made so
 * far move to an earlier round (archived_at), so every receipt still opens and still matches PayPal's record, while the
 * needs, the report, the dashboard and the totals start again from zero.
 *
 * The reset runs in one transaction that holds the household row. A capture being recorded at the same moment
 * (src/lib/paypal/capture.ts) holds a share of the same row, so each payment counts in exactly one round: either it was
 * recorded first and the reset moves it to the earlier round, or the reset went first and the capture is recorded, with
 * its receipt, as part of the earlier round, leaving the reopened needs untouched.
 *
 * `slug` is the sample page; a test passes its own copy of the sample.
 */
export async function resetSample(slug: string = SAMPLE.slug) {
  const found = await db().transaction(async (tx) => {
    const [h] = await tx.select({ id: schema.households.id }).from(schema.households).where(eq(schema.households.slug, slug)).for("update");
    if (!h) return false;
    const current = await tx
      .select({ id: schema.needs.id, sortOrder: schema.needs.sortOrder })
      .from(schema.needs)
      .where(and(eq(schema.needs.householdId, h.id), isNull(schema.needs.archivedAt)));
    const ids = current.map((n) => n.id);
    // Every payment of this round, captured or still in flight, moves to the earlier round. A row from an older build
    // that names only its need is included too.
    await tx
      .update(schema.payments)
      .set({ archivedAt: sql`now()` })
      .where(and(isNull(schema.payments.archivedAt), ids.length ? or(eq(schema.payments.householdId, h.id), inArray(schema.payments.needId, ids)) : eq(schema.payments.householdId, h.id)));
    // Fund grants to the sample household go; PayPal and the audit ledger keep their own records.
    await tx.delete(schema.payouts).where(eq(schema.payouts.householdId, h.id));
    // Needs that any payment points to, in any round, are kept for their receipts rather than deleted.
    const withGifts = new Set(
      ids.length ? (await tx.select({ id: schema.payments.needId }).from(schema.payments).where(inArray(schema.payments.needId, ids))).map((r) => r.id) : [],
    );
    // Bring each sample need back in line with the code (title, wording, payee), reopened, so a database made by an
    // older build matches the current sample after one reset. Needs are matched by their place in the list.
    const kept = new Set<number>();
    for (const row of current) {
      const n = SAMPLE.needs[row.sortOrder];
      if (!n || kept.has(row.sortOrder)) {
        // A need an organizer added in the manage view leaves the page. One that received gifts stays on record, off
        // the page, so its receipts keep their title; the rest are deleted.
        if (withGifts.has(row.id)) await tx.update(schema.needs).set({ archivedAt: sql`now()` }).where(eq(schema.needs.id, row.id));
        else await tx.delete(schema.needs).where(eq(schema.needs.id, row.id));
        continue;
      }
      kept.add(row.sortOrder);
      await tx
        .update(schema.needs)
        .set({ title: n.title, detail: n.detail, category: n.category, route: n.route, payeeName: n.payeeName, payeeAccount: n.payeeAccount, amount: n.amount, recurring: n.recurring, status: "open", funded: "0" })
        .where(eq(schema.needs.id, row.id));
    }
    // A sample need removed in the manage view comes back too.
    const missing = SAMPLE.needs.map((n, i) => ({ n, i })).filter(({ i }) => !kept.has(i));
    if (missing.length) await tx.insert(schema.needs).values(missing.map(({ n, i }) => ({ householdId: h.id, ...n, sortOrder: i })));
    await tx.update(schema.households).set({ note: SAMPLE.note }).where(eq(schema.households.id, h.id));
    return true;
  });
  // The sample's public organizer link, its open status and an empty webhook come back once the reset is in.
  if (found && slug === SAMPLE.slug) await resetSampleManage();
}

export type NewNeed = { title: string; amount: number; category: Category; vendor?: string | null; recurring?: boolean };

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
  const manageToken = newToken();
  const [household] = await d
    .insert(schema.households)
    .values({ slug, name: o.name, caregiverName: o.organizer ?? "", note, profile: { ...DEFAULT_PROFILE, pronoun: o.pronoun }, isSample: false, manageTokenHash: hashToken(manageToken) })
    .returning();
  const rows = o.needs.map((n, i) => {
    const r = routeNeed(o.name, o.pronoun, { ...n, detail: o.sourceUrl ? "From the fundraiser." : "" });
    const check = evaluateGift({ id: `new-${i}`, date: new Date().toISOString().slice(0, 10), amount: n.amount, delivery: r.route as "vendor" | "able", category: n.category, recurring: n.recurring }, { ...DEFAULT_PROFILE, pronoun: o.pronoun });
    const row = {
      householdId: household.id,
      title: n.title.slice(0, 80),
      detail: r.route === "able" ? `Housing paid by someone else lowers the check, so this goes to ${w.poss} ABLE account.` : r.detail,
      category: n.category,
      route: r.route,
      payeeName: r.payeeName,
      payeeAccount: r.payeeAccount,
      amount: n.amount.toFixed(2),
      recurring: Boolean(n.recurring),
      sortOrder: i,
    };
    return { row, checkAfter: check.checkAfter };
  });
  await d.insert(schema.needs).values(rows.map((x) => x.row));
  return { slug, household, manageToken, needs: rows.map(({ row, checkAfter }) => ({ title: row.title, route: row.route, payee: row.payeeName, amount: Number(row.amount), check_after: checkAfter })) };
}
