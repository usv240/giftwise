"use client";

import { useState } from "react";
import reporting from "../../../content/reporting.json";
import { usePrefs } from "../prefs";

type Passage = { id: string; kind: string; cite: string; title: string; text: string; url: string | null; score: number };
type Quote = { cite: string; passage_id: string; quote: string; found_word_for_word: boolean; url: string | null };
type Result = { question: string; answer: string | null; quotes: Quote[]; passages: Passage[]; retrieval: { engine: string; model: string | null; reranker?: string | null }; ai: boolean };

const EXAMPLES = ["Does it count if my sister pays my phone bill?", "Can my mom pay my rent?", "Is a gift card counted as income?", "Can a gift go into an ABLE account?"];
const KIND: Record<string, string> = { regulation: "Regulation", manual: "SSA's operating manual", example: "SSA's worked example", rule: "Giftwise rule" };
/** The API takes 4 to 300 characters. */
const MIN = 4;
const SHORT = "Type a few more words, for example: Can my mom pay my rent?";
/** Social Security's free benefits counseling, the same page /judges cites. */
const COUNSELING = "https://choosework.ssa.gov/library/fact-sheet-benefits-counseling-and-the-path-to-employment";

/** Ask a question; see the passages Elasticsearch found, the answer written from them, and each quote checked. */
export function AskRulebook() {
  const { prefs } = usePrefs();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [msg, setMsg] = useState("");
  const [short, setShort] = useState(false);
  async function ask(question: string) {
    setQ(question);
    setShort(false);
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/v1/ask-rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "The rulebook did not answer. Please try again.");
      setRes(j.data);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const engine =
    res?.retrieval.engine === "elasticsearch"
      ? `Found by Elasticsearch: keyword and semantic search${res.retrieval.model && res.retrieval.model !== "default" ? ` with ${res.retrieval.model.replace(/^\./, "")}` : ""}, fused by rank${res.retrieval.reranker ? `, then reranked by ${res.retrieval.reranker.replace(/^\./, "")}` : ""}.`
      : "Found by keyword search in the app.";
  // Nothing found, or an answer with no quote that holds up: the rulebook does not settle it, so say who can.
  const unsettled = res ? res.passages.length === 0 || (res.ai && !res.quotes.some((x) => x.found_word_for_word)) : false;
  return (
    <section className="ask" aria-labelledby="ask-h" data-ui>
      <h2 id="ask-h" className="ask-h">
        Ask the rulebook
      </h2>
      <p className="ask-sub">A question in your own words. The answer comes only from SSI&rsquo;s regulations, Social Security&rsquo;s manual and its worked examples, and every quote is checked against them.</p>
      <form
        className="ask-form"
        role="search"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const question = q.trim();
          if (question.length < MIN) {
            setShort(true);
            setMsg(SHORT);
            return;
          }
          void ask(question);
        }}
      >
        <label className="ask-field">
          <span className="sr-only">Your question</span>
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              if (short && e.target.value.trim().length >= MIN) {
                setShort(false);
                setMsg("");
              }
            }}
            placeholder="Type a question in your own words"
            required
            minLength={MIN}
            maxLength={300}
            aria-invalid={short || undefined}
            aria-describedby={msg ? "ask-note" : undefined}
          />
        </label>
        <button type="submit" className="btn btn-ink" disabled={busy}>
          {busy ? "Looking…" : "Ask"}
        </button>
      </form>
      <p className="ask-examples">
        {EXAMPLES.map((x) => (
          <button key={x} type="button" className="ask-chip" onClick={() => void ask(x)} disabled={busy}>
            {x}
          </button>
        ))}
      </p>
      {msg && (
        <p id="ask-note" className="ask-note" role="status">
          {msg}
        </p>
      )}
      <div aria-live="polite">
        {res && (
          <div className="ask-result">
            {res.answer ? (
              <p className="ask-answer">{res.answer}</p>
            ) : res.passages.length > 0 ? (
              <p className="ask-answer muted">Here are the passages that match. An answer in plain words appears when the AI service is connected.</p>
            ) : (
              <p className="ask-answer muted">The rulebook has no passage on this question.</p>
            )}
            {unsettled && (
              <p className="ask-next">
                A benefits counselor can help with this one. Social Security funds{" "}
                <a className="text-link" href={COUNSELING} target="_blank" rel="noreferrer">
                  free benefits counseling
                </a>
                , or you can call Social Security at{" "}
                <a className="text-link tabular" href={`tel:${reporting.phone.replace(/\D/g, "")}`}>
                  {reporting.phone}
                </a>
                .
              </p>
            )}
            {res.quotes.length > 0 && (
              <ul className="ask-quotes">
                {res.quotes.map((x, i) => (
                  <li key={i} data-found={x.found_word_for_word ? "" : undefined}>
                    <blockquote>&ldquo;{x.quote}&rdquo;</blockquote>
                    <p className="ask-quote-meta">
                      {x.url ? (
                        <a className="text-link" href={x.url} target="_blank" rel="noreferrer">
                          {x.cite}
                        </a>
                      ) : (
                        x.cite
                      )}
                      <span className="ask-check">{x.found_word_for_word ? "Quote found word for word" : "Quote not found in the passage, so it is set aside"}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {res.passages.length > 0 && (
              <details className="ask-passages">
                <summary>
                  The {res.passages.length} passages it read.{prefs.mode === "technical" && <span className="muted"> {engine}</span>}
                </summary>
                <ol>
                  {res.passages.map((p) => (
                    <li key={p.id}>
                      <p className="ask-p-head">
                        <span className="ask-kind">{KIND[p.kind] ?? p.kind}</span>{" "}
                        {p.url ? (
                          <a className="text-link" href={p.url} target="_blank" rel="noreferrer">
                            {p.cite}
                          </a>
                        ) : (
                          <strong>{p.cite}</strong>
                        )}{" "}
                        <span className="muted">{p.title}</span>
                      </p>
                      <p className="ask-p-text">{p.text}</p>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
