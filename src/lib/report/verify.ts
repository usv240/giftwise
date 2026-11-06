/**
 * A report that proves itself. Each month's report carries a short code: a fingerprint of what the report says
 * (every gift's date, amount, route, recipient, rules and PayPal record, and the check). Anyone with the code can
 * open /v/{slug}/{month}/{code}, and Giftwise rebuilds the report from its records, asks PayPal for every capture
 * named in it, and checks the audit ledger's hash chain. No login: the page shows only what the report shows.
 */
import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { ledgerRows, verifyChain } from "../audit";
import { db, dbConfigured, schema } from "../db";
import { log } from "../log";
import { paypalConfigured, paypalRest } from "../paypal/client";
import { buildReport, type ReportLine, type SsaReport } from "./ssa";
import { giftSubject } from "./data";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base 32: no I, L, O or U

function base32(bytes: Uint8Array, n: number) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5 && out.length < n) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return out;
}

/** What the code fingerprints: the facts a caseworker would check, not the wording around them. */
function facts(slug: string, r: SsaReport) {
  return {
    slug,
    month: r.month,
    rules: r.rulesVersion,
    status: r.status,
    check: r.totals.check,
    lines: r.lines.map((l) => ({
      date: l.date,
      amount: l.amount,
      delivery: l.delivery,
      paidTo: l.paidTo,
      kind: l.kind,
      rules: l.ruleIds,
      evidence: l.evidence,
    })),
  };
}

/** A ten-character code, shown as XXXXX-XXXXX. */
export function reportCode(slug: string, r: SsaReport) {
  const raw = base32(createHash("sha256").update(JSON.stringify(facts(slug, r))).digest(), 10);
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

export const verifyPath = (slug: string, month: string, code: string) => `/v/${slug}/${month}/${code}`;

type PayPalOrder = {
  status?: string;
  purchase_units?: { reference_id?: string; payee?: { email_address?: string; merchant_id?: string }; payments?: { captures?: { id?: string; status?: string; amount?: { value?: string; currency_code?: string } }[] } }[];
};
type PayoutBatch = { items?: { transaction_id?: string; transaction_status?: string; payout_item?: { amount?: { value?: string }; receiver?: string } }[] };

export type LineCheck = {
  line: ReportLine;
  /** What PayPal says now, asked live. */
  paypal: { asked: boolean; status: string | null; amount: number | null; payeeMatches: boolean | null; ref: string | null };
  /** The ledger entry that recorded this capture, if any. */
  ledger: { id: number; hash: string } | null;
  ok: boolean;
};

export type Verification = {
  slug: string;
  name: string;
  month: string;
  monthLabel: string;
  code: string;
  codeMatches: boolean;
  currentCode: string;
  report: SsaReport;
  lines: LineCheck[];
  paypal: { asked: number; confirmed: number; reachable: boolean };
  ledger: { ok: boolean; count: number; brokenAt?: number };
  samples: number;
  checkedAt: string;
  verdict: "matches" | "changed" | "unconfirmed";
};

/** Enough of the address to tell accounts apart, not enough to write to it. */
const mask = (email: string) => email.replace(/^([^@]{1,6})[^@]*(@.*)$/, "$1…$2");

/** Rebuild the report, ask PayPal for every capture in it, and check the ledger. */
export async function verifyReport(slug: string, month: string, code: string, today: string): Promise<Verification | null> {
  const subject = await giftSubject(slug);
  if (!subject) return null;
  const report = buildReport({ name: subject.name, profile: subject.profile, gifts: subject.gifts, month, today, view: "given" });
  const currentCode = reportCode(slug, report);

  const orderIds = [...new Set(report.lines.flatMap((l) => (l.evidence.kind === "paypal_capture" ? [l.evidence.orderId] : [])))];
  const batchIds = [...new Set(report.lines.flatMap((l) => (l.evidence.kind === "paypal_payout" ? [l.evidence.batchId] : [])))];
  const live = paypalConfigured();
  const orders = new Map<string, PayPalOrder | null>();
  const batches = new Map<string, PayoutBatch | null>();
  await Promise.all([
    ...orderIds.map(async (id) => {
      const r = live ? await paypalRest<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(id)}`, { method: "GET" }).catch(() => null) : null;
      orders.set(id, r && r.status < 400 ? r.body : null);
    }),
    ...batchIds.map(async (id) => {
      const r = live ? await paypalRest<PayoutBatch>(`/v1/payments/payouts/${encodeURIComponent(id)}?page_size=100`, { method: "GET" }).catch(() => null) : null;
      batches.set(id, r && r.status < 400 ? r.body : null);
    }),
  ]);

  // Where each order's payee should be, as Giftwise recorded it when it created the order.
  const expected = new Map<string, string>();
  if (dbConfigured() && orderIds.length) {
    const rows = await db().select({ orderId: schema.payments.orderId, captureId: schema.payments.captureId, payeeEmail: schema.payments.payeeEmail }).from(schema.payments).where(and(inArray(schema.payments.orderId, orderIds), eq(schema.payments.status, "captured")));
    for (const r of rows) if (r.captureId) expected.set(r.captureId, r.payeeEmail.toLowerCase());
  }

  const rows = dbConfigured() ? await ledgerRows() : [];
  const chain = verifyChain(rows);
  const ledgerFor = (captureId: string) => {
    const e = rows.find((r) => r.action === "paypal.order.captured" && JSON.stringify(r.detail).includes(`"${captureId}"`));
    return e ? { id: e.id, hash: e.hash } : null;
  };

  const lines: LineCheck[] = report.lines.map((line) => {
    const ev = line.evidence;
    if (ev.kind === "paypal_capture") {
      const order = orders.get(ev.orderId);
      const unit = order?.purchase_units?.find((u) => u.payments?.captures?.some((c) => c.id === ev.captureId));
      const cap = unit?.payments?.captures?.find((c) => c.id === ev.captureId);
      const payee = unit?.payee?.email_address?.toLowerCase() ?? null;
      const want = ev.captureId ? expected.get(ev.captureId) : undefined;
      const amount = cap?.amount?.value ? Number(cap.amount.value) : null;
      const payeeMatches = payee && want ? payee === want : null;
      const ledger = ev.captureId ? ledgerFor(ev.captureId) : null;
      const ok = cap?.status === "COMPLETED" && amount === line.amount && payeeMatches !== false;
      return { line, paypal: { asked: live, status: cap?.status ?? null, amount, payeeMatches, ref: payee ? mask(payee) : null }, ledger, ok };
    }
    if (ev.kind === "paypal_payout") {
      const item = batches.get(ev.batchId)?.items?.find((i) => i.transaction_id === ev.transactionId);
      const amount = item?.payout_item?.amount?.value ? Number(item.payout_item.amount.value) : null;
      const ok = item?.transaction_status === "SUCCESS" && amount === line.amount;
      return { line, paypal: { asked: live, status: item?.transaction_status ?? null, amount, payeeMatches: null, ref: item?.payout_item?.receiver ? mask(item.payout_item.receiver) : null }, ledger: null, ok };
    }
    return { line, paypal: { asked: false, status: null, amount: null, payeeMatches: null, ref: null }, ledger: null, ok: true };
  });

  const paypalLines = lines.filter((l) => l.line.evidence.kind !== "sample");
  const confirmed = paypalLines.filter((l) => l.ok).length;
  const reachable = !live ? false : [...orders.values(), ...batches.values()].every((v) => v !== null);
  const codeMatches = code.toUpperCase() === currentCode;
  const verdict = !codeMatches ? "changed" : confirmed === paypalLines.length && chain.ok ? "matches" : "unconfirmed";
  log.info("report verified", { slug, month, verdict, codeMatches, paypalAsked: paypalLines.length, confirmed, ledgerOk: chain.ok, orders: orderIds.length, batches: batchIds.length });
  return {
    slug,
    name: subject.name,
    month,
    monthLabel: report.monthLabel,
    code: code.toUpperCase(),
    codeMatches,
    currentCode,
    report,
    lines,
    paypal: { asked: paypalLines.length, confirmed, reachable },
    ledger: chain,
    samples: lines.length - paypalLines.length,
    checkedAt: new Date().toISOString(),
    verdict,
  };
}
