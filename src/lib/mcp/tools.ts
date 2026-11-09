import { z } from "zod";
import { aiAvailable } from "@/lib/ai/claude";
import { reviewPayload, runReviewers } from "@/lib/ai/reviewers";
import { today } from "@/lib/api/envelope";
import { CategorySchema, CoversSchema, DeliverySchema } from "@/lib/api/schemas";
import { API_VERSION } from "@/lib/api/version";
import { getHousehold, openNeeds, pageProfile } from "@/lib/households";
import { startRoutedGift } from "@/lib/paypal/gift-order";
import { distinctPayees, routeGift } from "@/lib/routing";
import { giftSubject } from "@/lib/report/data";
import { buildReport, currentReportMonth, reportJson } from "@/lib/report/ssa";
import { easyRead } from "@/lib/report/easy";
import { dbConfigured } from "@/lib/db";
import { monthlyView, startMonthly } from "@/lib/monthly";
import { DEFAULT_PROFILE, evaluateGift, fullCheckByYear, monthOf, pronounWords, sourcesFor, usd, type Profile } from "@/lib/rules";
import sources from "../../../content/sources.json";
import { reportCode, verifyPath } from "../report/verify";
import { findGifts } from "../channel3";
import { askRulebook } from "../rulebook";

/** What a tool returns: plain text for the model, structured data for programs. */
export type ToolResult = { text: string; data?: Record<string, unknown>; isError?: boolean };
type Ctx = { origin: string };
type Tool<S extends z.ZodType> = {
  name: string;
  title: string;
  description: string;
  input: S;
  annotations: { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean };
  /** For a tool that changes something: what it changes, in plain words, for the /agents page. */
  changes?: string;
  run: (input: z.infer<S>, ctx: Ctx) => Promise<ToolResult>;
};
const tool = <S extends z.ZodType>(t: Tool<S>) => t;

const SRC = sources as Record<string, { title: string; url: string }>;
const ROUTE = { vendor: "pay the shop directly", item: "give the item itself", able: "send it to the person's ABLE account", cash: "give cash" } as const;
const slug = z.string().trim().min(1).max(60).describe('The gift page id, the part after /g/ in its address. The sample page is "maya".');

async function page(id: string) {
  const data = await getHousehold(id);
  if (!data) return null;
  const profile: Profile = pageProfile(data);
  return { ...data, profile };
}

export const TOOLS = [
  tool({
    name: "check_gift",
    title: "Check a gift",
    description:
      `Before giving money or paying a bill for someone who receives SSI (Supplemental Security Income), check how the gift changes their monthly check and the benefit-safe way to give it. Cash usually counts as income; paying a shop directly for something other than housing usually does not. Uses the federal SSI amount for the month the check is paid (${fullCheckByYear()} for one person), names that month and year in every answer, and cites the regulation or SSA manual section.`,
    input: z.object({
      amount: z.number().min(0).max(100000).describe("Gift amount in US dollars."),
      delivery: DeliverySchema,
      category: CategorySchema.default("other"),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Date the gift arrives, YYYY-MM-DD. Defaults to today."),
      recurring: z.boolean().optional().describe("True when the same person gives this every month."),
      savings: z.number().min(0).max(1000000).optional().describe("Their countable savings now, in dollars, if known."),
      covers: CoversSchema.optional(),
      payer_co_owns: z.boolean().optional().describe("True when the person paying a housing bill co-owns the home: the payment is not a gift, so each month it covers counts in that month."),
      rent_paid: z
        .number()
        .min(0)
        .max(100000)
        .optional()
        .describe("For rent below market from a landlord who is their parent or child: the monthly rent they pay, with category rent and amount the market rent less that rent."),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    run: async (i) => {
      const r = evaluateGift(
        { id: "mcp", date: i.date ?? today(), amount: i.amount, delivery: i.delivery, category: i.category, recurring: i.recurring, covers: i.covers, payerCoOwns: i.payer_co_owns, rentPaid: i.rent_paid },
        { ...DEFAULT_PROFILE, pronoun: "they", ...(i.savings !== undefined ? { savings: i.savings } : {}) },
      );
      return {
        text: `${r.explanation.plain} Sources: ${r.sourceKeys.map((k) => SRC[k]?.title ?? k).join("; ")}.`,
        data: {
          check_before: r.checkBaseline,
          check_after: r.checkAfter,
          payment_month: r.paymentMonth,
          best_route: r.bestRoute,
          check_with_best_route: r.checkWithBestRoute,
          rule_ids: r.ruleIds,
          sources: sourcesFor(r.ruleIds).map((k) => ({ title: SRC[k]?.title ?? k, url: SRC[k]?.url ?? null })),
        },
      };
    },
  }),
  tool({
    name: "get_gift_page",
    title: "Read a gift page",
    description: "Read a Giftwise gift page: who it is for, what they still need, how much, and who gets paid for each need (a shop, a clinic or their ABLE account). Use it before suggesting a gift.",
    input: z.object({ slug }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    run: async (i, ctx) => {
      const p = await page(i.slug);
      if (!p) return { text: `No gift page named "${i.slug}".`, isError: true };
      const open = openNeeds(p.needs).map((n) => ({ title: n.title, still_needed: Math.max(0, n.amount - n.funded), paid_to: n.payeeName, route: n.route }));
      const list = open.map((n) => `${n.title}: ${usd(n.still_needed)} still needed, paid to ${n.paid_to}`).join("; ");
      return {
        text: `Gift page for ${p.household.name} (${ctx.origin}/g/${p.household.slug}). ${open.length ? `Open needs: ${list}.` : "Every need is covered right now."} Any amount can also go to ${pronounWords(p.profile.pronoun).poss} ABLE account.`,
        data: { name: p.household.name, pronoun: p.profile.pronoun ?? "she", url: `${ctx.origin}/g/${p.household.slug}`, open_needs: open, sample: p.household.isSample },
      };
    },
  }),
  tool({
    name: "ask_rulebook",
    title: "Ask the SSI rulebook",
    description:
      "Answer a question about SSI and gifts from the rule text itself: Elasticsearch finds the passages across the regulations, SSA's operating manual and its worked examples, the answer uses only those passages, and every quote is checked word for word. Use it when a person asks why a gift counts or not.",
    input: z.object({ question: z.string().trim().min(4).max(300).describe("The question, in plain words.") }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    run: async (i) => {
      const a = await askRulebook(i.question);
      const found = a.quotes.filter((q) => q.found);
      const cites = [...new Set(a.retrieval.docs.slice(0, 3).map((d) => d.cite))].join("; ");
      return {
        text: `${a.answer ?? "Passages that match:"} ${found.map((q) => `"${q.quote}" (${q.doc.cite})`).join(" ")}${a.answer ? "" : ` ${cites}.`}`.trim(),
        data: {
          answer: a.answer,
          quotes: a.quotes.map((q) => ({ cite: q.doc.cite, quote: q.quote, found_word_for_word: q.found, url: q.doc.url })),
          passages: a.retrieval.docs.map((d) => ({ cite: d.cite, title: d.title, text: d.text, url: d.url })),
          retrieval: a.retrieval.mode === "elastic" ? "elasticsearch" : "in-app",
        },
      };
    },
  }),
  tool({
    name: "find_gift",
    title: "Find a benefit-safe gift",
    description:
      "Search real products across retailers (Channel3) for something a person on SSI needs, and check each one against the SSI rules for that person: whether buying it straight from the retailer keeps their check whole. Gift cards are flagged, because SSA counts a card that can buy food or shelter like cash. Nothing is bought.",
    input: z.object({
      slug,
      query: z.string().trim().min(2).max(120).describe("What the person needs, in a few words, for example \"wheelchair cushion\"."),
      max_price: z.number().min(1).max(20000).optional().describe("Highest price to show, in US dollars."),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    run: async (i, ctx) => {
      const p = await page(i.slug);
      if (!p) return { text: `No gift page named "${i.slug}".`, isError: true };
      const r = await findGifts(i.query, p.profile, today(), { maxPrice: i.max_price, user: p.household.slug });
      const ok = r.products.filter((x) => x.addable).slice(0, 5);
      const cards = r.products.filter((x) => x.giftCard).length;
      const list = ok.map((x) => `${x.title} (${usd(x.price)} at ${x.domain ?? "a retailer"}): ${x.rule}`).join(" ");
      return {
        text: `${r.mode === "live" ? "From Channel3" : "Sample products (Channel3 is not connected here)"}, for ${p.household.name}: ${ok.length ? list : "nothing that keeps the check whole matched."}${cards ? ` ${cards} gift card${cards === 1 ? " was" : "s were"} left out: SSA counts a card that can buy food or shelter like cash.` : ""} The organizer can add any of these to the page at ${ctx.origin}/g/${p.household.slug}.`,
        data: {
          mode: r.mode,
          query: r.query,
          products: r.products.map((x) => ({ title: x.title, price: x.price, retailer: x.domain, url: x.url, in_stock: x.inStock, category: x.category, gift_card: x.giftCard, keeps_check_whole: x.addable, check_after: x.check, rule: x.rule })),
        },
      };
    },
  }),
  tool({
    name: "plan_gift",
    title: "Plan a gift of any amount",
    description:
      "Show how Giftwise would split a gift of any amount across a gift page's open needs and the person's ABLE account so that none of it lowers their SSI check, compared with giving the same amount as cash. Nothing is paid.",
    input: z.object({ slug, amount: z.number().min(1).max(10000).describe("Total gift in US dollars.") }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    run: async (i) => {
      const p = await page(i.slug);
      if (!p) return { text: `No gift page named "${i.slug}".`, isError: true };
      const plan = routeGift(i.amount, openNeeds(p.needs), today(), p.profile, `${p.household.name}'s ABLE account`);
      const lines = plan.lines.map((l) => ({ paid_to: l.payeeName, for: l.title, amount: l.amount, rule_ids: l.ruleIds }));
      return {
        text: `${usd(i.amount)} for ${p.household.name}: ${lines.map((l) => `${usd(l.amount)} to ${l.paid_to} (${l.for})`).join(", ")}. ${pronounWords(p.profile.pronoun).Poss} check stays ${usd(plan.checkWithRouting)}. Given as cash, it would be ${usd(plan.checkIfCash)}.${plan.unplaced > 0 ? ` ${usd(plan.unplaced)} has no benefit-safe place right now.` : ""}`,
        data: { amount: i.amount, lines, check_with_giftwise: plan.checkWithRouting, check_if_cash: plan.checkIfCash, unplaced: plan.unplaced },
      };
    },
  }),
  tool({
    name: "review_bill",
    title: "Ask the two reviewers about a bill",
    description:
      "Decide whether a bill paid by someone else is a housing cost under SSI rules, which matters because housing paid by others can lower the check. Two reviewers answer independently, one from the federal regulations and the Federal Register, one from SSA's operating manual; each must quote its rulebook word for word, a program checks the quotes, and the rules engine picks the route. Takes about 10 to 20 seconds.",
    input: z.object({
      description: z.string().min(3).max(2000).describe("What the bill is for: the business, the service and any line items."),
      amount: z.number().min(1).max(100000),
      category: CategorySchema,
      recurring: z.boolean().optional(),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    run: async (i) => {
      if (!aiAvailable()) return { text: "The reviewers need the AI service, which is not connected on this server.", isError: true };
      const run = await runReviewers({ description: i.description, gift: { id: "mcp", date: today(), amount: i.amount, delivery: "vendor", category: i.category, recurring: i.recurring } });
      const out = reviewPayload(run);
      const quotes = out.reviews.map((r) => `${r.authority === "regs" ? "Regulations reviewer" : "Manual reviewer"}: ${r.answer}, quoting ${r.cite ?? r.passage_id}${r.quote_checked ? "" : " (quote set aside)"}`).join("; ");
      return {
        text: `${out.referee.summary} ${quotes}. Giftwise would ${out.outcome.route ? ROUTE[out.outcome.route] : "find another way"}; the check stays ${usd(out.outcome.check_after ?? 0)}.`,
        data: out as unknown as Record<string, unknown>,
      };
    },
  }),
  tool({
    name: "get_ssa_report",
    title: "Write the monthly report to Social Security",
    description:
      "Writes one month's report to Social Security for a Giftwise gift page, from the gifts themselves: which gifts to tell SSA about, what counts, the check it decides, and the PayPal record that shows every other gift went straight to a shop or the ABLE account. People on SSI tell Social Security about changes in income, including help from friends and family, within 10 days after the month ends. Read-only; it never contacts Social Security.",
    input: z.object({
      slug,
      month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional().describe("Income month, YYYY-MM. Defaults to the month whose report is due next."),
      view: z.enum(["given", "cash"]).default("given").describe('"given" for the gifts as they were made; "cash" for the report the same gifts would have needed as cash.'),
      reader: z.enum(["helper", "person"]).default("helper").describe('"helper" for the full report a family member or counselor reads; "person" for the Easy Read version written to the person on SSI, one short sentence per idea.'),
      lang: z.enum(["en", "es"]).default("en").describe('Language of the Easy Read version: "en" or "es". The full report is in English.'),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    run: async (i, ctx) => {
      const s = await giftSubject(i.slug);
      if (!s) return { text: `No gift page named "${i.slug}".`, isError: true };
      const now = today();
      const months = [...new Set(s.gifts.map((g) => monthOf(g.date)))];
      const r = buildReport({ name: s.name, profile: s.profile, gifts: s.gifts, month: i.month ?? currentReportMonth(now, months), today: now, view: i.view });
      const tell = r.lines.filter((l) => l.section === "tell");
      if (i.reader === "person") {
        const e = easyRead(r, i.lang);
        const sentences = [e.whatIf, ...e.answer.map((l) => l.text), ...e.sections.flatMap((x) => [x.title + ":", ...x.lines.map((l) => l.text)])].filter(Boolean);
        return {
          text: `${e.title}. ${sentences.join(" ")}${e.script.length ? ` ${e.ui.say}: ${e.script.join(" ")}` : ""} ${ctx.origin}/g/${s.slug}/report/easy?month=${r.month}${i.lang === "es" ? "&lang=es" : ""}${r.view === "cash" ? "&view=cash" : ""}`,
          data: e as unknown as Record<string, unknown>,
        };
      }
      const code = r.view === "given" && r.status !== "no_gifts" ? reportCode(s.slug, r) : null;
      const verify = code ? { code, url: `${ctx.origin}${verifyPath(s.slug, r.month, code)}` } : null;
      return {
        text: `${r.name}'s report for ${r.monthLabel}, due ${r.due.label}: ${r.headline} ${r.summary}${tell.length ? ` To tell SSA: ${tell.map((l) => l.say).join(" ")}` : ""} Call ${r.how.phone} (TTY ${r.how.tty}) or visit any Social Security office. Full report: ${ctx.origin}/g/${s.slug}/report?month=${r.month}${r.view === "cash" ? "&view=cash" : ""}.${verify ? ` Anyone can check it against PayPal's records: ${verify.url} (code ${verify.code}).` : ""}`,
        data: { ...reportJson(r), verify },
      };
    },
  }),
  tool({
    name: "start_gift_checkout",
    title: "Start a PayPal checkout for a gift",
    description:
      "Create a PayPal checkout that pays every recipient of a gift directly (the shops and the ABLE account), split by the rules so the SSI check stays whole. Returns a PayPal link for the person giving to open and approve. Nothing is charged until that person approves in PayPal; never approve on their behalf. This build uses the PayPal sandbox, so no real money moves.",
    input: z.object({ slug, amount: z.number().min(1).max(10000).describe("Total gift in US dollars.") }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    changes: "Creates a sandbox order; nothing is charged until the giver approves",
    run: async (i, ctx) => {
      const r = await startRoutedGift(i.slug, i.amount, { actor: "agent", redirect: { returnUrl: `${ctx.origin}/api/paypal/return`, cancelUrl: `${ctx.origin}/g/${i.slug}` } });
      if (!r.ok) return { text: r.message, isError: true };
      return {
        text: `PayPal checkout ready for ${usd(r.plan.amount)} to ${r.name}, paid to ${distinctPayees(r.plan.lines).length} ${distinctPayees(r.plan.lines).length === 1 ? "recipient" : "recipients"}. The person giving should open this link and approve in PayPal: ${r.approveUrl}. After they approve, the receipt will be at ${ctx.origin}/r/${r.orderId}.`,
        data: { order_id: r.orderId, approve_url: r.approveUrl, receipt_url: `${ctx.origin}/r/${r.orderId}`, lines: r.plan.lines.map((l) => ({ paid_to: l.payeeName, for: l.title, amount: l.amount })), check_with_giftwise: r.plan.checkWithRouting },
      };
    },
  }),
  tool({
    name: "start_monthly_gift",
    title: "Set up a monthly gift",
    description:
      "Set up the same gift every month for someone with a Giftwise page. Each month the rules route it again for that month's needs (recurring bills come back, paid-off needs drop away) and say what changed. Returns the giver's own page, where they approve each month in PayPal. Nothing is charged by this call or by Giftwise on its own; never approve on the giver's behalf. Sandbox only.",
    input: z.object({
      slug,
      amount: z.number().min(1).max(10000).describe("The gift each month, in US dollars."),
      giver_name: z.string().trim().max(60).optional().describe("The giver's first name, shown on their page."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    changes: "Saves a monthly plan; nothing is charged until the giver approves each month",
    run: async (i, ctx) => {
      if (!dbConfigured()) return { text: "Monthly gifts need the database, which is not connected here.", isError: true };
      const started = await startMonthly({ slug: i.slug, amount: i.amount, giverName: i.giver_name, month: monthOf(today()) });
      if (!started) return { text: `No gift page named "${i.slug}".`, isError: true };
      const v = await monthlyView(started.token, today());
      const month = v?.runs[0];
      const url = `${ctx.origin}/m/${started.token}`;
      if (!v || !month) return { text: `Monthly gift set up. The giver's page: ${url}`, data: { url } };
      const w = pronounWords(v.household.profile.pronoun);
      const split = month.plan.lines.map((l) => `${usd(l.amount)} to ${l.payeeName} (${l.title})`).join("; ");
      return {
        text: `Monthly gift of ${usd(v.amount)} to ${v.household.name} set up. ${month.label}: ${split}. ${w.Poss} check stays ${usd(month.plan.checkWithRouting)}; as cash it would be ${usd(month.plan.checkIfCash)}. Each month the rules route it again, and the giver approves it in PayPal on their own page: ${url}. Nothing is charged until they do.`,
        data: { url, amount: v.amount, month: month.month, lines: month.plan.lines.map((l) => ({ paid_to: l.payeeName, for: l.title, amount: l.amount })), check_with_giftwise: month.plan.checkWithRouting, check_if_cash: month.plan.checkIfCash },
      };
    },
  }),
];

/** A tool's one-line summary, as /llms.txt lists it: the first sentence of its description, which says what it does. */
export const toolSummary = (t: { description: string }) => `${t.description.split(". ")[0].replace(/\.$/, "")}.`;

export const SERVER_INFO = { name: "giftwise", title: "Giftwise", version: API_VERSION };
export const INSTRUCTIONS =
  "Giftwise helps people give to someone who receives SSI without lowering their monthly check. Call check_gift before suggesting cash. To give to a person with a Giftwise page, read it with get_gift_page, show the split with plan_gift, and start_gift_checkout returns a PayPal link the giver approves themselves; start_monthly_gift sets up the same gift every month, approved by the giver each month. For the person receiving SSI, get_ssa_report writes the month's report to Social Security from the gifts, in Easy Read or Spanish with reader \"person\". Sandbox only.";
