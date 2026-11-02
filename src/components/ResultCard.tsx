"use client";

import sources from "../../content/sources.json";
import { monthName, usd, type GiftResult } from "@/lib/rules";
import { Info } from "./Info";
import { usePrefs } from "./prefs";

const SRC = sources as Record<string, { title: string; url: string }>;
const ROUTE_LABEL: Record<string, string> = {
  vendor: "Pay the shop directly",
  item: "Give the item itself",
  able: "Send it to her ABLE account",
  cash: "Give cash",
};

/** The receipt-style answer for one gift: her check, the best route, and the rule. */
export function ResultCard({ result, title }: { result: GiftResult; title?: string }) {
  const { prefs } = usePrefs();
  const pay = monthName(result.paymentMonth);
  const better = result.checkWithBestRoute > result.checkAfter;
  return (
    <div className="result-card" data-ui aria-live="polite">
      <div className="result-head">
        <p className="result-title">{title ?? result.gift.label ?? "This gift"}</p>
        <Info id="try.result" label="" />
      </div>
      <div className="result-figures">
        <div>
          <p className="result-k">Her check in {pay}</p>
          <p className="result-v tabular" data-kept={result.checkAfter >= result.checkBaseline ? "" : undefined}>
            {usd(result.checkAfter)}
          </p>
        </div>
        {better && (
          <div>
            <p className="result-k">{ROUTE_LABEL[result.bestRoute]}</p>
            <p className="result-v tabular" data-kept="">
              {usd(result.checkWithBestRoute)}
            </p>
          </div>
        )}
      </div>
      <p className="result-plain">{result.explanation.plain}</p>
      {result.ambiguous && result.ambiguityReason && <p className="result-attention">{result.ambiguityReason}</p>}
      {prefs.mode === "technical" && <p className="result-tech">{result.explanation.technical}</p>}
      <details className="result-rules">
        <summary>The rules behind this</summary>
        <ul>
          {result.sourceKeys.map((k) => (
            <li key={k}>
              <a href={SRC[k]?.url} target="_blank" rel="noreferrer">
                {SRC[k]?.title ?? k}
              </a>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
