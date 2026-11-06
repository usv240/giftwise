"use client";

import { useState, type FormEvent } from "react";
import type { Trace } from "@/lib/ops";

const TIME = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

/** Paste a request id from any API response and see what that request did. */
export function TraceBox() {
  const [id, setId] = useState("");
  const [result, setResult] = useState<Trace | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNote("");
    try {
      const r = await fetch(`/api/ops/trace?id=${encodeURIComponent(id.trim())}`, { cache: "no-store" });
      const j = (await r.json()) as { data?: Trace; error?: { message: string } };
      if (!j.data) {
        setResult(null);
        setNote(j.error?.message ?? "That id could not be looked up.");
        return;
      }
      setResult(j.data);
      if (!j.data.requests.length && !j.data.ledger.length) setNote("Nothing recorded under that id. Request logs are kept for seven days; the ledger is kept for good.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ops-trace" data-ui>
      <form className="ops-trace-form" onSubmit={submit}>
        <label className="ops-trace-label" htmlFor="ops-trace-id">
          Request id
        </label>
        <input id="ops-trace-id" className="ops-trace-input" value={id} onChange={(e) => setId(e.target.value)} placeholder="req_…" spellCheck={false} autoComplete="off" required minLength={8} maxLength={64} pattern="[A-Za-z0-9_.\-]+" />
        <button type="submit" className="btn btn-primary" disabled={busy || id.trim().length < 8}>
          {busy ? "Looking…" : "Trace"}
        </button>
      </form>
      <p className="ops-note muted">Every API error message ends with its request id, and every success carries one in meta.request_id.</p>
      <p className="ops-trace-note" aria-live="polite">
        {note}
      </p>
      {result && (result.requests.length > 0 || result.ledger.length > 0 || result.ai.length > 0) && (
        <div className="ops-trace-out">
          <h3 className="ops-h3 tabular">{result.id}</h3>
          <ul className="ops-trace-list" aria-label="Log lines">
            {result.requests.map((r, i) => (
              <li key={`r${i}`} className="ops-event" data-kind="request" data-tone={r.status >= 500 ? "attention" : r.status >= 400 ? "plain" : "ok"}>
                <span className="ops-event-time tabular">{TIME.format(new Date(r.at))}</span>
                <span className="ops-event-kind">request</span>
                <span className="ops-event-text">
                  {r.method} {r.route}
                </span>
                <span className="ops-event-detail muted tabular">
                  {r.status} in {r.ms} ms
                </span>
              </li>
            ))}
            {result.ledger.map((l, i) => (
              <li key={`l${i}`} className="ops-event" data-kind="ledger" data-tone="ok">
                <span className="ops-event-time tabular">{TIME.format(new Date(l.at))}</span>
                <span className="ops-event-kind">ledger</span>
                <span className="ops-event-text">{l.action}</span>
                <span className="ops-event-detail muted">
                  {l.actor}, {l.ref}, hash {l.hash}…
                </span>
              </li>
            ))}
            {result.ai.map((a, i) => (
              <li key={`a${i}`} className="ops-event" data-kind="ai" data-tone="ok">
                <span className="ops-event-time tabular" />
                <span className="ops-event-kind">ai</span>
                <span className="ops-event-text">{a.model}</span>
                <span className="ops-event-detail muted tabular">
                  {a.ms} ms{a.replayed ? ", replayed from disk" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
