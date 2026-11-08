"use client";

import { useState } from "react";
import { usePrefs } from "../prefs";
import { modelName } from "@/lib/ai/model-name";
import { addMonths, checkMonthName, fbr, usd } from "@/lib/rules";

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
function PayPalOrderCard({ text, technical }: { text: string; technical: boolean }) {
  let o: PayPalRecord | null = null;
  try {
    o = JSON.parse(text) as PayPalRecord;
  } catch {
    o = null;
  }
  if (!o?.status) return <p className="ag-result-text">{tidy(text)}</p>;
  const src = o.source ?? "";
  const viaMcp = /MCP server.*get_order/.test(src) && !src.startsWith("PayPal's own record");
  const local = src.includes("@paypal/mcp");
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
        {viaMcp
          ? technical
            ? local
              ? "Read with get_order on PayPal's own MCP server, the @paypal/mcp package, which Giftwise runs."
              : "Read with get_order on PayPal's hosted MCP server."
            : "Read from PayPal's own MCP server."
          : technical
            ? "Read from PayPal's Orders API. PayPal's MCP server was asked first and could not run get_order this time."
            : "Read from PayPal's Orders API."}
      </p>
    </div>
  );
}

/** One line's **bold** and bare links. */
function Inline({ line }: { line: string }) {
  return (
    <>
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
    </>
  );
}

/** Plain text with **bold**, bare links and "- " lists, the way the assistant writes it. Nothing is rendered as HTML. */
function Rich({ text }: { text: string }) {
  const lines = tidy(text)
    .replace(/\p{Extended_Pictographic}️?/gu, "")
    .split(/\n+/)
    .filter((line) => line.trim());
  // Consecutive "- " lines become one list; every other line is a paragraph.
  const blocks: (string | string[])[] = [];
  for (const line of lines) {
    const item = /^\s*[-*]\s+(.*)$/.exec(line);
    const last = blocks[blocks.length - 1];
    if (item && Array.isArray(last)) last.push(item[1]);
    else blocks.push(item ? [item[1]] : line);
  }
  return (
    <>
      {blocks.map((b, i) =>
        Array.isArray(b) ? (
          <ul key={i} className="ag-list">
            {b.map((li, k) => (
              <li key={k}>
                <Inline line={li} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            <Inline line={b} />
          </p>
        ),
      )}
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
  // A gift given on the day of the run sets the check paid two months later, at that year's federal amount.
  const runDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(run.recorded_at && !live ? new Date(run.recorded_at) : new Date());
  const payMonth = addMonths(runDay.slice(0, 7), 2);
  return (
    <div className="ag" data-check-year="">
      <p className="muted ag-source">
        {live
          ? `Run live just now with ${modelName(run.model)}: ${calls} tool calls in ${Math.round(run.ms / 1000)} seconds.`
          : `Recorded ${run.recorded_at ? new Date(run.recorded_at).toLocaleDateString("en-US", { dateStyle: "medium" }) : ""} with ${modelName(run.model)}: ${calls} tool calls. The PayPal link from the recording is removed; a live run makes a fresh one.`}{" "}
        Every check named below is Maya&rsquo;s {checkMonthName(payMonth)} check, whose full amount is {usd(fbr(false, payMonth))}.
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
          if (s.kind === "call") {
            // The call and its answer share one row; what was sent and what came back open below it.
            const next = run.steps[i + 1];
            const result = next?.kind === "result" && next.tool === s.tool ? next : null;
            return (
              <li key={i} className="ag-step ag-call">
                <details className="dsc ag-io">
                  <summary>
                    <span className="ag-tool tabular">{s.tool}</span>
                    <span className="dsc-k">{TOOL_WORDS[s.tool] ?? ""}</span>
                    <span className="ag-io-hint">What it sent and got back</span>
                  </summary>
                  <div className="ag-io-body">
                    <p className="ag-io-k">Sent</p>
                    <pre className="ag-json tabular">{JSON.stringify(s.input)}</pre>
                    {result && (
                      <>
                        <p className="ag-io-k">Got back</p>
                        <p className="ag-result-text">{tidy(result.text)}</p>
                      </>
                    )}
                  </div>
                </details>
              </li>
            );
          }
          // PayPal's own record of the order, and any error, stay in view. Other answers are inside their call's row.
          const card = s.tool === "paypal_get_order" && !s.isError;
          const prev = run.steps[i - 1];
          if (!card && !s.isError && prev?.kind === "call" && prev.tool === s.tool) return null;
          return (
            <li key={i} className="ag-step ag-result" data-error={s.isError ? "" : undefined}>
              {card ? <PayPalOrderCard text={s.text} technical={prefs.mode === "technical"} /> : <p className="ag-result-text">{tidy(s.text)}</p>}
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
