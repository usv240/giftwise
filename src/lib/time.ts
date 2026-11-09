/**
 * One calendar for every date Giftwise counts or shows: US Pacific time (America/Los_Angeles).
 *
 * The income month. SSI counts unearned income at the earliest of when it is received, when it is credited to the
 * person's account, and when it is set aside for her use (20 CFR 416.1123(a)); "We determine income monthly and count
 * it the month it is received" (POMS SI 00810.030). Housing paid to a landlord counts in the month she receives the
 * support (SI 00810.030, pointing to SI 00835.360). A gift through Giftwise reaches her side
 * when PayPal captures it: from that moment the money is with the shop, the clinic or her ABLE account. So a payment's
 * income date is the day of its capture, and before a capture, the day the order was made. The rule names no clock;
 * receipt is a day on the calendar where she lives. A gift page does not record a home time zone, so Giftwise keeps one
 * calendar for every page, the one its routing has always priced gifts in: Pacific time. The routing that picks each
 * payee and amount (today()), the receipt, the month's report, its check page, the CSV, Easy Read and the MCP
 * get_ssa_report tool all take a payment's date from incomeDay() here, so a gift is never routed under one month and
 * reported under another, and a gift at 11:30 PM Pacific on a month's last day stays in that month everywhere.
 *
 * Times shown to people use the same zone and one format, with the zone named: "Nov 8, 2026, 5:02 PM PT".
 * Client-safe: no database, no Node APIs.
 */

export const ZONE = "America/Los_Angeles";
/** The zone in words, for sentences. */
export const ZONE_NAME = "Pacific time";
/** The zone after a time: PT covers both standard and daylight time. */
export const ZONE_SHORT = "PT";

const DAY_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

/** The calendar day of an instant in Pacific time, YYYY-MM-DD. */
export function incomeDay(at: Date | string | number): string {
  return DAY_FMT.format(at instanceof Date ? at : new Date(at));
}

/** The income month of an instant, YYYY-MM. */
export const incomeMonth = (at: Date | string | number) => incomeDay(at).slice(0, 7);

/** Today in Pacific time, YYYY-MM-DD: the day the routing prices a gift in. */
export const today = () => incomeDay(new Date());

/** A payment's income date: the day PayPal captured it, or the day the order was made while it is not captured. */
export const paymentDay = (p: { capturedAt: Date | null; createdAt: Date }) => incomeDay(p.capturedAt ?? p.createdAt);

/** A grant's income date: the day PayPal Payouts reported it paid, recorded as the row's last update. */
export const payoutDay = (p: { updatedAt: Date }) => incomeDay(p.updatedAt);

const LOCALE = { en: "en-US", es: "es-US" } as const;
type Lang = keyof typeof LOCALE;
const WHEN_FMT = { en: new Intl.DateTimeFormat(LOCALE.en, { timeZone: ZONE, dateStyle: "medium", timeStyle: "short" }), es: new Intl.DateTimeFormat(LOCALE.es, { timeZone: ZONE, dateStyle: "medium", timeStyle: "short" }) };
const TIME_FMT = new Intl.DateTimeFormat("en-US", { timeZone: ZONE, hour: "numeric", minute: "2-digit" });
const TIME_S_FMT = new Intl.DateTimeFormat("en-US", { timeZone: ZONE, hour: "numeric", minute: "2-digit", second: "2-digit" });
const CLOCK_FMT = new Intl.DateTimeFormat("en-US", { timeZone: ZONE, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

/** An instant for people to read, date and time, zone named: "Nov 8, 2026, 5:02 PM PT". */
export function shownAt(at: Date | string | number, lang: Lang = "en"): string {
  const d = at instanceof Date ? at : new Date(at);
  return `${WHEN_FMT[lang].format(d)} ${ZONE_SHORT}`;
}

/** The time of day alone, zone named: "5:02 PM PT", or with seconds "5:02:13 PM PT". */
export function shownTime(at: Date | string | number, o: { seconds?: boolean } = {}): string {
  const d = at instanceof Date ? at : new Date(at);
  return `${(o.seconds ? TIME_S_FMT : TIME_FMT).format(d)} ${ZONE_SHORT}`;
}

/** A 24-hour clock time in Pacific time, for log rows that name the zone in their heading: "17:02:13". */
export const clockTime = (at: Date | string | number) => CLOCK_FMT.format(at instanceof Date ? at : new Date(at));

/**
 * A calendar day already in Pacific time (YYYY-MM-DD), formatted without moving it to another day: "Nov 8" by default.
 * Read at noon UTC, which is the same day in every US zone.
 */
export function shownDay(iso: string, o: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }, lang: Lang = "en"): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { ...o, timeZone: "UTC" }).format(new Date(`${iso.slice(0, 10)}T12:00:00Z`));
}
