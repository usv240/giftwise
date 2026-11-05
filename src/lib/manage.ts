/**
 * The organizer's side of a gift page, through a private manage link (no account): add, edit and remove needs,
 * close or reopen the page, and send gift events to a webhook (a Zapier Catch Hook, a Slack workflow, any HTTPS
 * endpoint). Only a SHA-256 of the token is stored. The rules engine, not the organizer, decides each need's route.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { and, asc, eq, sql } from "drizzle-orm";
import { audit } from "./audit";
import { db, schema } from "./db";
import { DEFAULT_PROFILE, SHELTER_CATEGORIES, computeMonth, evaluateGift, monthName, monthOf, pronounWords, type Category, type Delivery, type Profile, type Pronoun } from "./rules";

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(18).toString("base64url");

/** The sample page has a fixed, public manage link so judges can try the organizer's side; a reset restores it. */
export const SAMPLE_MANAGE_TOKEN = "maya-sample-organizer";

export type NeedInput = { title: string; detail?: string; amount: number; category: Category; vendor?: string | null; recurring?: boolean };

/** "a van conversion shop" -> "Van conversion shop". */
export function payeeLabel(vendor: string | null | undefined) {
  const v = (vendor ?? "").trim().replace(/^(a|an|the)\s+/i, "");
  return v ? v[0].toUpperCase() + v.slice(1, 80) : "The shop";
}

/** The route the rules choose for a need: housing to the ABLE account, everything else straight to the shop. */
export function routeNeed(name: string, pronoun: Pronoun, n: NeedInput) {
  const w = pronounWords(pronoun);
  const housing = SHELTER_CATEGORIES.includes(n.category);
  return {
    route: housing ? "able" : "vendor",
    payeeName: housing ? `${name}'s ABLE account` : payeeLabel(n.vendor),
    payeeAccount: housing ? "able" : "vendor",
    detail: n.detail?.trim() || (housing ? `Housing paid by someone else lowers the check, so this goes to ${w.poss} ABLE account.` : ""),
  };
}

export async function householdByToken(token: string) {
  if (!token || token.length > 64) return null;
  const [h] = await db().select().from(schema.households).where(eq(schema.households.manageTokenHash, hashToken(token))).limit(1);
  return h ?? null;
}

export async function manageView(token: string) {
  const h = await householdByToken(token);
  if (!h) return null;
  const d = db();
  const needs = await d.select().from(schema.needs).where(eq(schema.needs.householdId, h.id)).orderBy(asc(schema.needs.sortOrder), asc(schema.needs.id));
  const payments = await d
    .select()
    .from(schema.payments)
    .where(and(eq(schema.payments.householdId, h.id), eq(schema.payments.status, "captured")))
    .orderBy(sql`${schema.payments.capturedAt} desc nulls last`);
  const profile: Profile = { ...DEFAULT_PROFILE, ...(h.profile as Partial<Profile>) };
  const today = new Date().toISOString().slice(0, 10);
  return {
    household: h,
    profile,
    needs: needs.map((n) => {
      const r = evaluateGift({ id: `n${n.id}`, date: today, amount: Number(n.amount), delivery: n.route as "vendor" | "able", category: n.category as Category, recurring: n.recurring }, profile);
      return { ...n, rule: r.explanation.plain, checkAfter: r.checkAfter, hasPayments: payments.some((p) => p.needId === n.id) || Number(n.funded) > 0 };
    }),
    payments,
  };
}

function sanitize(n: NeedInput) {
  return { ...n, title: n.title.trim().slice(0, 80), detail: n.detail?.trim().slice(0, 200), amount: Math.round(n.amount * 100) / 100 };
}

export async function addNeed(token: string, input: NeedInput) {
  const h = await householdByToken(token);
  if (!h) return null;
  const n = sanitize(input);
  const pronoun = ((h.profile as Partial<Profile>).pronoun ?? "she") as Pronoun;
  const r = routeNeed(h.name, pronoun, n);
  const [{ max }] = await db().select({ max: sql<number>`coalesce(max(${schema.needs.sortOrder}), -1)` }).from(schema.needs).where(eq(schema.needs.householdId, h.id));
  const [row] = await db()
    .insert(schema.needs)
    .values({ householdId: h.id, title: n.title, detail: r.detail, category: n.category, route: r.route, payeeName: r.payeeName, payeeAccount: r.payeeAccount, amount: n.amount.toFixed(2), recurring: Boolean(n.recurring), sortOrder: Number(max) + 1 })
    .returning();
  await audit("person", "gift_page.need_added", `household:${h.id}`, { need: row.id, category: row.category, route: row.route });
  return row;
}

/** Edit a need. The amount can never drop below what givers have already paid toward it. */
export async function editNeed(token: string, id: number, input: NeedInput) {
  const h = await householdByToken(token);
  if (!h) return null;
  const [cur] = await db().select().from(schema.needs).where(and(eq(schema.needs.id, id), eq(schema.needs.householdId, h.id))).limit(1);
  if (!cur) return null;
  const n = sanitize(input);
  if (n.amount < Number(cur.funded)) return { error: `Givers have already paid $${Number(cur.funded).toFixed(2)} toward this need, so the amount can be no lower.` } as const;
  const pronoun = ((h.profile as Partial<Profile>).pronoun ?? "she") as Pronoun;
  const r = routeNeed(h.name, pronoun, n);
  const funded = Number(cur.funded);
  const status = funded <= 0 ? "open" : funded >= n.amount ? "paid" : "partial";
  const [row] = await db()
    .update(schema.needs)
    .set({ title: n.title, detail: r.detail, category: n.category, route: r.route, payeeName: r.payeeName, payeeAccount: cur.route === r.route && r.route === "vendor" ? cur.payeeAccount : r.payeeAccount, amount: n.amount.toFixed(2), recurring: Boolean(n.recurring), status })
    .where(eq(schema.needs.id, id))
    .returning();
  await audit("person", "gift_page.need_edited", `household:${h.id}`, { need: id, category: row.category, route: row.route });
  return row;
}

/** Remove a need nobody has paid toward yet. A need with gifts stays, so its receipts keep pointing somewhere. */
export async function removeNeed(token: string, id: number) {
  const h = await householdByToken(token);
  if (!h) return null;
  const [cur] = await db().select().from(schema.needs).where(and(eq(schema.needs.id, id), eq(schema.needs.householdId, h.id))).limit(1);
  if (!cur) return null;
  const [paid] = await db().select({ n: sql<number>`count(*)` }).from(schema.payments).where(eq(schema.payments.needId, id));
  if (Number(cur.funded) > 0 || Number(paid?.n ?? 0) > 0) return { error: "Givers have paid toward this need, so it stays on the page with its receipts. To stop new gifts, close the page." } as const;
  await db().delete(schema.needs).where(eq(schema.needs.id, id));
  await audit("person", "gift_page.need_removed", `household:${h.id}`, { need: id });
  return { ok: true } as const;
}

export async function updatePage(token: string, o: { note?: string; status?: "open" | "closed" }) {
  const h = await householdByToken(token);
  if (!h) return null;
  const set: Partial<typeof schema.households.$inferInsert> = {};
  if (o.note !== undefined) set.note = o.note.trim().slice(0, 400);
  if (o.status) set.status = o.status;
  const [row] = await db().update(schema.households).set(set).where(eq(schema.households.id, h.id)).returning();
  await audit("person", o.status ? `gift_page.${o.status === "closed" ? "closed" : "reopened"}` : "gift_page.edited", `household:${h.id}`, {});
  return row;
}

// ---------- Notifications: gift events to a webhook, signed ----------

const PRIVATE_V4 = [/^0\./, /^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^22[4-9]\./, /^2[3-5]\d\./];
const isPrivateAddress = (ip: string) =>
  isIP(ip) === 4 ? PRIVATE_V4.some((r) => r.test(ip)) : /^(::1?|fc|fd|fe8|fe9|fea|feb|::ffff:(10|127|169\.254|192\.168)\.)/i.test(ip);

/**
 * A webhook must be HTTPS on a public host: no IP literals, no localhost or internal names, and the name must not
 * resolve to a private address. This keeps the server from being pointed at its own network.
 */
export async function checkWebhookUrl(raw: string): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "That is not a web address." };
  }
  if (u.protocol !== "https:" && !(process.env.GIFTWISE_WEBHOOK_ALLOW_LOCAL === "1" && !process.env.RENDER && u.protocol === "http:" && ["127.0.0.1", "localhost"].includes(u.hostname))) {
    return { ok: false, reason: "The address must start with https://." };
  }
  if (u.username || u.password) return { ok: false, reason: "The address cannot include a login." };
  const host = u.hostname.toLowerCase();
  // Local end-to-end tests receive webhooks on this machine; never on Render.
  if (process.env.GIFTWISE_WEBHOOK_ALLOW_LOCAL === "1" && !process.env.RENDER && (host === "127.0.0.1" || host === "localhost")) return { ok: true, url: u.toString() };
  if (isIP(host.replace(/^\[|\]$/g, "")) || host === "localhost" || /\.(local|localhost|internal|lan|home|corp)$/.test(host) || !host.includes(".")) {
    return { ok: false, reason: "Use a public address, such as the one Zapier gives you for a Catch Hook." };
  }
  try {
    const addrs = await lookup(host, { all: true });
    if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) return { ok: false, reason: "That address points to a private network." };
  } catch {
    return { ok: false, reason: "That address could not be found." };
  }
  return { ok: true, url: u.toString() };
}

export async function setWebhook(token: string, url: string | null) {
  const h = await householdByToken(token);
  if (!h) return null;
  if (url === null) {
    await db().update(schema.households).set({ webhookUrl: null }).where(eq(schema.households.id, h.id));
    await audit("person", "gift_page.webhook_removed", `household:${h.id}`, {});
    return { ok: true as const, url: null, secret: h.webhookSecret };
  }
  const c = await checkWebhookUrl(url);
  if (!c.ok) return { ok: false as const, reason: c.reason };
  const secret = h.webhookSecret ?? `whsec_${randomBytes(24).toString("base64url")}`;
  await db().update(schema.households).set({ webhookUrl: c.url, webhookSecret: secret }).where(eq(schema.households.id, h.id));
  await audit("person", "gift_page.webhook_set", `household:${h.id}`, { host: new URL(c.url).host });
  return { ok: true as const, url: c.url, secret };
}

export type GiftEvent = {
  event: "gift.received" | "gift.test";
  page: { name: string; url: string };
  gift: { amount: number; giver: string | null; recipients: { paid_to: string; for: string; amount: number }[]; receipt_url: string | null };
  check: { month: string; amount: number; counted_as_income: number };
  sandbox: true;
  sent_at: string;
};

/** Signature header: t=<unix seconds>,v1=<hex HMAC-SHA256 of "t.body"> with the page's secret. */
export function signBody(secret: string, body: string, t = Math.floor(Date.now() / 1000)) {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
}

/** For a receiver: check a Giftwise-Signature header against the raw body, within five minutes of when it was sent. */
export function verifySignature(secret: string, body: string, header: string, now = Math.floor(Date.now() / 1000)) {
  const m = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header.trim());
  if (!m) return false;
  const t = Number(m[1]);
  if (Math.abs(now - t) > 300) return false;
  const want = createHmac("sha256", secret).update(`${t}.${body}`).digest();
  const got = Buffer.from(m[2], "hex");
  return got.length === want.length && timingSafeEqual(got, want);
}

/** POST one event to the page's webhook. Never throws: delivery is best effort and goes to the ledger either way. */
export async function deliver(householdId: number, ev: GiftEvent, fetcher: typeof fetch = fetch) {
  const [h] = await db().select().from(schema.households).where(eq(schema.households.id, householdId)).limit(1);
  if (!h?.webhookUrl || !h.webhookSecret) return { sent: false as const, reason: "no_webhook" };
  const c = await checkWebhookUrl(h.webhookUrl);
  if (!c.ok) return { sent: false as const, reason: c.reason };
  const body = JSON.stringify(ev);
  let status = 0;
  try {
    const r = await fetcher(c.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Giftwise-Webhooks/1", "Giftwise-Event": ev.event, "Giftwise-Signature": signBody(h.webhookSecret, body) },
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    });
    status = r.status;
  } catch {
    status = 0;
  }
  await audit("system", "gift_page.webhook_delivered", `household:${h.id}`, { event: ev.event, host: new URL(c.url).host, status });
  return { sent: status >= 200 && status < 300, status };
}

/** Restore the sample's manage link and clear its webhook, so every judge starts from the same organizer view. */
export async function resetSampleManage() {
  await db().update(schema.households).set({ manageTokenHash: hashToken(SAMPLE_MANAGE_TOKEN), status: "open", webhookUrl: null, webhookSecret: null }).where(eq(schema.households.slug, "maya"));
}

/** After PayPal captures an order: tell the page's webhook what arrived, where it went, and the check it keeps. */
export async function notifyGift(orderId: string, origin: string) {
  const d = db();
  const rows = await d.select().from(schema.payments).where(and(eq(schema.payments.orderId, orderId), eq(schema.payments.status, "captured")));
  const hid = rows[0]?.householdId;
  if (!hid) return { sent: false as const, reason: "no_household" };
  const [h] = await d.select().from(schema.households).where(eq(schema.households.id, hid)).limit(1);
  if (!h?.webhookUrl) return { sent: false as const, reason: "no_webhook" };
  const needs = await d.select().from(schema.needs).where(eq(schema.needs.householdId, hid));
  const profile: Profile = { ...DEFAULT_PROFILE, ...(h.profile as Partial<Profile>) };
  const date = (rows[0].capturedAt ?? rows[0].createdAt).toISOString().slice(0, 10);
  const month = computeMonth(
    monthOf(date),
    rows.map((r) => ({ id: r.referenceId, date, amount: Number(r.amount), delivery: r.route as Delivery, category: (needs.find((n) => n.id === r.needId)?.category ?? "other") as Category })),
    profile,
  );
  const base = computeMonth(monthOf(date), [], profile);
  return deliver(hid, {
    event: "gift.received",
    page: { name: h.name, url: `${origin}/g/${h.slug}` },
    gift: {
      amount: Math.round(rows.reduce((a, r) => a + Number(r.amount), 0) * 100) / 100,
      giver: rows.find((r) => r.payerName)?.payerName?.split(" ")[0] ?? null,
      recipients: rows.map((r) => ({ paid_to: r.payeeName, for: needs.find((n) => n.id === r.needId)?.title ?? "savings for later", amount: Number(r.amount) })),
      receipt_url: `${origin}/r/${orderId}`,
    },
    check: { month: `${monthName(month.paymentMonth)} ${month.paymentMonth.slice(0, 4)}`, amount: month.check, counted_as_income: Math.round((month.countableIncome - base.countableIncome) * 100) / 100 },
    sandbox: true,
    sent_at: new Date().toISOString(),
  });
}

/** A sample event, so an organizer can see what their Zap will receive before any gift arrives. */
export async function sendTest(token: string, origin: string) {
  const h = await householdByToken(token);
  if (!h) return null;
  if (!h.webhookUrl) return { sent: false as const, reason: "Add a webhook address first." };
  const profile: Profile = { ...DEFAULT_PROFILE, ...(h.profile as Partial<Profile>) };
  const m = computeMonth(monthOf(new Date().toISOString().slice(0, 10)), [], profile);
  return deliver(h.id, {
    event: "gift.test",
    page: { name: h.name, url: `${origin}/g/${h.slug}` },
    gift: { amount: 50, giver: "Test", recipients: [{ paid_to: "A test shop", for: "A test need", amount: 50 }], receipt_url: null },
    check: { month: `${monthName(m.paymentMonth)} ${m.paymentMonth.slice(0, 4)}`, amount: m.check, counted_as_income: 0 },
    sandbox: true,
    sent_at: new Date().toISOString(),
  });
}
