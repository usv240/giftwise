"use client";

import type { AgBaseWidgetDefinition, AgDefaultRegistry, AgDefaultWidgetDefinition, AgWidgetDataFormat, AgWidgetFieldReference, AgWidgetParams } from "ag-studio";
import { useEffect, useRef, useState } from "react";
import type { RoutesDef } from "./RoutesWidget";
import { checkFigures, giftsFromRows, type CheckFigures } from "@/lib/dashboard/check";
import { usd } from "@/lib/rules";

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
/** The default widgets plus the Giftwise check and the routes bar, as AG Studio's registry docs describe. */
export type GiftwiseRegistry = Omit<AgDefaultRegistry, "widgets"> & {
  widgets: readonly (AgBaseWidgetDefinition<"giftwiseCheck", CheckDef> | AgBaseWidgetDefinition<"giftwiseRoutes", RoutesDef> | AgDefaultWidgetDefinition)[];
};

export default function CheckWidget(params: AgWidgetParams<CheckDef>) {
  const { dataMapping, widgetApi } = params;
  const [r, setR] = useState<CheckFigures | null>(null);
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
      const figures = checkFigures(giftsFromRows(res.results.rows, { date: date.key, giver: giver.key, route: route.key, whatFor: whatFor.key, amount: amount.key }));
      if (!figures) {
        setState("noData", rows);
        return;
      }
      setR(figures);
      setState("displayed", rows);
    });
    return () => {
      live = false;
    };
    // Studio hands the widget a new params object whenever filters or mappings change; its built-in grid refreshes the same way.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // The shell is always rendered. AG Studio's React wrapper waits for a custom widget's first DOM node before it attaches
  // the widget to the page, and gives up after one second; a widget that renders nothing until its data arrives is never
  // attached when the data engine takes longer than that, and the card stays empty for good.
  return (
    <div className="gw-shell" aria-busy={r ? undefined : true}>
      {r && (
        <div className="gw-check">
          <p className="gw-check-v tabular">{usd(r.lowestRouted)}</p>
          <p className="gw-check-note">{r.whole ? `Every month, ${r.months} ${r.months === 1 ? "month" : "months"} in view: the full ${r.years.join(" and ")} check.` : `Lowest month in view.`}</p>
          <p className="gw-check-cash">
            As cash, her {r.lowestCashMonth} check would have dropped to <strong className="tabular">{usd(r.lowestCash)}</strong>. Giftwise kept <strong className="tabular">{usd(r.kept)}</strong> in her
            checks, against the same gifts as cash.
          </p>
        </div>
      )}
    </div>
  );
}
