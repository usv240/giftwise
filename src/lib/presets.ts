import presets from "../../content/presets/index.json";
import { DEFAULT_PROFILE, evaluateGift, planMonths, type Gift } from "@/lib/rules";

export type Preset = {
  id: string;
  title: string;
  summary: string;
  gift?: Omit<Gift, "id">;
  gifts?: Omit<Gift, "id">[];
  document?: string;
  url?: string;
  expected: Record<string, unknown>;
};

export const PRESETS = presets as Preset[];

export function getPreset(id: string) {
  return PRESETS.find((p) => p.id === id) ?? null;
}

/** The engine's answer for a preset, computed fresh so downloads always match the current rules. */
export function runPreset(p: Preset) {
  if (p.gift) return { kind: "gift" as const, result: evaluateGift({ id: p.id, ...p.gift }, DEFAULT_PROFILE) };
  const gifts = (p.gifts ?? []).map((g, i) => ({ id: `${p.id}-${i}`, ...g }));
  return { kind: "month" as const, plan: planMonths(gifts, DEFAULT_PROFILE) };
}

export function presetCsv(p: Preset) {
  const rows = (p.gifts ?? (p.gift ? [p.gift] : [])).map((g) =>
    [g.date, g.giver ?? "", g.amount, (g.label ?? "").replace(/,/g, " "), g.delivery === "vendor" ? "shop" : g.delivery === "cash" ? "person" : g.delivery, g.category, g.recurring ? "yes" : "no"].join(","),
  );
  return ["date,giver,amount,description,paid_to,category,recurring", ...rows].join("\n") + "\n";
}
