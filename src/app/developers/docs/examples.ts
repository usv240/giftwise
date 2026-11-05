/**
 * The "Example request" and "Example response" shown for each endpoint on /developers/docs.
 *
 * Endpoints the rules engine answers on its own (check-gift, plan-month, presets) are computed here when the page is
 * built, with the same mapping their route handlers use, so the example always matches the current rules
 * (tests/docs-examples.test.ts compares them with the handlers). The rest need Claude, the database or live services,
 * so their responses were recorded from the running API (recorded.json).
 */
import { createHash } from "node:crypto";
import sources from "../../../../content/sources.json";
import { today } from "@/lib/api/envelope";
import { ENDPOINTS, type Endpoint } from "@/lib/api/endpoints";
import { openapi } from "@/lib/api/openapi";
import { CheckGiftRequest, PlanMonthRequest } from "@/lib/api/schemas";
import { HOSTED_URL } from "@/lib/origin";
import { getPreset, runPreset } from "@/lib/presets";
import { DEFAULT_PROFILE, RULES_VERSION, evaluateGift, planMonths } from "@/lib/rules";
import recorded from "./recorded.json";

const SRC = sources as Record<string, { title: string; url: string }>;
const HOST = (process.env.RENDER_EXTERNAL_URL || HOSTED_URL).replace(/\/$/, "");
const pretty = (v: unknown) => JSON.stringify(v, null, 2);
const example = (id: string) => ENDPOINTS.find((e) => e.id === id)?.example;

/** The data of POST /api/v1/check-gift, mapped as src/app/api/v1/check-gift/route.ts maps it. */
export function checkGiftData(body: unknown) {
  const { gift, profile } = CheckGiftRequest.parse(body);
  const r = evaluateGift(
    { id: "api", date: gift.date ?? today(), amount: gift.amount, delivery: gift.delivery, category: gift.category, recurring: gift.recurring, giver: gift.giver, label: gift.label },
    { ...DEFAULT_PROFILE, ...profile },
  );
  return {
    check_before: r.checkBaseline,
    check_after: r.checkAfter,
    counted_amount: r.countedAmount,
    income_month: r.incomeMonth,
    payment_month: r.paymentMonth,
    best_route: r.bestRoute,
    check_with_best_route: r.checkWithBestRoute,
    routes: r.alternatives,
    savings_on_next_first: r.resourcesNextFirst,
    over_savings_limit: r.overResourceLimit,
    ambiguous: r.ambiguous,
    ambiguity_reason: r.ambiguityReason ?? null,
    rule_ids: r.ruleIds,
    citations: r.sourceKeys.map((k) => ({ id: k, title: SRC[k]?.title ?? k, url: SRC[k]?.url ?? null })),
    explanation: r.explanation,
    trace: r.trace,
  };
}

/** The data of POST /api/v1/plan-month, mapped as src/app/api/v1/plan-month/route.ts maps it. */
export function planMonthData(body: unknown) {
  const { gifts, profile } = PlanMonthRequest.parse(body);
  const plan = planMonths(
    gifts.map((g, i) => ({ id: `g${i}`, ...g })),
    { ...DEFAULT_PROFILE, ...profile },
  );
  return {
    months: plan.months,
    gifts: plan.gifts.map((r) => ({
      label: r.gift.label ?? null,
      giver: r.gift.giver ?? null,
      amount: r.gift.amount,
      counted_amount: r.countedAmount,
      best_route: r.bestRoute,
      rule_ids: r.ruleIds,
      explanation: r.explanation,
    })),
  };
}

/** The body of GET /api/presets/{id}, built as src/app/api/presets/[id]/route.ts builds it. */
export function presetBody(id: string) {
  const p = getPreset(id);
  if (!p) throw new Error(`No preset ${id}`);
  const run = runPreset(p);
  return {
    preset: p,
    result:
      run.kind === "gift"
        ? { check_after: run.result.checkAfter, best_route: run.result.bestRoute, check_with_best_route: run.result.checkWithBestRoute, rule_ids: run.result.ruleIds, explanation: run.result.explanation }
        : { months: run.plan.months },
    how_to_try: "POST the preset.gift (or each item of preset.gifts) to /api/v1/check-gift, or the gifts array to /api/v1/plan-month.",
  };
}

/** The response envelope from src/lib/api/envelope.ts. The request id is an example in the real format. */
function envelope(id: string, compute: () => unknown) {
  const started = performance.now();
  const data = compute();
  return {
    data,
    meta: {
      request_id: `req_${createHash("sha256").update(`docs:${id}`).digest("hex").slice(0, 20)}`,
      version: openapi("").info.version,
      rules_version: RULES_VERSION,
      latency_ms: Math.max(1, Math.round(performance.now() - started)),
    },
    error: null,
  };
}

export type DocExample = { request: string; response: string; how: "computed" | "recorded"; sampleBill?: string };

const SAMPLE_BILL = "/samples/northside-electric-bill.png";
const PRESET = "electric-bill";
const RECORDED = recorded.responses as Record<string, unknown>;
export const RECORDED_ON = new Date(`${recorded.recorded_at}T12:00:00Z`).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" });

/** The request line for a GET, with the playground's example query values. */
function getLine(e: Endpoint) {
  const q = (e.query ?? []).filter((p) => p.example).map((p) => `${p.name}=${encodeURIComponent(p.example ?? "")}`);
  return `GET ${e.path.replace("{id}", PRESET)}${q.length ? `?${q.join("&")}` : ""}`;
}

/** Every endpoint's example, by endpoint id. */
export function docExamples(): Record<string, DocExample> {
  const out: Record<string, DocExample> = {};
  for (const e of ENDPOINTS) {
    const request = e.upload ? `POST ${e.path}\nContent-Type: multipart/form-data\n\nfile: northside-electric-bill.png` : e.method === "GET" ? getLine(e) : pretty(e.example);
    let body: unknown;
    let how: DocExample["how"] = "computed";
    if (e.id === "check-gift") body = envelope(e.id, () => checkGiftData(example(e.id)));
    else if (e.id === "plan-month") body = envelope(e.id, () => planMonthData(example(e.id)));
    else if (e.id === "presets") body = presetBody(PRESET);
    else if (e.id in RECORDED) {
      body = RECORDED[e.id];
      how = "recorded";
    } else continue;
    // Recorded on a local server: links in the answer point at the address visitors use.
    const response = pretty(body).replaceAll("http://localhost:3200", HOST);
    out[e.id] = { request, response, how, ...(e.upload ? { sampleBill: SAMPLE_BILL } : {}) };
  }
  return out;
}
