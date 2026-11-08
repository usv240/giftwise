import { DEFAULT_PROFILE, type Gift, type Profile } from "./rules";

/**
 * The home page's Gift Checker, as data: the same profile and the same date as Maya's gift page, so its "Her January
 * check" and the gift page's are one engine answer. tests/checker.test.ts holds the two together.
 */
export type CheckerMode = "cash" | "shop" | "rent";

/** Maya's situation, as the sample household's profile has it: one adult on her own, no other income. */
export const CHECKER_PROFILE: Profile = DEFAULT_PROFILE;

export function checkerGift(mode: CheckerMode, amount: number, date: string): Gift {
  if (mode === "cash") return { id: "hero", date, amount, delivery: "cash", category: "other", label: "Gift" };
  if (mode === "shop") return { id: "hero", date, amount, delivery: "vendor", category: "equipment", label: "Wheelchair repair" };
  return { id: "hero", date, amount, delivery: "vendor", category: "rent", recurring: true, label: "Rent, paid by family each month" };
}
