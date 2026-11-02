"use client";

import { enableStudioDevValidations, type AgDefaultRegistry, type AgWidgetsConfig } from "ag-studio";
import { AgStudio, AgStudioProvider, createWidgets } from "ag-studio-react";
import { useEffect, useMemo, useState } from "react";
import CheckWidget, { type GiftwiseRegistry } from "./CheckWidget";
import { initialReport, studioData } from "./report";
import { giftwiseTheme } from "./theme";
import type { GiftRow, MonthRow } from "@/lib/dashboard/data";

if (process.env.NODE_ENV !== "production") enableStudioDevValidations();

/** The family dashboard in AG Studio: the sample year plus real gifts, a Giftwise check widget, and the site's theme. */
export default function FamilyStudio({ gifts, months }: { gifts: GiftRow[]; months: MonthRow[] }) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const data = useMemo(() => studioData(gifts, months), [gifts, months]);
  const widgets = useMemo(
    () => (defaults: AgWidgetsConfig<AgDefaultRegistry>) =>
      createWidgets<GiftwiseRegistry>({
        additionalTypes: [
          {
            id: "giftwiseCheck",
            label: "Giftwise check",
            dataMapping: {
              date: { type: "field", supportedRoles: ["temporal"], requires: { cardinality: "one" }, required: true },
              giver: { type: "field", supportedRoles: ["category"], requires: { cardinality: "one" }, required: true },
              route: { type: "field", supportedRoles: ["category"], requires: { cardinality: "one" }, required: true },
              whatFor: { type: "field", supportedRoles: ["category"], requires: { cardinality: "one" }, required: true },
              amount: { type: "field", supportedRoles: ["numeric"], requires: { cardinality: "one" }, required: true },
            },
            form: (params) =>
              params.createDefaults({
                dataMappingItems: [
                  { key: "date", label: "Date" },
                  { key: "giver", label: "Giver" },
                  { key: "route", label: "How it reached her" },
                  { key: "whatFor", label: "Kind of need" },
                  { key: "amount", label: "Amount" },
                ],
              }),
            comp: CheckWidget,
            defaultSize: { width: 420, height: 220 },
            minSize: { width: 260, height: 160 },
            ai: { description: "Runs the Giftwise rules engine on the gifts in view: her SSI check with Giftwise, the lowest it would have been as cash, and the amount kept." },
          },
        ],
        menu: [...defaults.menu, { label: "Giftwise", widgetIds: ["giftwiseCheck"] }],
      }),
    [],
  );

  // Studio reads its light or dark mode from the page; mirror the site's theme switch.
  useEffect(() => {
    const html = document.documentElement;
    const sync = () => html.setAttribute("data-ag-theme-mode", html.dataset.theme === "dark" ? "dark" : "light");
    sync();
    const watch = new MutationObserver(sync);
    watch.observe(html, { attributes: true, attributeFilter: ["data-theme"] });
    return () => watch.disconnect();
  }, []);

  return (
    <div className="fd">
      <div className="fd-bar">
        <p className="muted">{mode === "view" ? "Filter by giver, or switch to editing to build your own view." : "Drag widgets, change fields, or add the Giftwise check from the widget menu."}</p>
        <button type="button" className="btn btn-quiet" onClick={() => setMode((m) => (m === "view" ? "edit" : "view"))} aria-pressed={mode === "edit"}>
          {mode === "view" ? "Edit the dashboard" : "Done editing"}
        </button>
      </div>
      <div className="fd-studio">
        <AgStudioProvider licenseKey={process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY || undefined}>
          <AgStudio<GiftwiseRegistry> style={{ height: "100%", width: "100%" }} data={data} initialState={initialReport} widgets={widgets} mode={mode} theme={giftwiseTheme} />
        </AgStudioProvider>
      </div>
    </div>
  );
}
