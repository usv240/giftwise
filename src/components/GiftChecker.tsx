"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import sources from "../../content/sources.json";
import { DEFAULT_PROFILE, evaluateGift, monthName, usd, type Gift, type GiftResult } from "@/lib/rules";
import { Info } from "./Info";
import { usePrefs } from "./prefs";

type Mode = "cash" | "shop" | "rent";
const MODES: { value: Mode; label: string }[] = [
  { value: "cash", label: "Cash to her" },
  { value: "shop", label: "Pay the shop" },
  { value: "rent", label: "Toward rent" },
];
const SRC = sources as Record<string, { title: string; url: string }>;
const DATE = "2026-04-10";

function giftFor(mode: Mode, amount: number): Gift {
  if (mode === "cash") return { id: "hero", date: DATE, amount, delivery: "cash", category: "other", label: "Gift" };
  if (mode === "shop") return { id: "hero", date: DATE, amount, delivery: "vendor", category: "equipment", label: "Wheelchair repair" };
  return { id: "hero", date: DATE, amount, delivery: "vendor", category: "rent", recurring: true, label: "Rent, paid by family each month" };
}

/** The hero's live fragment: the product doing its job, on the page. */
export function GiftChecker() {
  const { prefs } = usePrefs();
  const [raw, setRaw] = useState("1000");
  const [mode, setMode] = useState<Mode>("cash");
  const [touched, setTouched] = useState(false);
  const [showRule, setShowRule] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const amount = Math.max(0, Math.min(100000, Number(raw.replace(/[^0-9.]/g, "")) || 0));
  const result: GiftResult = useMemo(() => evaluateGift(giftFor(mode, amount), DEFAULT_PROFILE), [mode, amount]);
  const viaAble = useMemo(
    () => (mode === "rent" ? evaluateGift({ ...giftFor("rent", amount), delivery: "able" }, DEFAULT_PROFILE) : null),
    [mode, amount],
  );

  // Signature move: the three states take turns until the visitor touches the fragment.
  useEffect(() => {
    if (touched) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const order: Mode[] = ["cash", "shop", "rent"];
    const t = window.setInterval(() => {
      if (document.hidden) return;
      setMode((m) => order[(order.indexOf(m) + 1) % order.length]);
    }, 5600);
    return () => window.clearInterval(t);
  }, [touched]);

  const stop = () => setTouched(true);
  const pay = monthName(result.paymentMonth);
  const inc = monthName(result.incomeMonth);
  const kept = result.checkAfter >= result.checkBaseline;

  return (
    <div
      ref={rootRef}
      className="checker"
      data-ui
      onPointerDown={stop}
      onFocusCapture={stop}
      aria-label="Gift Checker"
      role="group"
    >
      <div className="checker-head">
        <p className="checker-title">Gift Checker</p>
        <Info id="gift-checker.about" />
      </div>

      <label className="checker-field">
        <span className="checker-label">
          Gift amount <Info id="gift-checker.amount" label="" />
        </span>
        <span className="checker-input-wrap">
          <span aria-hidden="true">$</span>
          <input
            inputMode="decimal"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            aria-label="Gift amount in dollars"
            className="checker-input tabular"
          />
        </span>
      </label>

      <fieldset className="checker-field">
        <legend className="checker-label">
          How it reaches her <Info id="gift-checker.route" label="" />
        </legend>
        <div className="checker-seg" role="radiogroup" aria-label="How it reaches her">
          {MODES.map((m) => (
            <label key={m.value} className="checker-seg-opt" data-on={mode === m.value ? "" : undefined}>
              <input type="radio" name="checker-mode" value={m.value} checked={mode === m.value} onChange={() => setMode(m.value)} />
              {m.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="checker-result" aria-live="polite">
        <p className="checker-result-label">
          Her check in {pay} <Info id="gift-checker.result" label="" />
        </p>
        <p key={`${mode}-${result.checkAfter}`} className="checker-figure tabular" data-kept={kept ? "" : undefined}>
          {usd(result.checkAfter)}
        </p>
        {viaAble && (
          <p className="checker-alt tabular">
            Through her ABLE account: <strong>{usd(viaAble.checkAfter)}</strong>
          </p>
        )}
        <p className="checker-note">{result.explanation.plain}</p>
        <p className="checker-mark">
          <span className="mark-chip tabular">
            Counted in {inc}, paid in {pay}
          </span>
          <Info id="gift-checker.rma" label="" />
        </p>
      </div>

      <div className="checker-foot">
        <button type="button" className="checker-rule-btn" aria-expanded={showRule} onClick={() => setShowRule((s) => !s)}>
          {showRule ? "Hide the rule" : "Show the rule"}
        </button>
        <Link href="/try" className="checker-try">
          Try your own situation
        </Link>
      </div>
      {showRule && (
        <ul className="checker-rules">
          {result.sourceKeys.slice(0, 4).map((k) => (
            <li key={k}>
              <a href={SRC[k]?.url} target="_blank" rel="noreferrer">
                {SRC[k]?.title ?? k}
              </a>
            </li>
          ))}
        </ul>
      )}
      {prefs.mode === "technical" && (
        <div className="checker-tech">
          <p>{result.explanation.technical}</p>
          <pre>
            <code>{`POST /api/v1/check-gift
{ "gift": { "amount": ${amount}, "delivery": "${result.gift.delivery}", "category": "${result.gift.category}"${result.gift.recurring ? ', "recurring": true' : ""} } }
-> { "check_after": ${result.checkAfter}, "best_route": "${result.bestRoute}", "rule_ids": ${JSON.stringify(result.ruleIds)} }`}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
