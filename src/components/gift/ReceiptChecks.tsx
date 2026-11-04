"use client";

import { useState } from "react";
import { usd } from "@/lib/rules";
import { receiptText, type Lang } from "@/lib/i18n/gift";

type Unit = { reference_id: string; amount: string; captures: { id: string; status: string; amount: string }[] };
type Live = { status: string; units: Unit[] };
type Ledger = { ok: boolean; count: number; brokenAt?: number };


/** Two live checks a visitor can run: ask PayPal for the order now, and recompute the ledger's hash chain. */
export function ReceiptChecks({ orderId, lang = "en" }: { orderId: string; lang?: Lang }) {
  const t = receiptText(lang);
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
      if (!r.ok) throw new Error(j.error?.message ?? t.paypalNoAnswer);
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
      setNote(t.ledgerNoRun);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rc-checks">
      <div className="rc-check-buttons">
        <button type="button" className="btn btn-ink" onClick={checkPayPal} disabled={busy !== null}>
          {busy === "paypal" ? t.asking : t.checkPayPal}
        </button>
        <button type="button" className="btn btn-quiet" onClick={checkLedger} disabled={busy !== null}>
          {busy === "ledger" ? t.checking : t.verifyLedger}
        </button>
      </div>
      <div aria-live="polite">
        {live && (
          <div className="rc-live" data-ui>
            <p className="rc-live-head">
              {t.paypalSays} <strong>{t.status[live.status] ?? live.status.toLowerCase().replace(/_/g, " ")}</strong>.
            </p>
            <ul>
              {live.units.map((u) => (
                <li key={u.reference_id}>
                  <span>{u.reference_id === "able-savings" ? t.ableUnit : t.needUnit(u.reference_id.replace("need-", ""))}</span>
                  <span className="tabular">{usd(Number(u.amount))}</span>
                  <span className="muted">{u.captures[0] ? t.captureLine(u.captures[0].id, u.captures[0].status.toLowerCase()) : t.notCaptured}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {ledger && (
          <p className="rc-ledger" data-ok={ledger.ok ? "" : undefined}>
            {ledger.ok ? t.ledgerOk(ledger.count) : t.ledgerBroken(ledger.brokenAt)}
          </p>
        )}
        {note && <p className="rc-note">{note}</p>}
      </div>
    </div>
  );
}
