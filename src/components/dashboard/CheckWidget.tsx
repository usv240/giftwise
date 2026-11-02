"use client";

import type { AgBaseWidgetDefinition, AgDefaultRegistry, AgDefaultWidgetDefinition, AgWidgetDataFormat, AgWidgetFieldReference, AgWidgetParams } from "ag-studio";
import { useEffect, useRef, useState } from "react";
import { CATEGORY_CODE, ROUTE_CODE } from "@/lib/dashboard/labels";
import { DEFAULT_PROFILE, monthName, planMonths, usd, type Category, type Delivery, type Gift } from "@/lib/rules";

/** The Giftwise check widget: runs the rules engine on whatever gifts the dashboard's filters leave in view. */
export interface CheckDef {
  type: "giftwiseCheck";
  dataMapping: {
    date: AgWidgetFieldReference[];
    giver: AgWidgetFieldReference[];
    route: AgWidgetFieldReference[];
    whatFor: AgWidgetFieldReference[];
    amount: AgWidgetFieldReference[];
  };
  format?: AgWidgetDataFormat<Record<string, never>>;
}
/** The default widgets plus the Giftwise check, as AG Studio's registry docs describe. */
export type GiftwiseRegistry = Omit<AgDefaultRegistry, "widgets"> & {
  widgets: readonly (AgBaseWidgetDefinition<"giftwiseCheck", CheckDef> | AgDefaultWidgetDefinition)[];
};

type Result = { lowestRouted: number; lowestCash: number; lowestCashMonth: string; kept: number; months: number; full: number };

const toDate = (v: unknown) => {
  const d = v instanceof Date ? v : new Date(typeof v === "number" ? v : String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

export default function CheckWidget(params: AgWidgetParams<CheckDef>) {
  const { dataMapping, widgetApi } = params;
  const [r, setR] = useState<Result | null>(null);
  // The rows behind the current figures, and the display state last set. Setting a display state makes Studio pass new
  // params, so the widget only changes either one when the data really changed; otherwise the refresh would loop.
  const shown = useRef<{ rows: string; state: string } | null>(null);

  useEffect(() => {
    const date = dataMapping.date?.at(0), giver = dataMapping.giver?.at(0), route = dataMapping.route?.at(0), whatFor = dataMapping.whatFor?.at(0), amount = dataMapping.amount?.at(0);
    const setState = (state: "incompleteDataMapping" | "noData" | "displayed", rows: string) => {
      if (shown.current?.state === state && shown.current.rows === rows) return false;
      shown.current = { rows, state };
      widgetApi.setDisplayState(state);
      return true;
    };
    if (!date || !giver || !route || !whatFor || !amount) {
      setState("incompleteDataMapping", "");
      return;
    }
    let live = true;
    // The data engine runs in the browser, so this is quick enough to run on every refresh without a loading overlay.
    widgetApi.getData({ fields: [date, giver, route, whatFor, amount] }).then((res) => {
      if (!live) return;
      const rows = JSON.stringify(res.results.rows);
      if (shown.current?.rows === rows) return;
      const gifts: Gift[] = [];
      res.results.rows.forEach((row, i) => {
        const d = toDate(row[date.key]);
        const delivery = ROUTE_CODE[String(row[route.key])] as Delivery | undefined;
        const category = CATEGORY_CODE[String(row[whatFor.key])] as Category | undefined;
        const value = Number(row[amount.key]);
        if (d && delivery && category && value > 0) gifts.push({ id: `w${i}`, date: d, amount: value, delivery, category, giver: String(row[giver.key] ?? "") });
      });
      if (gifts.length === 0) {
        setState("noData", rows);
        return;
      }
      const routed = planMonths(gifts, DEFAULT_PROFILE).months;
      const cash = planMonths(gifts.map((g) => ({ ...g, delivery: "cash" as const })), DEFAULT_PROFILE).months;
      const worst = cash.reduce((a, b) => (b.check < a.check ? b : a));
      setR({
        lowestRouted: Math.min(...routed.map((m) => m.check)),
        lowestCash: worst.check,
        lowestCashMonth: monthName(worst.paymentMonth),
        kept: routed.reduce((s, m, i) => s + (m.check - cash[i].check), 0),
        months: routed.length,
        full: Math.max(...routed.map((m) => m.check)),
      });
      setState("displayed", rows);
    });
    return () => {
      live = false;
    };
    // Studio hands the widget a new params object whenever filters or mappings change; its built-in grid refreshes the same way.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  if (!r) return null;
  const whole = r.lowestRouted >= r.full;
  return (
    <div className="gw-check">
      <p className="gw-check-v tabular">{usd(r.lowestRouted)}</p>
      <p className="gw-check-note">{whole ? `Every month, ${r.months} ${r.months === 1 ? "month" : "months"} in view.` : `Lowest month in view.`}</p>
      <p className="gw-check-cash">
        As cash it would have dropped to <strong className="tabular">{usd(r.lowestCash)}</strong> for {r.lowestCashMonth}. Giftwise kept <strong className="tabular">{usd(r.kept)}</strong> in her
        checks.
      </p>
    </div>
  );
}
