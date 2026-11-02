"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Info } from "../Info";
import { usePrefs } from "../prefs";
import { usd } from "@/lib/rules";

export type OrgHousehold = { slug: string; name: string; open: number };
type Planned = { senderItemId: string; household: string; title: string; payeeName: string; route: string; amount: number; ruleIds: string[] };
type HouseholdPlan = { slug: string; name: string; checkWithGrant: number; checkIfCash: number; unplaced: number };
type Item = { title: string; payee: string; route: string; amount: number; status: string; transaction_id: string | null; in_paypal_report: "found" | "waiting" | "unavailable" };
type Batch = { batch_id: string; batch_status: string; items: Item[] };

const DONE = new Set(["SUCCESS", "DENIED", "CANCELED"]);
const ITEM_WORDS: Record<string, string> = { SUCCESS: "Paid", PENDING: "Sending", UNCLAIMED: "Waiting for the payee to claim", RETURNED: "Returned to the fund", FAILED: "Not sent", ONHOLD: "On hold at PayPal", BLOCKED: "Held by PayPal" };
const REPORT_WORDS = { found: "In PayPal's transaction report", waiting: "Waiting for PayPal's report (the sandbox can take up to 3 hours)", unavailable: "Transaction report unavailable" };

/** An organization chooses households and grant amounts; Giftwise routes each grant and sends one PayPal Payouts batch. */
export function OrgPayouts({ households, limits, initialBatch }: { households: OrgHousehold[]; limits: { perHousehold: number; perBatch: number }; initialBatch?: string }) {
  const { prefs } = usePrefs();
  const [amounts, setAmounts] = useState<Record<string, string>>(Object.fromEntries(households.map((h, i) => [h.slug, i === 0 ? "150" : ""])));
  const [plan, setPlan] = useState<{ households: HouseholdPlan[]; items: Planned[] } | null>(null);
  const [batchId, setBatchId] = useState<string | null>(initialBatch ?? null);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [busy, setBusy] = useState<"preview" | "send" | null>(null);
  const [note, setNote] = useState("");

  const grants = households.map((h) => ({ slug: h.slug, amount: Math.round(Number(amounts[h.slug] || 0) * 100) / 100 })).filter((g) => g.amount > 0);
  const total = grants.reduce((s, g) => s + g.amount, 0);
  const tooMuch = total > limits.perBatch || grants.some((g) => g.amount > limits.perHousehold);

  async function call(preview: boolean) {
    setBusy(preview ? "preview" : "send");
    setNote("");
    try {
      const r = await fetch("/api/org/payouts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ grants, preview }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "That did not work. Please try again.");
      setPlan({ households: j.data.households, items: j.data.items });
      if (!preview) {
        setBatch(null);
        setBatchId(j.data.batch_id);
      }
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  // Follow the batch until PayPal finishes it, then once more a little later for the transaction report.
  useEffect(() => {
    if (!batchId) return;
    let stop = false;
    let tries = 0;
    const tick = async () => {
      const r = await fetch(`/api/org/payouts/${batchId}`, { cache: "no-store" }).catch(() => null);
      const j = r?.ok ? await r.json() : null;
      if (stop) return;
      if (j?.data) setBatch(j.data);
      tries++;
      if (!DONE.has(j?.data?.batch_status) && tries < 25) setTimeout(tick, 4000);
    };
    tick();
    return () => {
      stop = true;
    };
  }, [batchId]);

  return (
    <div className="org">
      <section className="page-section" aria-labelledby="grants-h">
        <div className="title-row">
          <h2 id="grants-h">Choose the grants</h2>
          <Info id="org.grants" label="" />
        </div>
        <ul className="org-households">
          {households.map((h) => (
            <li key={h.slug} className="org-household" data-ui>
              <div>
                <p className="org-name">
                  <Link className="text-link" href={`/g/${h.slug}`}>
                    {h.name}
                  </Link>
                </p>
                <p className="muted">{usd(h.open)} still needed</p>
              </div>
              <label className="try-field org-amount">
                <span>Grant</span>
                <span className="give-input-wrap">
                  <span aria-hidden="true">$</span>
                  <input
                    inputMode="decimal"
                    className="give-input tabular"
                    aria-label={`Grant to ${h.name} in dollars`}
                    value={amounts[h.slug] ?? ""}
                    onChange={(e) => {
                      setPlan(null);
                      setAmounts((a) => ({ ...a, [h.slug]: e.target.value.replace(/[^0-9.]/g, "") }));
                    }}
                  />
                </span>
              </label>
            </li>
          ))}
        </ul>
        <p className="muted org-limits">
          Sandbox limits: up to {usd(limits.perHousehold)} for each household and {usd(limits.perBatch)} for each batch.
        </p>
        <div className="try-actions">
          <button type="button" className="btn btn-quiet" onClick={() => call(true)} disabled={!!busy || grants.length === 0 || tooMuch}>
            {busy === "preview" ? "Routing…" : "Show the routing"}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => call(false)} disabled={!!busy || grants.length === 0 || tooMuch}>
            {busy === "send" ? "Sending to PayPal…" : `Send ${usd(total)} as one PayPal payout batch`}
          </button>
        </div>
        {tooMuch && <p className="result-attention">That is over the sandbox limit for one batch.</p>}
        {note && (
          <p className="result-attention" role="status">
            {note}
          </p>
        )}
      </section>

      {plan && (
        <section className="page-section" aria-labelledby="plan-h">
          <h2 id="plan-h">Where each dollar goes</h2>
          <div className="org-plans">
            {plan.households.map((h) => (
              <div key={h.slug} className="read-card" data-ui>
                <p className="result-k">{h.name}</p>
                <ul className="give-lines">
                  {plan.items
                    .filter((i) => i.household === h.name)
                    .map((i) => (
                      <li key={i.senderItemId}>
                        <span>
                          {i.payeeName} <span className="muted">({i.title})</span>
                        </span>
                        <span className="tabular">{usd(i.amount)}</span>
                      </li>
                    ))}
                </ul>
                <p className="read-plain">
                  Check stays <strong className="tabular">{usd(h.checkWithGrant)}</strong>. Sent as cash it would be <strong className="tabular">{usd(h.checkIfCash)}</strong>.
                </p>
                {prefs.mode === "technical" && (
                  <p className="result-tech">
                    Rules {[...new Set(plan.items.filter((i) => i.household === h.name).flatMap((i) => i.ruleIds))].join(", ")}. One Payouts item for each payee, sender_item_id {"h{household}-{line}"}.
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {batchId && (
        <section className="page-section" aria-labelledby="batch-h" aria-live="polite">
          <div className="title-row">
            <h2 id="batch-h">Payout batch {batchId}</h2>
            <Info id="org.batch" label="" />
          </div>
          <p className="org-batch-status">
            PayPal says: <strong>{batch ? (batch.batch_status === "SUCCESS" ? "sent" : batch.batch_status.toLowerCase()) : "checking…"}</strong>
          </p>
          {batch && (
            <div className="doc-table-wrap" tabIndex={0} role="region" aria-label="Payout items">
              <table className="doc-table">
                <thead>
                  <tr>
                    <th scope="col">Paid to</th>
                    <th scope="col">For</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Status</th>
                    <th scope="col">PayPal transaction</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.items.map((i) => (
                    <tr key={`${i.payee}-${i.title}`}>
                      <td>{i.payee}</td>
                      <td>{i.title}</td>
                      <td className="tabular">{usd(i.amount)}</td>
                      <td>{ITEM_WORDS[i.status] ?? i.status.toLowerCase()}</td>
                      <td>
                        <span className="tabular">{i.transaction_id ?? "Not yet"}</span>
                        {i.transaction_id && <span className="org-report">{REPORT_WORDS[i.in_paypal_report]}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
