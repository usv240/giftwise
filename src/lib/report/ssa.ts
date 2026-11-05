import reporting from "../../../content/reporting.json";
import sources from "../../../content/sources.json";
import {
  RULES,
  RULES_VERSION,
  addMonths,
  classify,
  computeMonth,
  markInfrequency,
  monthName,
  monthOf,
  planMonths,
  pronounWords,
  resourceLimit,
  sourcesFor,
  usd,
  type Category,
  type Delivery,
  type Gift,
  type Profile,
  type Pronoun,
  type TreatmentKind,
} from "@/lib/rules";

/**
 * The monthly report to Social Security, written from the gifts themselves.
 *
 * Every gift through Giftwise was checked by the rules engine before PayPal moved the money, so the engine already
 * knows which gifts change income and which do not. This turns one month of them into what SSI asks for: what to
 * tell SSA by the 10th of the next month (20 CFR 416.714), and the receipts that show the rest were paid straight to
 * a shop or an ABLE account. Pure and client-safe: the page, the API, the MCP tool and the tests all call it.
 */

const SRC = sources as Record<string, { title: string; url: string }>;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Where a gift's proof lives: a PayPal capture, a PayPal Payouts item, or the sample year (no PayPal record). */
export type Evidence =
  | { kind: "paypal_capture"; orderId: string; captureId: string | null }
  | { kind: "paypal_payout"; batchId: string; transactionId: string | null }
  | { kind: "sample" };

export type ReportGift = Gift & { giver: string; need: string; paidTo: string; evidence: Evidence };

export type ReportLine = {
  id: string;
  date: string;
  giver: string;
  need: string;
  paidTo: string;
  amount: number;
  delivery: Delivery;
  category: Category;
  /** "tell" goes to Social Security; "records" is not income, and the receipt is the proof. */
  section: "tell" | "records";
  kind: TreatmentKind;
  what: string;
  why: string;
  ruleIds: string[];
  sources: { id: string; title: string; url: string }[];
  evidence: Evidence;
  /** A plain note when the rules leave room for doubt, for example whether a bill is a utility. */
  flag?: string;
  /** The sentence to say for this gift on the call, for "tell" lines. */
  say?: string;
};

export type DueState = "in_progress" | "open" | "due_soon" | "past";

export type SsaReport = {
  month: string;
  monthLabel: string;
  view: "given" | "cash";
  name: string;
  pronoun: Pronoun;
  due: { date: string; label: string; daysLeft: number; state: DueState };
  status: "nothing_counts" | "report" | "no_gifts";
  headline: string;
  summary: string;
  lines: ReportLine[];
  totals: {
    gifts: number;
    given: number;
    tell: number;
    counted: number;
    /** The check this month's income decides, paid two months later (retrospective monthly accounting). */
    checkMonth: string;
    checkMonthLabel: string;
    check: number;
    fullCheck: number;
    /** The same gifts, had every one been cash. */
    countedIfCash: number;
    checkIfCash: number;
  };
  todo: { id: string; text: string; ruleId?: string }[];
  /** Countable savings on the 1st of the next month, for the gifts as given (null in the cash view). */
  savings: { onDate: string; amount: number; limit: number; over: boolean } | null;
  script: string[];
  how: { phone: string; tty: string; office: string };
  penalty: { amounts: number[]; source: string };
  passages: { id: string; cite: string; text: string; url: string }[];
  months: { month: string; label: string; gifts: number }[];
  rulesVersion: string;
};

const CATEGORY_WORDS: Record<Category, string> = {
  medical: "medical care",
  equipment: "equipment",
  phone: "phone bill",
  internet: "internet bill",
  education: "school costs",
  utility: "utility bill",
  rent: "rent",
  mortgage: "mortgage",
  property_tax: "property tax",
  food: "food",
  clothing: "clothing",
  transport: "transport",
  personal: "personal items",
  event: "event tickets",
  other: "savings",
};

const DATE_FMT = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
const DATE_YEAR_FMT = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const day = (iso: string) => DATE_FMT.format(new Date(`${iso}T12:00:00Z`));
const longDate = (iso: string) => DATE_YEAR_FMT.format(new Date(`${iso}T12:00:00Z`));
export const monthLabel = (month: string) => `${monthName(month)} ${month.slice(0, 4)}`;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
const src = (id: string) => ({ id, title: SRC[id]?.title ?? id, url: SRC[id]?.url ?? "" });

/** When the report for an income month is due: 10 days after the month closes (20 CFR 416.714(a)). */
export function dueFor(month: string, today: string): SsaReport["due"] {
  const date = `${addMonths(month, 1)}-10`;
  const daysLeft = daysBetween(today, date);
  const state: DueState = monthOf(today) <= month ? "in_progress" : daysLeft < 0 ? "past" : daysLeft <= 3 ? "due_soon" : "open";
  return { date, label: longDate(date), daysLeft, state };
}

/** The month whose report matters now: last month while its deadline is still ahead, otherwise this month. */
export function currentReportMonth(today: string, monthsWithGifts: string[]): string {
  const last = addMonths(monthOf(today), -1);
  const candidates = Number(today.slice(8, 10)) <= 10 ? [last, monthOf(today)] : [monthOf(today), last];
  return candidates.find((m) => monthsWithGifts.includes(m)) ?? [...monthsWithGifts].sort().at(-1) ?? last;
}

/** The rule table speaks of "the person"; the report speaks of the household by name and pronoun, every line the same way. */
function personal(text: string, name: string, w: ReturnType<typeof pronounWords>) {
  return text
    .replace(/\bthe person's\b/g, w.poss)
    .replace(/\bgiven to the person\b/g, `given to ${name}`)
    .replace(/\bWhen the person lives\b/g, `When ${name} lives`)
    .replace(/\bthat she receives\b/g, `that ${w.subj} ${w.subj === "they" ? "receive" : "receives"}`);
}

function describeLine(g: Gift & { giver: string; paidTo: string; need: string }, kind: TreatmentKind, ruleIds: string[], name: string, w: ReturnType<typeof pronounWords>) {
  const d = describe(g, kind, ruleIds, name, w.poss);
  return { ...d, why: personal(d.why, name, w) };
}

function describe(g: Gift & { giver: string; paidTo: string; need: string }, kind: TreatmentKind, ruleIds: string[], name: string, poss: string) {
  const words = CATEGORY_WORDS[g.category];
  if (g.delivery === "cash") {
    if (kind === "excluded") {
      return { what: "Cash for school costs", why: RULES["R-EDU-01"].plain, say: `On ${day(g.date)}, ${g.giver} gave me ${usd(g.amount)} in cash for school costs. I have the receipts.` };
    }
    return { what: "Cash gift", why: RULES["R-CASH-01"].plain, say: `On ${day(g.date)}, ${g.giver} gave me ${usd(g.amount)} in cash.` };
  }
  if (kind === "unearned_in_kind") {
    return { what: `${words[0].toUpperCase()}${words.slice(1)} from ${g.giver}`, why: RULES["R-ITEM-02"].plain, say: `On ${day(g.date)}, ${g.giver} gave me ${words} worth ${usd(g.amount)}.` };
  }
  if (kind === "ism_shelter") {
    return {
      what: `${words[0].toUpperCase()}${words.slice(1)} paid by ${g.giver}`,
      why: RULES["R-SHEL-01"].plain,
      say: `On ${day(g.date)}, ${g.giver} paid ${usd(g.amount)} toward my ${words}, straight to ${g.paidTo}.`,
    };
  }
  if (kind === "not_possible") {
    return { what: "Check this gift", why: "The rules engine could not place this gift on a safe route. Ask Social Security how they will count it.", say: `On ${day(g.date)}, ${g.giver} gave ${usd(g.amount)} for my ${words}.` };
  }
  if (g.delivery === "able") return { what: `Deposit to ${poss} ABLE account`, why: RULES["R-ABLE-01"].plain };
  if (g.delivery === "item") return { what: "The item itself", why: RULES["R-ITEM-01"].plain };
  const rule = ruleIds.includes("R-FOOD-01") ? "R-FOOD-01" : ruleIds.includes("R-EDU-01") ? "R-EDU-01" : "R-VEND-01";
  return { what: `Paid straight to ${g.paidTo}`, why: RULES[rule].plain };
}

/** Build one month's report. view "cash" shows the report the same gifts would have needed as cash. */
export function buildReport(o: { name: string; profile: Profile; gifts: ReportGift[]; month: string; today: string; view?: "given" | "cash" }): SsaReport {
  const view = o.view ?? "given";
  const { name, profile, month, today } = o;
  const w = pronounWords(profile.pronoun);
  const asGiven = [...o.gifts].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const asCash = asGiven.map((g) => ({ ...g, delivery: "cash" as const }));
  const gifts = view === "cash" ? asCash : asGiven;

  // The whole history, so the quarterly exclusion and savings carry across months the way SSA counts them.
  const plan = planMonths(gifts, profile).months;
  const cashPlan = planMonths(asCash, profile).months;
  const baseline = computeMonth(month, [], profile);
  const trace = plan.find((m) => m.month === month);
  const cashTrace = cashPlan.find((m) => m.month === month);
  const marked = markInfrequency(gifts) as ReportGift[];

  const lines: ReportLine[] = marked
    .filter((g) => monthOf(g.date) === month)
    .map((g) => {
      const t = classify(g, profile);
      const d = describeLine(g, t.kind, t.ruleIds, name, w);
      const section: ReportLine["section"] = g.delivery === "cash" || t.kind === "ism_shelter" || t.kind === "unearned_in_kind" || t.kind === "not_possible" ? "tell" : "records";
      return {
        id: g.id,
        date: g.date,
        giver: g.giver,
        need: g.need,
        paidTo: view === "cash" ? name : g.paidTo,
        amount: g.amount,
        delivery: g.delivery,
        category: g.category,
        section,
        kind: t.kind,
        what: d.what,
        why: d.why,
        ruleIds: t.ruleIds,
        sources: sourcesFor(t.ruleIds).map(src),
        evidence: view === "cash" ? { kind: "sample" } : g.evidence,
        flag: t.ambiguous ? t.ambiguityReason : undefined,
        say: section === "tell" ? d.say : undefined,
      };
    });

  const tell = lines.filter((l) => l.section === "tell");
  const given = round2(lines.reduce((s, l) => s + l.amount, 0));
  const counted = trace ? round2(trace.countableIncome - baseline.countableIncome) : 0;
  const countedIfCash = cashTrace ? round2(cashTrace.countableIncome - baseline.countableIncome) : 0;
  const checkMonth = addMonths(month, 2);
  const due = dueFor(month, today);
  const label = monthLabel(month);

  const status: SsaReport["status"] = lines.length === 0 ? "no_gifts" : tell.length === 0 ? "nothing_counts" : "report";
  const headline =
    status === "no_gifts"
      ? `No gifts through Giftwise in ${monthName(month)}.`
      : status === "nothing_counts"
        ? "Nothing here counts as income."
        : `${tell.length === 1 ? "One gift" : `${tell.length} gifts`} to tell Social Security about.`;
  const summary =
    status === "no_gifts"
      ? `Giftwise has no gifts for ${name} in ${label}, so there is nothing from Giftwise to report for that month.`
      : status === "nothing_counts"
        ? `${lines.length === 1 ? "The one gift" : `All ${lines.length} gifts`}, ${usd(given)} in all, went straight to a shop or ${w.poss} ABLE account. None of them changes ${w.poss} income, so there is no income change from these gifts to report for ${monthName(month)}. ${w.Poss} ${monthName(checkMonth)} check stays ${usd(trace?.check ?? baseline.check)}.`
        : `${usd(counted)} counts as ${w.poss} income for ${monthName(month)}, so ${w.poss} ${monthName(checkMonth)} check would be ${usd(trace?.check ?? baseline.check)} instead of ${usd(baseline.check)}.`;

  const todo: SsaReport["todo"] = [];
  const housingToAble = lines.filter((l) => l.delivery === "able" && l.ruleIds.includes("R-ABLE-02"));
  if (housingToAble.length) {
    const what = [...new Set(housingToAble.map((l) => l.need.replace(/,.*$/, "").toLowerCase()))].join(" and the ");
    todo.push({
      id: "able-housing",
      text:
        monthOf(today) <= month
          ? `Pay the ${what} from the ABLE account before ${monthName(month)} ends. Money taken out for housing and spent in the same month is not income. If any of it is still not spent on the 1st of the next month, it counts toward savings.`
          : `Check that the ${what} was paid from the ABLE account during ${monthName(month)}. Money taken out for housing and spent in the same month is not income. If any of it is still not spent on the 1st of the next month, it counts toward savings.`,
      ruleId: "R-ABLE-02",
    });
  }
  // Savings only for the gifts as given: the cash view would assume every dollar since January was kept, not spent.
  if (trace && view === "given") {
    const limit = resourceLimit(profile.couple);
    const next = `${monthName(addMonths(month, 1))} 1`;
    todo.push(
      trace.overResourceLimit
        ? { id: "savings", text: `On ${next}, ${w.poss} countable savings would be ${usd(trace.savingsOnNextFirst)}, over the ${usd(limit)} limit. Spending it on something ${w.subj} needs, or moving it to ${w.poss} ABLE account, before the 1st keeps ${w.poss} SSI.`, ruleId: "R-RES-01" }
        : { id: "savings", text: `On ${next}, ${w.poss} countable savings will be ${usd(trace.savingsOnNextFirst)}, under the ${usd(limit)} limit.`, ruleId: "R-RES-01" },
    );
  }
  if (lines.some((l) => l.section === "records")) {
    todo.push({ id: "receipts", text: `Keep the receipts listed above, in “For your records.” Each one shows PayPal paid the shop or ${w.poss} ABLE account, not ${name}. If Social Security asks about help from family, they are the answer.` });
  }

  const script = tell.length
    ? [
        `Hello. My name is ${name}, and I am calling to report changes to my SSI for ${label}.`,
        ...tell.map((l) => l.say ?? ""),
        `Those are all the gifts from family and friends in ${monthName(month)}. I have the receipts if you need them.`,
      ]
    : [];

  const months = [...new Set(asGiven.map((g) => monthOf(g.date)))]
    .sort()
    .reverse()
    .map((m) => ({ month: m, label: monthLabel(m), gifts: asGiven.filter((g) => monthOf(g.date) === m).length }));

  return {
    month,
    monthLabel: label,
    view,
    name,
    pronoun: profile.pronoun ?? "she",
    due,
    status,
    headline,
    summary,
    lines,
    totals: {
      gifts: lines.length,
      given,
      tell: tell.length,
      counted,
      checkMonth,
      checkMonthLabel: monthLabel(checkMonth),
      check: trace?.check ?? baseline.check,
      fullCheck: baseline.check,
      countedIfCash,
      checkIfCash: cashTrace?.check ?? baseline.check,
    },
    todo,
    savings: trace && view === "given" ? { onDate: `${addMonths(month, 1)}-01`, amount: trace.savingsOnNextFirst, limit: resourceLimit(profile.couple), over: trace.overResourceLimit } : null,
    script,
    how: { phone: reporting.phone, tty: reporting.tty, office: "Or visit or write any Social Security office." },
    penalty: { amounts: reporting.penalties, source: "cfr-416-724" },
    passages: reporting.passages.map((p) => ({ id: p.id, cite: p.cite, text: p.text, url: SRC[p.source]?.url ?? "" })),
    months,
    rulesVersion: RULES_VERSION,
  };
}

/** The report as CSV rows, for a spreadsheet or a caseworker. */
export function reportCsv(r: SsaReport): string {
  const esc = (v: string | number) => (typeof v === "number" ? String(v) : /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const evidence = (e: Evidence) => (e.kind === "paypal_capture" ? `PayPal capture ${e.captureId ?? `order ${e.orderId}`}` : e.kind === "paypal_payout" ? `PayPal Payouts ${e.transactionId ?? e.batchId}` : "Sample year");
  const head = ["date", "from", "for", "paid_to", "amount", "tell_ssa", "how_it_counts", "rule_ids", "evidence"];
  const rows = r.lines.map((l) => [l.date, l.giver, l.need, l.paidTo, l.amount, l.section === "tell" ? "yes" : "no", l.why, l.ruleIds.join(" "), evidence(l.evidence)].map(esc).join(","));
  return [head.join(","), ...rows].join("\n") + "\n";
}

const snake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toSnake = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(toSnake) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [snake(k), toSnake(x)])) : v;

/** The report in the API's snake_case shape, for /api/v1/ssa-report and the MCP tool. */
export const reportJson = (r: SsaReport) => toSnake(r) as Record<string, unknown>;
