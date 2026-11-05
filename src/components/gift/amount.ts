import { routeGift, type OpenNeed } from "@/lib/routing";
import type { Profile } from "@/lib/rules";

/** The most one gift can be. The server refuses more (see /api/paypal/gift-orders). */
export const MAX_GIFT = 10000;

export type Typed = { kind: "empty" } | { kind: "invalid" } | { kind: "ok"; value: number };

/**
 * Read the amount a giver typed. "50", "$50", "50.00", "1,000" and "$ 1,000.50" all work. Nothing is clamped or
 * changed: a minus sign, letters, or more than two decimals make it "invalid", so the page can say what to type.
 * Commas count only as thousands separators, so "50,5" is not read as 505.
 */
export function readAmount(raw: string): Typed {
  const s = raw.trim().replace(/^\$/, "").replace(/\s+/g, "");
  if (!s) return { kind: "empty" };
  if (s === "." || !/^(\d{1,3}(,\d{3})+|\d+)?(\.\d{0,2})?$/.test(s)) return { kind: "invalid" };
  const value = Number(s.replace(/,/g, ""));
  return Number.isFinite(value) ? { kind: "ok", value } : { kind: "invalid" };
}

/** The amount as a giver would type it: "50", "1234", "95.50". */
export const asTyped = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

export type Chip = { amount: number; label?: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Suggested amounts: two small ones and two tied to the open needs (the first need, and all of them). A need's chip
 * appears only when the routing really sends that amount to exactly what the chip names, since gifts fill the needs
 * in order. Four chips fit two rows in the 360px card.
 */
export function suggestedAmounts(needs: OpenNeed[], date: string, profile: Profile, ableName: string, allLabel: (n: number) => string): Chip[] {
  const chips: Chip[] = [{ amount: 50 }, { amount: 100 }];
  const open = needs.filter((n) => round2(n.amount - n.funded) > 0);
  const sum = round2(open.reduce((s, n) => s + (n.amount - n.funded), 0));
  if (sum > 0 && sum <= MAX_GIFT) {
    const needLines = routeGift(sum, needs, date, profile, ableName).lines.filter((l) => l.needId !== null);
    const first = needLines[0];
    if (first) {
      const one = routeGift(first.amount, needs, date, profile, ableName);
      const title = open.find((n) => n.id === first.needId)?.title;
      if (title && one.unplaced === 0 && one.lines.length === 1 && one.lines[0].needId === first.needId) chips.push({ amount: first.amount, label: title });
    }
    if (needLines.length > 1 && needLines.length === open.length) {
      const total = round2(needLines.reduce((s, l) => s + l.amount, 0));
      const all = routeGift(total, needs, date, profile, ableName);
      if (all.unplaced === 0 && all.lines.length === needLines.length && all.lines.every((l) => l.needId !== null)) chips.push({ amount: total, label: allLabel(needLines.length) });
    }
  }
  // One chip per amount: a need's chip says more than a bare number, so it wins. Plain amounts come first, smallest
  // first, then the needs' chips, so the short ones share a row on a phone.
  const byAmount = new Map<number, Chip>();
  for (const c of chips) if (!byAmount.get(c.amount)?.label) byAmount.set(c.amount, c);
  return [...byAmount.values()].sort((a, b) => Number(Boolean(a.label)) - Number(Boolean(b.label)) || a.amount - b.amount);
}
