"use client";

import { useState } from "react";
import { usd } from "@/lib/rules";

type Unit = { reference_id: string; amount: string; captures: { id: string; status: string; amount: string }[] };
type Live = { status: string; units: Unit[] };
type Ledger = { ok: boolean; count: number; brokenAt?: number };

/** PayPal's order statuses in plain words. A new order is CREATED or PAYER_ACTION_REQUIRED until the donor approves. */
const STATUS: Record<string, string> = {
  CREATED: "waiting for the donor to approve",
  PAYER_ACTION_REQUIRED: "waiting for the donor to approve",
  SAVED: "saved, not yet paid",
  APPROVED: "approved, finishing the payment",
  COMPLETED: "completed",
  VOIDED: "cancelled, nothing was charged",
};

/** Two live checks a visitor can run: ask PayPal for the order now, and recompute the ledger's hash chain. */
export function ReceiptChecks({ orderId }: { orderId: string }) {
  const [live, setLive] = useState<Live | null>(null);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [busy, setBusy] = useState<"paypal" | "ledger" | null>(null);
  const [note, setNote] = useState("");

  async function checkPayPal() {
    setBusy("paypal");
    setNote("");
    try {
      const r = await fetch(`/api/paypal/orders/${orderId}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "PayPal did not answer. Please try again.");
      setLive(j.data);
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function checkLedger() {
    setBusy("ledger");
    setNote("");
    try {
      const r = await fetch("/api/ledger/verify");
      const j = await r.json();
      setLedger(j.data);
    } catch {
      setNote("The ledger check did not run. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rc-checks">
      <div className="rc-check-buttons">
        <button type="button" className="btn btn-ink" onClick={checkPayPal} disabled={busy !== null}>
          {busy === "paypal" ? "Asking PayPal…" : "Check with PayPal now"}
        </button>
        <button type="button" className="btn btn-quiet" onClick={checkLedger} disabled={busy !== null}>
          {busy === "ledger" ? "Checking…" : "Verify the ledger"}
        </button>
      </div>
      <div aria-live="polite">
        {live && (
          <div className="rc-live" data-ui>
            <p className="rc-live-head">
              PayPal says this order is <strong>{STATUS[live.status] ?? live.status.toLowerCase().replace(/_/g, " ")}</strong>.
            </p>
            <ul>
              {live.units.map((u) => (
                <li key={u.reference_id}>
                  <span>{u.reference_id === "able-savings" ? "ABLE account" : u.reference_id.replace("need-", "Need ")}</span>
                  <span className="tabular">{usd(Number(u.amount))}</span>
                  <span className="muted">{u.captures[0] ? `capture ${u.captures[0].id}, ${u.captures[0].status.toLowerCase()}` : "not captured"}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {ledger && (
          <p className="rc-ledger" data-ok={ledger.ok ? "" : undefined}>
            {ledger.ok ? `Ledger intact: all ${ledger.count} entries recomputed and matched.` : `Ledger check found a change at entry ${ledger.brokenAt}.`}
          </p>
        )}
        {note && <p className="rc-note">{note}</p>}
      </div>
    </div>
  );
}
