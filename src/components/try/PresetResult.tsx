"use client";

import { getPreset, runPreset } from "@/lib/presets";
import { monthName, usd } from "@/lib/rules";
import { ResultCard } from "../ResultCard";

export function PresetResult({ id }: { id: string }) {
  const p = getPreset(id);
  if (!p) return null;
  const run = runPreset(p);
  if (run.kind === "gift") return <ResultCard result={run.result} title="The result" />;
  return (
    <div className="month-results" data-ui>
      {run.plan.months.map((m) => (
        <div key={m.month}>
          <p className="month-name">
            {monthName(m.month)} gifts, counted for the {monthName(m.paymentMonth)} check
          </p>
          <p className="month-check tabular" data-kept={m.check >= 994 ? "" : undefined}>
            {usd(m.check)}
          </p>
          <p className="month-detail">
            {usd(m.countableIncome)} counted after a {usd(m.infrequentExcluded)} one-off exclusion and the {usd(m.generalExcludedFromUnearned)} general exclusion.
          </p>
        </div>
      ))}
      <ul className="month-gifts">
        {run.plan.gifts.map((r) => (
          <li key={r.gift.id} className="month-gift">
            <span>{r.gift.label}</span>
            <span className="tabular">{usd(r.gift.amount)}</span>
            <span className="month-gift-note">{r.explanation.plain}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
