"use client";

import type { AgWidgetDataFormat, AgWidgetFieldReference, AgWidgetParams } from "ag-studio";
import { useEffect, useRef, useState } from "react";
import { ROUTE_CODE } from "@/lib/dashboard/labels";
import { usd, type Delivery } from "@/lib/rules";

/**
 * How the money reached her, as one bar split by route. A Studio chart takes its colors from one palette by series
 * order, and the line chart's second series (the check as cash) owns orange there; this widget colors each route by
 * what it is instead, the same way as the gift page's meter and the benefit calendar: the shop green, her ABLE account
 * blue, the item itself deep blue, and orange only for cash.
 */
export interface RoutesDef {
  type: "giftwiseRoutes";
  dataMapping: {
    route: AgWidgetFieldReference[];
    amount: AgWidgetFieldReference[];
  };
  format?: AgWidgetDataFormat<Record<string, never>>;
}

// The colors live in dashboard.css, keyed by data-route, so the phone list on the page uses the very same ones.
type Row = { label: string; delivery: Delivery | null; amount: number };

export default function RoutesWidget(params: AgWidgetParams<RoutesDef>) {
  const { dataMapping, widgetApi } = params;
  const [rows, setRows] = useState<Row[] | null>(null);
  // As in the check widget: change the display state only when the data really changed, or Studio's refresh would loop.
  const shown = useRef<{ rows: string; state: string } | null>(null);

  useEffect(() => {
    const route = dataMapping.route?.at(0),
      amount = dataMapping.amount?.at(0);
    const setState = (state: "incompleteDataMapping" | "noData" | "displayed", key: string) => {
      if (shown.current?.state === state && shown.current.rows === key) return;
      shown.current = { rows: key, state };
      widgetApi.setDisplayState(state);
    };
    if (!route || !amount) {
      setState("incompleteDataMapping", "");
      return;
    }
    let live = true;
    widgetApi.getData({ fields: [route, amount] }).then((res) => {
      if (!live) return;
      const key = JSON.stringify(res.results.rows);
      if (shown.current?.rows === key) return;
      const next: Row[] = res.results.rows
        .map((row) => {
          const label = String(row[route.key] ?? "");
          return { label, delivery: (ROUTE_CODE[label] as Delivery | undefined) ?? null, amount: Number(row[amount.key]) || 0 };
        })
        .filter((r) => r.amount > 0)
        .sort((a, b) => b.amount - a.amount);
      if (next.length === 0) {
        setState("noData", key);
        return;
      }
      setRows(next);
      setState("displayed", key);
    });
    return () => {
      live = false;
    };
    // Studio hands the widget a new params object whenever filters or mappings change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // Always a DOM node: AG Studio attaches a custom widget only once it has rendered one, and stops waiting after a second.
  return (
    <div className="gw-shell" aria-busy={rows ? undefined : true}>
      {rows && <RoutesBody rows={rows} />}
    </div>
  );
}

function RoutesBody({ rows }: { rows: Row[] }) {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const pct = (n: number) => {
    const p = (n / total) * 100;
    return p > 0 && p < 1 ? "<1%" : `${Math.round(p)}%`;
  };
  return (
    <div className="gw-routes">
      <div className="gw-routes-bar" role="img" aria-label={rows.map((r) => `${r.label}, ${usd(r.amount)}`).join("; ")}>
        {rows.map((r) => (
          <span key={r.label} className="gw-route" data-route={r.delivery ?? undefined} style={{ flexGrow: r.amount }} />
        ))}
      </div>
      <ul className="gw-routes-key">
        {rows.map((r) => (
          <li key={r.label}>
            <span className="gw-route gw-routes-dot" data-route={r.delivery ?? undefined} aria-hidden="true" />
            <span className="gw-routes-name">{r.label}</span>
            <span className="gw-routes-amt tabular">{usd(r.amount)}</span>
            <span className="gw-routes-pct tabular">{pct(r.amount)}</span>
          </li>
        ))}
      </ul>
      {!rows.some((r) => r.delivery === "cash") && <p className="gw-routes-note">None of these gifts reached her as cash.</p>}
    </div>
  );
}
