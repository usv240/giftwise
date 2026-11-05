"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import sources from "../../content/sources.json";
import { parseDollars } from "@/lib/parseDollars";
import { DEFAULT_PROFILE, evaluateGift, monthName, usd, type Delivery, type Gift, type GiftResult } from "@/lib/rules";
import { Info } from "./Info";
import { usePrefs } from "./prefs";
import { TOUR_KEY } from "./tour/steps";

type Mode = "cash" | "shop" | "rent";
const MODES: { value: Mode; label: string }[] = [
  { value: "cash", label: "Cash to her" },
  { value: "shop", label: "Pay the shop" },
  { value: "rent", label: "Toward rent" },
];
const SRC = sources as Record<string, { title: string; url: string }>;
const DATE = "2026-04-10";
const MAX = 100000;
const ROUTE_PHRASE: Record<Delivery, string> = {
  vendor: "Paying the shop directly",
  item: "Giving the item itself",
  able: "Sending it to her ABLE account",
  cash: "Giving cash",
};

function giftFor(mode: Mode, amount: number): Gift {
  if (mode === "cash") return { id: "hero", date: DATE, amount, delivery: "cash", category: "other", label: "Gift" };
  if (mode === "shop") return { id: "hero", date: DATE, amount, delivery: "vendor", category: "equipment", label: "Wheelchair repair" };
  return { id: "hero", date: DATE, amount, delivery: "vendor", category: "rent", recurring: true, label: "Rent, paid by family each month" };
}

/** The reason in plain words, without the exclusion arithmetic (that is in the technical view). */
function plainReason(r: GiftResult, mode: Mode): string {
  const better = r.checkWithBestRoute > r.checkAfter ? ` ${ROUTE_PHRASE[r.bestRoute]} keeps all ${usd(r.checkWithBestRoute)}.` : "";
  if (r.treatment.kind === "unearned_cash")
    return r.countedAmount > 0 ? `Cash counts as income, so ${usd(r.countedAmount)} of it is counted.${better}` : "Cash counts as income, but a small one-off gift like this is not counted.";
  // The ABLE route has its own line under the figure, so the rent reason stops at the rule.
  if (r.treatment.kind === "ism_shelter" && mode === "rent") return "Rent paid by family counts as help with her housing, so it lowers her check.";
  if (r.treatment.kind === "ism_shelter") return `Help with housing lowers her check.${better}`;
  return "Paid straight to the shop, so it is not counted.";
}

/** True while the guided tour is running: its first stop reads this fragment, so it holds still. */
function tourRunning() {
  try {
    return sessionStorage.getItem(TOUR_KEY) !== null;
  } catch {
    return false;
  }
}

/** The hero's live fragment: the product doing its job, on the page. */
export function GiftChecker() {
  const { prefs } = usePrefs();
  const technical = prefs.mode === "technical";
  const [raw, setRaw] = useState("1000");
  const [mode, setMode] = useState<Mode>("cash");
  const [touched, setTouched] = useState(false);
  const [showRule, setShowRule] = useState(false);

  const typed = parseDollars(raw);
  const amount = Math.min(MAX, typed ?? 0);
  const result: GiftResult = useMemo(() => evaluateGift(giftFor(mode, amount), DEFAULT_PROFILE), [mode, amount]);
  const viaAble = useMemo(() => (mode === "rent" ? evaluateGift({ ...giftFor("rent", amount), delivery: "able" }, DEFAULT_PROFILE) : null), [mode, amount]);

  // Signature move: one pass through the other two states, then it rests on cash, where it began (about 17 seconds).
  // It never loops, waits while the tab is hidden, and does not start for reduced motion or during the guided tour.
  useEffect(() => {
    if (touched) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || tourRunning()) return;
    const order: Mode[] = ["shop", "rent", "cash"];
    let step = 0;
    const t = window.setInterval(() => {
      if (document.hidden) return;
      setMode(order[step]);
      step += 1;
      if (step >= order.length) window.clearInterval(t);
    }, 5600);
    return () => window.clearInterval(t);
  }, [touched]);

  const stop = () => setTouched(true);
  const pay = monthName(result.paymentMonth);
  const inc = monthName(result.incomeMonth);
  const kept = result.checkAfter >= result.checkBaseline;
  // Say what was read when it is not exactly what was typed: "1,000", "1k" or more than the checker's limit.
  const echo = typed === null ? "Type the amount as a number, like 1000" : raw.trim() !== String(amount) ? `Checking ${usd(amount)}` : "";

  return (
    <div className="checker" data-ui onPointerDown={stop} onFocusCapture={stop} aria-label="Gift Checker" role="group">
      <p className="checker-title">Gift Checker</p>

      <label className="checker-field">
        <span className="checker-label">
          <span>Gift amount</span>
          {echo && (
            <span id="checker-echo" className="checker-echo tabular" data-tone={typed === null ? "attention" : undefined}>
              {echo}
            </span>
          )}
        </span>
        <span className="checker-input-wrap">
          <span aria-hidden="true">$</span>
          <input
            inputMode="decimal"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            aria-label="Gift amount in dollars"
            aria-invalid={typed === null || undefined}
            aria-describedby={echo ? "checker-echo" : undefined}
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

      {/* Quiet while it plays on its own; once the visitor touches it, each new answer is read out. */}
      <div className="checker-result" aria-live={touched ? "polite" : "off"}>
        {typed === null ? (
          <p className="checker-wait">Her check shows here once the amount is a number.</p>
        ) : (
          <>
            <p className="checker-verdict">
              <span className="checker-result-label">{kept ? `Her ${pay} check stays` : `Her ${pay} check drops to`}</span>
              {/* Keyed on the route only: a new route replays the entrance, typing a digit does not. */}
              <span key={mode} className="checker-figure tabular" data-kept={kept ? "" : undefined}>
                {usd(result.checkAfter)}
              </span>
            </p>
            {viaAble && (
              <p className="checker-alt tabular">
                Through her ABLE account: <strong>{usd(viaAble.checkAfter)}</strong>
              </p>
            )}
            <p className="checker-note">{technical ? result.explanation.plain : plainReason(result, mode)}</p>
            {result.countedAmount > 0 && (
              <p className="checker-mark">
                <span className="mark-chip tabular">
                  Counted in {inc}, paid in {pay}
                </span>
                <Info id="gift-checker.rma" label="" />
              </p>
            )}
          </>
        )}
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
      {technical && (
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
