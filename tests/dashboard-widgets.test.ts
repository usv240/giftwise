import { createElement, type FunctionComponent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import sample from "../content/sample-year.json";
import CheckWidget from "@/components/dashboard/CheckWidget";
import RoutesWidget from "@/components/dashboard/RoutesWidget";
import { checkFigures, giftsFromRows } from "@/lib/dashboard/check";
import { CATEGORY_LABEL, ROUTE_LABEL } from "@/lib/dashboard/labels";
import { type Category, type Delivery, type Gift } from "@/lib/rules";

type S = { date: string; giver: string; delivery: Delivery; category: Category; amount: number };
const gifts: Gift[] = (sample.gifts as S[]).map((g, i) => ({ id: `s${i}`, date: g.date, amount: g.amount, delivery: g.delivery, category: g.category, giver: g.giver }));
// The rows AG Studio hands the widget: the dashboard's labels, not the rules engine's codes, keyed by field id.
const KEYS = { date: "gifts.date", giver: "gifts.giver", route: "gifts.route", whatFor: "gifts.whatFor", amount: "gifts.amount" };
const rowsFor = (gs: Gift[]) => gs.map((g) => ({ [KEYS.date]: new Date(g.date), [KEYS.giver]: g.giver, [KEYS.route]: ROUTE_LABEL[g.delivery], [KEYS.whatFor]: CATEGORY_LABEL[g.category], [KEYS.amount]: g.amount }));

// A widget rendered with its mapping complete and its data still on the way: what Studio sees during the first paint.
const field = (id: string) => ({ id, key: id, fieldId: id });
const pending = { getData: () => new Promise(() => {}), setDisplayState: () => {} };
const firstPaint = (comp: (params: never) => React.JSX.Element, dataMapping: Record<string, unknown[]>) =>
  renderToStaticMarkup(createElement(comp as unknown as FunctionComponent, { dataMapping, widgetApi: pending } as never));

describe("dashboard widgets in AG Studio", () => {
  // ag-studio-react attaches a custom widget to the page only once the component has rendered a DOM node, and stops
  // waiting after one second. A widget that returned null until its data arrived was never attached when the data
  // engine took longer than that, and the card stayed empty for good.
  it("render a DOM node before their data arrives, so Studio can attach them whatever the data engine's speed", () => {
    const check = firstPaint(CheckWidget, { date: [field("gifts.date")], giver: [field("gifts.giver")], route: [field("gifts.route")], whatFor: [field("gifts.whatFor")], amount: [field("gifts.amount")] });
    expect(check).toMatch(/^<div class="gw-shell" aria-busy="true"><\/div>$/);
    const routes = firstPaint(RoutesWidget, { route: [field("gifts.route")], amount: [field("gifts.amount")] });
    expect(routes).toMatch(/^<div class="gw-shell" aria-busy="true"><\/div>$/);
  });

  it("maps every label the table shows back to a code the rules engine accepts, and drops a row it cannot map", () => {
    const back = giftsFromRows(rowsFor(gifts), KEYS);
    expect(back.map((g) => [g.date, g.delivery, g.category, g.amount])).toEqual(gifts.map((g) => [g.date, g.delivery, g.category, g.amount]));
    const stale = giftsFromRows([{ ...rowsFor(gifts)[0], [KEYS.route]: "Paid to the vendor" }, { ...rowsFor(gifts)[1], [KEYS.whatFor]: "Medicine" }, { ...rowsFor(gifts)[2], [KEYS.amount]: 0 }], KEYS);
    expect(stale).toEqual([]);
  });

  it("shows the sample year as the rules engine computes it: the full check every month, and a month at $0 as cash", () => {
    const f = checkFigures(gifts)!;
    expect(f.months).toBe(10);
    expect(f.whole).toBe(true);
    expect(f.lowestRouted).toBe(994);
    expect(f.years).toEqual(["2026"]);
    expect(f.lowestCash).toBe(0);
    expect(f.lowestCashMonth).toMatch(/^[A-Z][a-z]+ 2026$/);
    expect(f.kept).toBeGreaterThan(0);
    expect(checkFigures([])).toBeNull();
  });

  it("reruns on just one giver's gifts when the dashboard is filtered", () => {
    const dan = gifts.filter((g) => g.giver === "Dan");
    expect(dan.length).toBeGreaterThan(0);
    const f = checkFigures(dan)!;
    expect(f.months).toBe(5);
    expect(f.months).toBeLessThan(checkFigures(gifts)!.months);
  });
});
