import { asc, eq, inArray, or, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import sources from "../../../../content/sources.json";
import { Info } from "@/components/Info";
import { ReceiptChecks } from "@/components/gift/ReceiptChecks";
import { db, dbConfigured, schema } from "@/lib/db";
import { DEFAULT_PROFILE, RULES, RULES_VERSION, computeMonth, evaluateGift, monthOf, sourcesFor, usd, type Category, type Delivery } from "@/lib/rules";
import "../../pages.css";
import "./receipt.css";

export const metadata: Metadata = { title: "Receipt", description: "Where a Giftwise gift went, the rule that kept her check whole, and a live check against PayPal." };

const SRC = sources as Record<string, { title: string; url: string; publisher?: string }>;
const ACTION: Record<string, string> = {
  "paypal.order.created": "PayPal order created",
  "paypal.routed_order.created": "PayPal order created, split by the rules",
  "paypal.order.captured": "Payment completed by PayPal",
};
const ROUTE: Record<string, string> = { vendor: "Paid straight to the shop", able: "Paid to her ABLE account" };
const when = (d: Date) => d.toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "medium", timeStyle: "short" });

async function Receipt({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  if (!/^[A-Z0-9]{10,24}$/.test(orderId)) notFound();
  if (!dbConfigured()) return <p className="page-loading">The receipt needs its database. See the README to start it.</p>;
  const d = db();
  const rows = await d.select().from(schema.payments).where(eq(schema.payments.orderId, orderId)).orderBy(asc(schema.payments.id));
  if (rows.length === 0) notFound();
  const [household] = rows[0].householdId ? await d.select().from(schema.households).where(eq(schema.households.id, rows[0].householdId)).limit(1) : [];
  const needIds = rows.flatMap((r) => (r.needId ? [r.needId] : []));
  const needs = needIds.length ? await d.select().from(schema.needs).where(inArray(schema.needs.id, needIds)) : [];
  const events = await d
    .select()
    .from(schema.auditEvents)
    .where(or(eq(schema.auditEvents.ref, `order:${orderId}`), sql`${schema.auditEvents.detail}->>'orderId' = ${orderId}`))
    .orderBy(asc(schema.auditEvents.id));

  const name = household?.name ?? "her";
  const hers = household?.name ? `${household.name}’s` : "her";
  const date = rows[0].createdAt.toISOString().slice(0, 10);
  const lines = rows.map((r) => {
    const need = needs.find((n) => n.id === r.needId);
    const check = evaluateGift(
      { id: r.referenceId, date, amount: Number(r.amount), delivery: r.route as Delivery, category: (need?.category ?? "other") as Category, recurring: need?.recurring },
      DEFAULT_PROFILE,
    );
    return { row: r, title: need?.title ?? "Savings in her ABLE account", check };
  });
  const captured = rows.every((r) => r.status === "captured");
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  const ruleIds = [...new Set(lines.flatMap((l) => l.check.ruleIds))];
  // The whole order counted together, the way Social Security counts a month.
  const checkAfter = computeMonth(
    monthOf(date),
    lines.map((l) => ({ id: l.row.referenceId, date, amount: Number(l.row.amount), delivery: l.row.route as Delivery, category: l.check.gift.category })),
    DEFAULT_PROFILE,
  ).check;
  const payer = rows.find((r) => r.payerName)?.payerName?.split(" ")[0];

  return (
    <>
      <section className="rc-summary" data-ui aria-labelledby="rc-total">
        <div>
          <p className="rc-k">{captured ? "Given" : "Started, not yet completed"}</p>
          <p id="rc-total" className="rc-total tabular">
            {usd(total)}
          </p>
          <p className="rc-sub">
            {payer ? `From ${payer}, ` : ""}
            {rows.length === 1 ? "to one recipient" : `split across ${rows.length} recipients`} in one PayPal payment on {when(rows[0].createdAt)}.
          </p>
        </div>
        <dl className="rc-facts">
          <div>
            <dt>Counted as {hers} income</dt>
            <dd className="tabular">$0</dd>
          </div>
          <div>
            <dt>Her SSI check after this gift</dt>
            <dd className="tabular" data-kept="">
              {usd(checkAfter)}
            </dd>
          </div>
          <div>
            <dt>Sent to {hers} bank or to Giftwise</dt>
            <dd className="tabular">$0</dd>
          </div>
        </dl>
      </section>

      <section className="page-section" aria-labelledby="rc-where">
        <h2 id="rc-where">Where every dollar went</h2>
        <ul className="rc-lines">
          {lines.map(({ row, title }) => (
            <li key={row.id} className="rc-line">
              <div>
                <p className="rc-payee">{row.payeeName}</p>
                <p className="rc-for">
                  {title}. {ROUTE[row.route] ?? row.route}.
                </p>
                <p className="rc-ids tabular">
                  {row.captureId ? `PayPal capture ${row.captureId}` : `PayPal order ${row.orderId}, ${row.status}`}
                </p>
              </div>
              <p className="rc-amount tabular">{usd(Number(row.amount))}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="page-section" aria-labelledby="rc-why">
        <h2 id="rc-why">Why her check stays the same</h2>
        <ul className="rc-rules">
          {ruleIds.map((id) => {
            const rule = RULES[id];
            if (!rule) return null;
            return (
              <li key={id}>
                <p className="rc-rule-name">
                  {rule.name} <span className="muted">({id})</span>
                </p>
                <p>{rule.plain}</p>
              </li>
            );
          })}
        </ul>
        <p className="rc-sources-k">Sources</p>
        <ul className="rc-sources">
          {sourcesFor(ruleIds).map((k) => (
            <li key={k}>
              <a className="text-link" href={SRC[k]?.url} target="_blank" rel="noreferrer">
                {SRC[k]?.title ?? k}
              </a>
            </li>
          ))}
        </ul>
        <p className="rc-version muted">Rules version {RULES_VERSION}. Checked by the Giftwise rules engine before PayPal created the order.</p>
      </section>

      <section className="page-section" aria-labelledby="rc-check">
        <div className="title-row">
          <h2 id="rc-check">Check it yourself</h2>
          <Info id="gift.receipt" label="" />
        </div>
        <ReceiptChecks orderId={orderId} />
        <ol className="rc-events">
          {events.map((e) => (
            <li key={e.id}>
              <span>{ACTION[e.action] ?? e.action}</span>
              <span className="muted">{when(e.at)}</span>
              <span className="rc-hash tabular" title={e.hash}>
                {e.hash.slice(0, 16)}
              </span>
            </li>
          ))}
        </ol>
        <p className="rc-hash-note muted">Each line is one entry in the Giftwise ledger. Every entry&rsquo;s fingerprint includes the one before it, so no past entry can change without the check above failing.</p>
      </section>

      {household && (
        <p className="page-section">
          <Link className="text-link" href={`/g/${household.slug}`}>
            Back to {name}&rsquo;s page
          </Link>
        </p>
      )}
    </>
  );
}

// The header is the static shell; the order id is runtime data, so it is read inside Suspense.
export default function Page({ params }: { params: Promise<{ orderId: string }> }) {
  return (
    <div className="page frame receipt">
      <header className="page-head">
        <div className="title-row">
          <h1 className="page-title">Receipt</h1>
          <Info id="gift.receipt" />
        </div>
        <p className="lede">A public record of one gift: who was paid, how much, and the rule that kept her check whole. Anyone with this link can check it against PayPal.</p>
      </header>
      <Suspense fallback={<p className="page-loading">Loading the receipt…</p>}>
        <Receipt params={params} />
      </Suspense>
    </div>
  );
}
