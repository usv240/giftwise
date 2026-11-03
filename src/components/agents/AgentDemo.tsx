"use client";

import { useState } from "react";
import { usePrefs } from "../prefs";

type Step =
  { kind: "ask"; text: string } | { kind: "say"; text: string } | { kind: "call"; tool: string; input: unknown } | { kind: "result"; tool: string; text: string; isError: boolean };
export type AgentRun = { recorded_at?: string; model: string; ms: number; steps: Step[] };

const TOOL_WORDS: Record<string, string> = {
  check_gift: "Checks what cash would do",
  get_gift_page: "Reads Maya's gift page",
  plan_gift: "Plans the gift",
  review_bill: "Asks the two reviewers",
  start_gift_checkout: "Starts a PayPal checkout for June to approve",
  paypal_get_order: "Reads the order from PayPal itself, not from Giftwise",
};

/** A recorded run hides the one-time PayPal link and receipt address; say what they were instead of showing brackets. */
const tidy = (t: string) =>
  t
    .replace(/\[PayPal approval link\]/g, "(her PayPal approval link; a live run makes a fresh one)")
    .replace(/\/r\/\[receipt\]/g, "her receipt page")
    .replace(/"\[order id\]"/g, '"(order id)"');

type PayPalRecord = { source?: string; status?: string; purchase_units?: { for?: string; amount?: string; paid_to_paypal_account?: string }[] };
const STATUS_WORDS: Record<string, string> = {
  PAYER_ACTION_REQUIRED: "Waiting for June to approve it in PayPal",
  APPROVED: "Approved by June, not yet captured",
  COMPLETED: "Paid",
  CREATED: "Created",
};

/** The order as PayPal reports it, as a small card instead of raw JSON. */
function PayPalOrderCard({ text }: { text: string }) {
  let o: PayPalRecord | null = null;
  try {
    o = JSON.parse(text) as PayPalRecord;
  } catch {
    o = null;
  }
  if (!o?.status) return <p className="ag-result-text">{tidy(text)}</p>;
  const viaMcp = (o.source ?? "").startsWith("PayPal MCP server");
  return (
    <div className="ag-record">
      <p className="ag-record-k">PayPal&rsquo;s own record</p>
      <p>{STATUS_WORDS[o.status] ?? o.status}</p>
      <ul>
        {(o.purchase_units ?? []).map((u, i) => (
          <li key={i}>
            <span className="tabular">${u.amount}</span> for {u.for}
            {u.paid_to_paypal_account && <span className="muted">, paid to PayPal account {u.paid_to_paypal_account}</span>}
          </li>
        ))}
      </ul>
      <p className="muted ag-record-src">
        {viaMcp ? "Read with get_order on PayPal's hosted MCP server." : "Read from PayPal's Orders API. PayPal's hosted MCP server was asked first and could not run get_order this time."}
      </p>
    </div>
  );
}

/** Plain text with **bold** and bare links, the way the assistant writes it. Nothing is rendered as HTML. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {tidy(text)
        .replace(/\p{Extended_Pictographic}️?/gu, "")
        .split(/\n+/)
        .filter((line) => line.trim())
        .map((line, i) => (
          <p key={i}>
            {line.split(/(\*\*[^*]+\*\*|https?:\/\/\S+)/g).map((part, j) => {
              if (part.startsWith("**") && part.endsWith("**")) return <strong key={j}>{part.slice(2, -2)}</strong>;
              if (/^https?:\/\//.test(part)) {
                const href = part.replace(/[).,]+$/, "");
                return (
                  <a key={j} className="text-link" href={href} target="_blank" rel="noreferrer">
                    {href.includes("paypal.com") ? "Open PayPal to approve" : href}
                  </a>
                );
              }
              return part;
            })}
          </p>
        ))}
    </>
  );
}

/** The assistant's conversation: June's words, each Giftwise tool it called over MCP, and its answers. */
export function AgentDemo({ recorded }: { recorded: AgentRun }) {
  const { prefs } = usePrefs();
  const [run, setRun] = useState<AgentRun>(recorded);
  const [live, setLive] = useState(false);
  const [status, setStatus] = useState<"idle" | "running" | "error">("idle");
  const [note, setNote] = useState("");

  async function go() {
    setStatus("running");
    setNote("");
    try {
      const r = await fetch("/api/agent-demo", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "The assistant could not run. Please try again.");
      setRun(j.data);
      setLive(true);
      setStatus("idle");
    } catch (e) {
      setNote((e as Error).message);
      setStatus("error");
    }
  }

  const calls = run.steps.filter((s) => s.kind === "call").length;
  return (
    <div className="ag">
      <p className="muted ag-source">
        {live
          ? `Run live just now with ${run.model}: ${calls} tool calls in ${Math.round(run.ms / 1000)} seconds.`
          : `Recorded ${run.recorded_at ? new Date(run.recorded_at).toLocaleDateString("en-US", { dateStyle: "medium" }) : ""} with ${run.model}: ${calls} tool calls. The PayPal link from the recording is removed; a live run makes a fresh one.`}
      </p>
      <ol className="ag-steps" aria-live="polite">
        {run.steps.map((s, i) => {
          if (s.kind === "ask")
            return (
              <li key={i} className="ag-step ag-ask" data-ui>
                <p className="ag-who">June</p>
                <Rich text={s.text} />
              </li>
            );
          if (s.kind === "say")
            return (
              <li key={i} className="ag-step ag-say" data-ui>
                <p className="ag-who">Her assistant</p>
                <Rich text={s.text} />
              </li>
            );
          if (s.kind === "call")
            return (
              <li key={i} className="ag-step ag-call">
                <p>
                  <span className="ag-tool tabular">{s.tool}</span> {TOOL_WORDS[s.tool] ?? ""}
                </p>
                {prefs.mode === "technical" && <pre className="ag-json tabular">{JSON.stringify(s.input)}</pre>}
              </li>
            );
          return (
            <li key={i} className="ag-step ag-result" data-error={s.isError ? "" : undefined}>
              {s.tool === "paypal_get_order" && !s.isError ? <PayPalOrderCard text={s.text} /> : <p className="ag-result-text">{tidy(s.text)}</p>}
            </li>
          );
        })}
      </ol>
      <div className="ag-actions">
        <button type="button" className="btn btn-primary" onClick={go} disabled={status === "running"}>
          {status === "running" ? "The assistant is working…" : "Run it live"}
        </button>
        {status === "running" && <p className="muted">It reads Maya&rsquo;s page, plans the gift and starts a sandbox checkout. About 30 seconds.</p>}
        {status === "error" && <p className="result-attention">{note}</p>}
      </div>
    </div>
  );
}
