import type { AgDataSourcesDefinition, AgReportState, AgWidgetLayoutState } from "ag-studio";
import type { GiftwiseRegistry } from "./CheckWidget";
import type { GiftRow, MonthRow } from "@/lib/dashboard/data";

// Field ids ("gifts.amount") refer to the data sources below. The canvas is 24 tracks wide.
const at = (xTrack: number, yTrack: number, xSpan: number, ySpan: number): AgWidgetLayoutState => ({ xTrack, yTrack, xSpan, ySpan });
const title = (text: string) => ({ title: { enabled: true, text } });
const sum = (id: string) => ({ id, aggregation: "sum" as const });
const min = (id: string) => ({ id, aggregation: "min" as const });
// Whole dollars, like the rest of the site.
const USD = { format: "currencyFormat" as const, formatOptions: { format: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }) } };
const legend = { style: { theme: { common: { legend: { enabled: true } } } } };

export function studioData(gifts: GiftRow[], months: MonthRow[]): AgDataSourcesDefinition<GiftwiseRegistry> {
  const dates = gifts.map((g) => g.date).sort();
  return {
    sources: [
      {
        id: "gifts",
        data: gifts,
        fields: [
          { id: "date", name: "Date", format: "dateFormat" },
          { id: "giver", name: "Giver", format: "textFormat" },
          { id: "need", name: "For", format: "textFormat" },
          { id: "paidTo", name: "Paid to", format: "textFormat" },
          { id: "route", name: "How it reached her", format: "textFormat" },
          { id: "whatFor", name: "Kind of need", format: "textFormat" },
          { id: "amount", name: "Amount", ...USD },
          { id: "source", name: "Source", format: "textFormat" },
          { id: "delivery", name: "Delivery code", format: "textFormat", hide: true },
          { id: "category", name: "Category code", format: "textFormat", hide: true },
        ],
      },
      {
        id: "months",
        data: months,
        fields: [
          { id: "month", name: "Month of the gifts", format: "dateFormat" },
          { id: "given", name: "Given that month", ...USD },
          { id: "checkWithGiftwise", name: "Her check, with Giftwise", ...USD },
          { id: "checkIfCash", name: "Her check, if it had been cash", ...USD },
          { id: "kept", name: "Kept by Giftwise", ...USD },
        ],
      },
    ],
    relationships: [
      { id: "gifts-calendar", source: { tableId: "gifts", fieldId: "date" }, target: { calendarId: "calendar" } },
      { id: "months-calendar", source: { tableId: "months", fieldId: "month" }, target: { calendarId: "calendar" } },
    ],
    calendars: [
      {
        id: "calendar",
        label: "Calendar",
        range: { from: { type: "date", value: dates[0] }, to: { type: "date", value: dates.at(-1)! } },
        fragments: ["year", "quarter", "month", "week", "day"],
      },
    ],
  };
}

export const initialReport: AgReportState<GiftwiseRegistry> = {
  selectedPageId: "year",
  pages: [
    {
      id: "year",
      widgets: {
        giver: {
          type: "button-filter",
          dataMapping: { value: [{ id: "gifts.giver" }] },
          format: { ...title("Giver"), style: { selection: { type: "single" }, dimensions: { height: 30, minWidth: 64 } } },
        },
        given: { type: "value", dataMapping: { value: [sum("gifts.amount")] }, format: { ...title("Given this year") } },
        kept: { type: "value", dataMapping: { value: [sum("months.kept")] }, format: { ...title("Kept in her checks by Giftwise") } },
        check: {
          type: "giftwiseCheck",
          dataMapping: {
            date: [{ id: "gifts.date" }],
            giver: [{ id: "gifts.giver" }],
            route: [{ id: "gifts.route" }],
            whatFor: [{ id: "gifts.whatFor" }],
            amount: [sum("gifts.amount")],
          },
          format: { ...title("Her SSI check with these gifts, from the rules engine") },
        },
        checks: {
          type: "line-chart",
          dataMapping: { categoryKey: [{ id: "calendar::month" }], valueKey: [min("months.checkWithGiftwise"), min("months.checkIfCash")] },
          format: { ...title("Her check each month: with Giftwise, and if every gift had been cash"), ...legend },
        },
        route: { type: "donut-chart", dataMapping: { categoryKey: [{ id: "gifts.route" }], valueKey: [sum("gifts.amount")] }, format: { ...title("How the money reached her"), ...legend } },
        byNeed: { type: "bar-chart-grouped", dataMapping: { categoryKey: [{ id: "gifts.whatFor" }], valueKey: [sum("gifts.amount")] }, format: { ...title("What it paid for") } },
        list: {
          type: "grid",
          dataMapping: { cols: [{ id: "gifts.date" }, { id: "gifts.giver" }, { id: "gifts.need" }, { id: "gifts.paidTo" }, { id: "gifts.route" }, sum("gifts.amount"), { id: "gifts.source" }] },
          format: { ...title("Every gift") },
        },
      },
      widgetLayout: {
        giver: at(0, 0, 24, 8),
        given: at(0, 8, 6, 9),
        kept: at(6, 8, 6, 9),
        check: at(12, 8, 12, 9),
        checks: at(0, 17, 24, 16),
        route: at(0, 33, 10, 16),
        byNeed: at(10, 33, 14, 16),
        list: at(0, 49, 24, 22),
      },
    },
  ],
  panels: { filters: { collapsed: true }, edit: { collapsed: true } },
};
