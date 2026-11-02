"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Info } from "../Info";
import { usePrefs } from "../prefs";
import { PayPalPay, requestOrder, type Receipt } from "./PayPalPay";
import { routeGift, type OpenNeed, type RoutedLine } from "@/lib/routing";
import { usd } from "@/lib/rules";

/**
 * "Give any amount": the donor types a number; the rules engine routes it across her needs and her ABLE account,
 * and one PayPal checkout pays every recipient directly.
 */
export function GiveAny({ slug, name, needs, date }: { slug: string; name: string; needs: OpenNeed[]; date: string }) {
  const { prefs } = usePrefs();
  const router = useRouter();
  const [raw, setRaw] = useState("500");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  // The lines the donor saw when they paid. The page refreshes after payment, so `plan` moves on to what is still open.
  const [paidLines, setPaidLines] = useState<RoutedLine[]>([]);
  const amount = Math.min(10000, Math.max(0, Number(raw.replace(/[^0-9.]/g, "")) || 0));
  const plan = useMemo(() => routeGift(amount, needs, date), [amount, needs, date]);
  const ready = amount >= 1 && plan.lines.length > 0;

  if (receipt) {
    const titles = new Map(paidLines.map((l) => [l.referenceId, l.title]));
    const order = new Map(paidLines.map((l, i) => [l.referenceId, i]));
    const captures = [...receipt.captures].sort((a, b) => (order.get(a.reference_id) ?? 99) - (order.get(b.reference_id) ?? 99));
    return (
      <div className="give-any" data-ui role="status">
        <p className="give-done">Thank you{receipt.payerFirstName ? `, ${receipt.payerFirstName}` : ""}.</p>
        <p>
          Your {usd(Number(receipt.amount))} went straight to {captures.length} {captures.length === 1 ? "recipient" : "recipients"} in one PayPal payment. {name} keeps her full check.
        </p>
        <ul className="give-lines">
          {captures.map((c) => (
            <li key={c.reference_id}>
              <span>
                {c.payee}
                {titles.has(c.reference_id) && <span className="muted"> ({titles.get(c.reference_id)})</span>}
              </span>
              <span className="tabular">{usd(Number(c.amount ?? 0))}</span>
            </li>
          ))}
        </ul>
        <p className="give-actions">
          <Link className="text-link" href={`/r/${receipt.orderId}`}>
            See the receipt
          </Link>
          <button type="button" className="give-again" onClick={() => setReceipt(null)}>
            Give again
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="give-any" data-ui>
      <div className="title-row">
        <h2 className="give-title">Give any amount</h2>
        <Info id="gift.any" label="" />
      </div>
      <label className="give-field">
        <span>Your gift</span>
        <span className="give-input-wrap">
          <span aria-hidden="true">$</span>
          <input inputMode="decimal" value={raw} onChange={(e) => setRaw(e.target.value)} aria-label="Your gift in dollars" className="give-input tabular" />
        </span>
      </label>
      {amount > 0 && (
        <>
          <p className="give-k">Giftwise sends it here</p>
          <ul className="give-lines" aria-live="polite">
            {plan.lines.map((l) => (
              <li key={l.referenceId}>
                <span>
                  {l.payeeName} <span className="muted">({l.title})</span>
                </span>
                <span className="tabular">{usd(l.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="give-compare">
            <div>
              <p className="give-k">As cash</p>
              <p className="give-fig tabular">{usd(plan.checkIfCash)}</p>
            </div>
            <div>
              <p className="give-k">With Giftwise</p>
              <p className="give-fig tabular" data-kept="">
                {usd(plan.checkWithRouting)}
              </p>
            </div>
          </div>
          <p className="give-note">Her check either way. One PayPal payment pays every recipient directly. Nothing goes to her bank or to Giftwise.</p>
          {prefs.mode === "technical" && (
            <p className="give-tech">
              One Orders v2 order with {plan.lines.length} purchase {plan.lines.length === 1 ? "unit" : "units"}, each with its own payee. Rules:{" "}
              {[...new Set(plan.lines.flatMap((l) => l.ruleIds))].join(", ")}.
            </p>
          )}
          {plan.unplaced > 0 && <p className="give-attention">{usd(plan.unplaced)} has no benefit-safe place right now, so it is not included.</p>}
        </>
      )}
      <PayPalPay
        disabled={!ready}
        createOrder={() => requestOrder("/api/paypal/gift-orders", { slug, amount })}
        onPaid={(r) => {
          setPaidLines(plan.lines);
          setReceipt(r);
          router.refresh();
        }}
      />
    </div>
  );
}
