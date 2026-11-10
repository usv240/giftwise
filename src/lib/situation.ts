/**
 * The person's own situation on a gift page: the plain questions an organizer answers, mapped to the rules engine's
 * Profile, and back. Every question is optional; a page with none answered keeps the sample situation (one adult on
 * her own, no other income, $1,240 in savings, DEFAULT_PROFILE) and says so. Client-safe: the forms on /start and on
 * the organizer's page run the same mapping and the same engine as the server.
 *
 * The household's `profile` column holds the engine's fields, the pronoun, and `situation`: where the facts came from,
 * when they were saved and which fields were given. Only confirmed answers are ever saved; a letter read to fill them
 * in is not stored.
 */
import { DEFAULT_PROFILE, P, addMonths, checkMonthName, computeMonth, householdSentence, monthOf, pronounWords, usd, type Profile, type Pronoun } from "./rules";

/** The questions, as the organizer answers them. A missing answer keeps the sample situation's value. */
export type Answers = {
  /** Where she lives: her own place (or she pays her share where she lives), or someone else's home, such as a parent's. */
  home?: "own" | "other";
  /** In someone else's home: whether that household gives her all her meals. Unanswered means yes. */
  meals?: boolean;
  /** In someone else's home: the people living there, herself included. */
  householdSize?: number;
  /** In someone else's home: its monthly costs for rent or mortgage, property tax and utilities, not food. */
  householdCosts?: number;
  /** In someone else's home: what she pays toward those costs each month. */
  householdPays?: number;
  /** Social Security (SSDI, retirement, survivor) or other benefits, such as a pension, each month. */
  benefits?: number;
  /** Pay from work each month, before taxes. */
  wages?: number;
  /** Married, and both spouses receive SSI. */
  couple?: boolean;
  /** Savings now: bank accounts and cash, not her ABLE account. */
  savings?: number;
  /** Her disability began before age 46, so she can have an ABLE account. */
  ableEligible?: boolean;
};

export const ANSWER_KEYS = ["home", "meals", "householdSize", "householdCosts", "householdPays", "benefits", "wages", "couple", "savings", "ableEligible"] as const satisfies readonly (keyof Answers)[];

/** The engine's own fields, the only keys a household's profile passes to the rules engine. */
export const PROFILE_KEYS = [
  "pronoun",
  "couple",
  "livesInAnothersHousehold",
  "householdProvidesAllMeals",
  "otherUnearnedMonthly",
  "earnedMonthly",
  "ableEligible",
  "ableBalance",
  "ableContributedThisYear",
  "savings",
  "householdSize",
  "householdCosts",
  "proRataShare",
  "householdPays",
] as const satisfies readonly (keyof Profile)[];

export type ProfileKey = (typeof PROFILE_KEYS)[number];

/** Where a page's facts came from: typed answers, a letter read and confirmed, or a program through the API. */
export type SituationSource = "answers" | "letter" | "api";
export type SituationMeta = { source: SituationSource; saved_at: string; given: ProfileKey[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const money = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : undefined);

/** The engine's fields of a stored profile, nothing else: a page's `situation` note never reaches the rules engine. */
export function profileFields(raw: unknown): Partial<Profile> {
  if (!isObj(raw)) return {};
  const out: Record<string, unknown> = {};
  for (const k of PROFILE_KEYS) if (raw[k] !== undefined && raw[k] !== null) out[k] = raw[k];
  return out as Partial<Profile>;
}

/** The profile a household's stored facts give the rules engine: the sample situation, with the page's own facts over it. */
export function householdProfile(raw: unknown): Profile {
  return { ...DEFAULT_PROFILE, ...profileFields(raw) };
}

/** Where a page's facts came from, or null when the page still uses the sample situation. */
export function householdSituation(raw: unknown): SituationMeta | null {
  const s = isObj(raw) ? raw.situation : null;
  if (!isObj(s) || !["answers", "letter", "api"].includes(String(s.source))) return null;
  const given = Array.isArray(s.given) ? (s.given.filter((k) => (PROFILE_KEYS as readonly string[]).includes(String(k))) as ProfileKey[]) : [];
  return { source: s.source as SituationSource, saved_at: typeof s.saved_at === "string" ? s.saved_at : "", given };
}

/** True when at least one question has an answer. */
export const anyAnswer = (a: Answers) => ANSWER_KEYS.some((k) => a[k] !== undefined);

/**
 * The engine's profile for a set of answers, and which of its fields they gave. Unanswered questions keep the sample
 * situation's value. The follow-ups about someone else's home count only with that answer; her own place clears them.
 */
export function answersToProfile(a: Answers, pronoun?: Pronoun): { profile: Profile; given: ProfileKey[] } {
  const p: Profile = { ...DEFAULT_PROFILE, ...(pronoun ? { pronoun } : {}) };
  const given: ProfileKey[] = [];
  const set = <K extends ProfileKey>(k: K, v: Profile[K] | undefined) => {
    if (v === undefined) return;
    (p as unknown as Record<string, unknown>)[k] = v;
    given.push(k);
  };
  if (a.home === "other") {
    set("livesInAnothersHousehold", true);
    if (typeof a.meals === "boolean") set("householdProvidesAllMeals", a.meals);
    const size = typeof a.householdSize === "number" && Number.isInteger(a.householdSize) && a.householdSize >= 1 && a.householdSize <= 20 ? a.householdSize : undefined;
    set("householdSize", size);
    set("householdCosts", money(a.householdCosts));
    set("householdPays", money(a.householdPays));
  } else if (a.home === "own") {
    set("livesInAnothersHousehold", false);
  }
  set("otherUnearnedMonthly", money(a.benefits));
  set("earnedMonthly", money(a.wages));
  if (typeof a.couple === "boolean") set("couple", a.couple);
  set("savings", money(a.savings));
  if (typeof a.ableEligible === "boolean") set("ableEligible", a.ableEligible);
  return { profile: p, given };
}

/**
 * The answers a stored profile shows in the form again. With `given`, only the fields the organizer gave are shown as
 * answered; without it (the sample page, a page made through the API with a full profile), every field is.
 */
export function profileToAnswers(raw: Partial<Profile>, given?: readonly string[]): Answers {
  const has = (k: ProfileKey) => (given ? given.includes(k) : raw[k] !== undefined);
  const a: Answers = {};
  if (has("livesInAnothersHousehold") && typeof raw.livesInAnothersHousehold === "boolean") a.home = raw.livesInAnothersHousehold ? "other" : "own";
  if (a.home === "other") {
    if (has("householdProvidesAllMeals") && typeof raw.householdProvidesAllMeals === "boolean") a.meals = raw.householdProvidesAllMeals;
    if (has("householdSize") && typeof raw.householdSize === "number") a.householdSize = raw.householdSize;
    if (has("householdCosts") && typeof raw.householdCosts === "number") a.householdCosts = raw.householdCosts;
    if (has("householdPays") && typeof raw.householdPays === "number") a.householdPays = raw.householdPays;
  }
  if (has("otherUnearnedMonthly") && typeof raw.otherUnearnedMonthly === "number") a.benefits = raw.otherUnearnedMonthly;
  if (has("earnedMonthly") && typeof raw.earnedMonthly === "number") a.wages = raw.earnedMonthly;
  if (has("couple") && typeof raw.couple === "boolean") a.couple = raw.couple;
  if (has("savings") && typeof raw.savings === "number") a.savings = raw.savings;
  if (has("ableEligible") && typeof raw.ableEligible === "boolean") a.ableEligible = raw.ableEligible;
  return a;
}

/** The facts a page stores: the engine's fields, the pronoun, and where they came from. */
export function storedProfile(profile: Profile, given: readonly ProfileKey[], source: SituationSource, now = new Date()) {
  return { ...profileFields(profile), situation: { source, saved_at: now.toISOString(), given: [...new Set(given)] } satisfies SituationMeta };
}

/** The facts a page goes back to when its organizer clears its situation: the sample situation, with its pronoun. */
export const sampleProfile = (pronoun?: Pronoun) => ({ ...DEFAULT_PROFILE, ...(pronoun ? { pronoun } : {}) });

/** The check paid two months after `incomeMonth` with no gift, from the engine, with the month it is paid. */
export function checkFor(profile: Profile, incomeMonth: string) {
  const t = computeMonth(incomeMonth, [], profile);
  return { check: t.check, paymentMonth: t.paymentMonth, label: checkMonthName(t.paymentMonth), household: t.household, trace: t };
}

/**
 * Her situation in one plain line: "lives in someone else's home, $600 a month in Social Security or other benefits".
 * With `given`, only the facts the organizer gave are named, so a sample value is never shown as hers; without it
 * (the sample page), every fact is. In Spanish for the gift page's Spanish view.
 */
export function situationLine(profile: Profile, given?: readonly string[], lang: "en" | "es" = "en"): string {
  const w = pronounWords(profile.pronoun);
  const has = (k: ProfileKey) => !given || given.includes(k);
  const es = lang === "es";
  const parts: string[] = [];
  if (has("livesInAnothersHousehold"))
    parts.push(profile.livesInAnothersHousehold ? (es ? "vive en la casa de otra persona" : `${w.lives} in someone else's home`) : es ? "vive en su propio hogar" : `${w.lives} on ${w.poss} own`);
  if (has("couple") && profile.couple) parts.push(es ? "en pareja, y ambos reciben SSI" : "married, and both receive SSI");
  if (has("otherUnearnedMonthly"))
    parts.push(
      profile.otherUnearnedMonthly > 0
        ? es
          ? `${usd(profile.otherUnearnedMonthly)} al mes de Seguro Social u otros beneficios`
          : `${usd(profile.otherUnearnedMonthly)} a month in Social Security or other benefits`
        : es
          ? "sin otros beneficios"
          : "no other benefits",
    );
  if (has("earnedMonthly") && profile.earnedMonthly > 0) parts.push(es ? `${usd(profile.earnedMonthly)} al mes de trabajo` : `${usd(profile.earnedMonthly)} a month from work`);
  if (has("savings")) parts.push(es ? `${usd(profile.savings)} de ahorros` : `${usd(profile.savings)} in savings`);
  if (has("ableEligible") && given && !profile.ableEligible) parts.push(es ? "sin cuenta ABLE" : "no ABLE account");
  return parts.join(", ");
}

/** What living in someone else's home does to her check before any gift, in the engine's words; empty otherwise. */
export function homeLine(profile: Profile, incomeMonth: string): string {
  const c = checkFor(profile, incomeMonth);
  if (!c.household) return "";
  if (c.household.rule === "none") {
    const w = pronounWords(profile.pronoun);
    return `${w.Subj} ${w.pays} ${w.poss} share of the home's costs, so living there does not lower ${w.poss} check.`;
  }
  return householdSentence(c.household, profile, c.paymentMonth);
}

/** One month as YYYY-MM, or null. */
const asMonth = (m: unknown) => (typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : null);

export type LetterCheck = {
  /** The month the letter's payment is for, YYYY-MM, and its name. */
  month: string | null;
  monthLabel: string | null;
  /** The monthly SSI payment the letter states. */
  letterSays: number | null;
  /** The check the rules engine gives for that month from the answers. */
  answersGive: number | null;
  matches: boolean | null;
  plain: string;
};

/**
 * The letter's stated payment against the check the rules engine computes from the answers for the same month: the
 * check paid in month M is set by month M-2's income (retrospective monthly accounting, R-RMA-01). Equal to the cent is
 * a match. A state supplement paid with the federal amount shows as a difference, and the answers stay the organizer's.
 */
export function letterCheck(answers: Answers, letter: { amount: number | null; month: string | null }, pronoun?: Pronoun): LetterCheck {
  const month = asMonth(letter.month);
  const says = typeof letter.amount === "number" && Number.isFinite(letter.amount) ? Math.round(letter.amount * 100) / 100 : null;
  const w = pronounWords(pronoun);
  if (!month || says === null) {
    return {
      month,
      monthLabel: month ? checkMonthName(month) : null,
      letterSays: says,
      answersGive: null,
      matches: null,
      plain: says === null ? "The letter does not state a monthly payment, so there is nothing to compare." : "The letter does not name the month its payment is for, so there is nothing to compare.",
    };
  }
  const { profile } = answersToProfile(answers, pronoun);
  const give = checkFor(profile, addMonths(month, -P.rmaLagMonths)).check;
  const matches = Math.abs(give - says) < 0.005;
  const label = checkMonthName(month);
  return {
    month,
    monthLabel: label,
    letterSays: says,
    answersGive: give,
    matches,
    plain: matches ? `Matches ${w.poss} letter: ${usd(says)} for ${label}.` : `${w.Poss} letter says ${usd(says)} for ${label}; these answers give ${usd(give)}. Check the answers above.`,
  };
}

/** The check for a gift made today, with these answers: the figure the forms show as answers change. */
export function checkToday(answers: Answers, today: string, pronoun?: Pronoun) {
  const { profile } = answersToProfile(answers, pronoun);
  return checkFor(profile, monthOf(today));
}
