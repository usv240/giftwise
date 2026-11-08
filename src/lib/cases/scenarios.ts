import { POST as createNeedOrder } from "@/app/api/paypal/orders/route";
import { ledgerRows, verifyChain } from "../audit";
import { db, schema } from "../db";
import { getHousehold, payeeEmail } from "../households";
import { captureAndRecord } from "../paypal/capture";
import { paypalRest } from "../paypal/client";
import { routeGift } from "../routing";
import { DEFAULT_PROFILE, evaluateGift, usd } from "../rules";
import { log } from "../log";
import { failureKind } from "../scrub";
import { CASES, type CaseId } from "./list";
import electricReview from "../../../content/reviews/electric-bill.json";
import type { RecordedReview } from "@/components/try/ReviewPanel";
import { referee, routeForDecision, type Review } from "../review/referee";

export type ScenarioResult = {
  id: string;
  title: string;
  expected: string;
  outcome: "handled" | "problem";
  evidence: string[];
  ms: number;
};

const CARD = {
  number: "4012888888881881",
  expiry: "2030-12",
  name: "Joe Ortiz",
  security_code: "123",
};
type Order = {
  id: string;
  status: string;
  purchase_units?: {
    amount?: { value?: string };
    payee?: { email_address?: string };
    payments?: { captures?: { id: string }[] };
  }[];
};

/** A small sandbox order to the shop, recorded like a real one but tied to no household, so the sample page is untouched. */
async function runnerOrder(opts: { paid?: boolean } = {}) {
  const shop = payeeEmail("vendor");
  const res = await paypalRest<Order>("/v2/checkout/orders", {
    method: "POST",
    requestId: `runner-${crypto.randomUUID()}`,
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: "runner",
          description: "Giftwise failure-case check",
          amount: { currency_code: "USD", value: "12.00" },
          payee: { email_address: shop },
        },
      ],
      ...(opts.paid ? { payment_source: { card: CARD } } : {}),
    }),
  });
  if (!res.body.id) throw new Error(`PayPal did not create the order (${res.status})`);
  await db()
    .insert(schema.payments)
    .values({
      orderId: res.body.id,
      referenceId: "runner",
      payeeName: "Riverside Mobility Repair",
      route: "vendor",
      status: opts.paid ? "captured" : "created",
      amount: "12.00",
      payeeEmail: shop,
    });
  return res.body;
}

/** Stand in for the donor's approval in PayPal: attach the sandbox test card to the order. */
const approveWithCard = (id: string) =>
  paypalRest(`/v2/checkout/orders/${id}/confirm-payment-source`, {
    method: "POST",
    body: JSON.stringify({ payment_source: { card: CARD } }),
  });

type Run = Pick<ScenarioResult, "outcome" | "evidence" | "ms">;

async function timed(fn: () => Promise<{ ok: boolean; evidence: string[] }>): Promise<Run> {
  const t = Date.now();
  try {
    const r = await fn();
    return {
      outcome: r.ok ? "handled" : "problem",
      evidence: r.evidence,
      ms: Date.now() - t,
    };
  } catch (e) {
    // The page shows the kind of failure; the full error, which can quote request headers, goes to the masked log.
    log.error("failure case did not finish", { err: e });
    return {
      outcome: "problem",
      evidence: [`The check did not finish (${failureKind(e)}).`],
      ms: Date.now() - t,
    };
  }
}

const RUNS: Record<CaseId, () => Promise<Run>> = {
  declined: () =>
    timed(async () => {
      const o = await runnerOrder();
      await approveWithCard(o.id);
      const r = await captureAndRecord(o.id, { mock: "INSTRUMENT_DECLINED" });
      const ok = r.kind === "declined";
      return {
        ok,
        evidence: [
          `PayPal order ${o.id}, capture answered ${r.kind === "declined" ? `${r.status} ${r.issue}` : r.kind} (sandbox negative testing)`,
          r.kind === "declined" ? `The donor sees: "${r.plain}"` : "No decline message was produced",
          "Payment recorded as declined; the need stays open",
        ],
      };
    }),
  double: () =>
    timed(async () => {
      const o = await runnerOrder();
      await approveWithCard(o.id);
      const [a, b] = await Promise.all([captureAndRecord(o.id), captureAndRecord(o.id)]);
      const third = await captureAndRecord(o.id);
      const ids = [a, b].map((x) => ("captures" in x ? x.captures[0]?.capture_id : null));
      const ok = Boolean(ids[0]) && ids[0] === ids[1] && third.kind === "already";
      return {
        ok,
        evidence: [
          `Two captures at the same moment for order ${o.id} returned ${ids[0] ?? "none"} and ${ids[1] ?? "none"}`,
          "Both used the same PayPal-Request-Id, so PayPal treated them as one",
          `A later retry answered "${third.kind}" without calling PayPal again`,
        ],
      };
    }),
  unapproved: () =>
    timed(async () => {
      const o = await runnerOrder();
      const r = await captureAndRecord(o.id);
      const ok = r.kind === "failed" && r.issue === "ORDER_NOT_APPROVED";
      return {
        ok,
        evidence: [
          `Capture of unapproved order ${o.id}: ${r.kind === "failed" ? `${r.status} ${r.issue}` : r.kind}`,
          r.kind === "failed" ? `The donor sees: "${r.plain}"` : "",
        ].filter(Boolean),
      };
    }),
  tamper: () =>
    timed(async () => {
      const data = await getHousehold("maya");
      const need = data?.needs.find((n) => n.status !== "paid");
      if (!need)
        return {
          ok: true,
          evidence: ["Every sample need is paid; reset the sample page to run this check"],
        };
      const res = await createNeedOrder(
        new Request("http://local/api/paypal/orders", {
          method: "POST",
          body: JSON.stringify({
            needId: need.id,
            amount: 1,
            payeeEmail: "someone-else@example.com",
          }),
        }),
      );
      const j = await res.json();
      const live = await paypalRest<Order>(`/v2/checkout/orders/${j.data.id}`);
      const pu = live.body.purchase_units?.[0];
      const want = (Number(need.amount) - Number(need.funded)).toFixed(2);
      const ok = pu?.amount?.value === want && pu?.payee?.email_address === payeeEmail(need.payeeAccount);
      return {
        ok,
        evidence: [
          `Browser sent amount $1 and a different payee for "${need.title}"`,
          `PayPal order ${j.data.id} has amount $${pu?.amount?.value} (the need's ${usd(Number(want))}) and the shop's own payee account`,
        ],
      };
    }),
  rules: () =>
    timed(async () => {
      const date = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Los_Angeles",
      }).format(new Date());
      const rent = {
        id: 999,
        title: "Rent",
        category: "rent",
        route: "vendor",
        payeeName: "Her landlord",
        payeeAccount: "vendor",
        amount: 800,
        funded: 0,
        recurring: true,
      };
      const direct = evaluateGift(
        {
          id: "rent",
          date,
          amount: 800,
          delivery: "vendor",
          category: "rent",
          recurring: true,
        },
        DEFAULT_PROFILE,
      );
      const plan = routeGift(800, [rent], date);
      const ok = direct.checkAfter < direct.checkBaseline && !plan.lines.some((l) => l.needId === 999) && plan.checkWithRouting === plan.baseline;
      return {
        ok,
        evidence: [
          `Paying $800 rent straight to the landlord would make her check ${usd(direct.checkAfter)} (rule ${direct.ruleIds.join(", ")})`,
          `Giftwise skipped that route and sent ${plan.lines.map((l) => `${usd(l.amount)} to ${l.payeeName}`).join(", ")}; her check stays ${usd(plan.checkWithRouting)}`,
        ],
      };
    }),
  reviewer: () =>
    timed(async () => {
      // The real reviews recorded for the Electric bill example, with the Manual reviewer's answer replaced by a wrong one.
      const real = (electricReview as RecordedReview).data.reviews;
      const toReview = (r: (typeof real)[number]): Review => ({ authority: r.authority, answer: r.answer, passage_id: r.passage_id, quote: r.quote, reason_plain: r.reason.plain, reason_technical: r.reason.technical, confidence: r.confidence });
      const wrong = "Electric bills paid by a family member are never counted as income.";
      const reviews = real.map((r) => (r.authority === "poms" ? { ...toReview(r), answer: "not_shelter" as const, quote: wrong } : toReview(r)));
      const ref = referee(reviews);
      const gift = { id: "electric", date: "2026-04-10", amount: 138, delivery: "vendor" as const, category: "utility" as const, recurring: true };
      const out = routeForDecision(gift, ref.decision);
      const trusted = evaluateGift(gift, DEFAULT_PROFILE).checkAfter;
      const pomsVote = ref.votes.find((v) => v.authority === "poms");
      const ok = pomsVote?.valid === false && ref.decision === "unsure" && out.route === "able" && out.check === 994;
      return {
        ok,
        evidence: [
          `Test answer: the Manual reviewer says the $138 electric bill is not a housing cost, quoting "${wrong}"`,
          `Referee: ${pomsVote?.setAsideReason ?? "accepted"} (${pomsVote?.passage_id})`,
          `Rules engine: send it to her ABLE account, her check stays ${usd(out.check ?? 0)}. Trusting the wrong answer and paying the company would have made it ${usd(trusted)}`,
        ],
      };
    }),
  ledger: () =>
    timed(async () => {
      const rows = await ledgerRows();
      if (rows.length < 3)
        return {
          ok: false,
          evidence: ["The ledger needs at least three entries; make a payment first"],
        };
      const target = rows[Math.floor(rows.length / 2)];
      // A copy in memory only: the stored ledger is never changed.
      const edited = rows.map((r) => (r.id === target.id ? { ...r, detail: { ...(r.detail as object), amount: "1.00" } } : r));
      const before = verifyChain(rows);
      const after = verifyChain(edited);
      const ok = before.ok && !after.ok && after.brokenAt === target.id;
      return {
        ok,
        evidence: [`Stored ledger: ${before.count} entries, all match`, `Copy with entry ${target.id} changed: check stops at entry ${after.ok ? "none" : after.brokenAt}`],
      };
    }),
  refund: () =>
    timed(async () => {
      const o = await runnerOrder({ paid: true });
      const cap = o.purchase_units?.[0]?.payments?.captures?.[0]?.id;
      const r = await paypalRest<{
        details?: { issue?: string }[];
        name?: string;
      }>(`/v2/payments/captures/${cap}/refund`, {
        method: "POST",
        requestId: `refund-${cap}`,
        body: "{}",
      });
      const ok = r.status === 403;
      return {
        ok,
        evidence: [
          `Paid $12.00 to the shop, capture ${cap}`,
          `Giftwise asked PayPal to refund it: ${r.status} ${r.body.details?.[0]?.issue ?? r.body.name ?? ""}`,
          "Refunds come from the shop's own PayPal account, straight back to the donor",
        ],
      };
    }),
};

/** One failure case on its own, so Render Workflows can run each case as a separate task with its own retries. */
export async function runScenario(id: string): Promise<ScenarioResult | null> {
  const s = CASES.find((c) => c.id === id);
  if (!s) return null;
  const r = await RUNS[s.id]();
  return { id: s.id, title: s.title, expected: s.expected, ...r };
}

export async function runScenarios() {
  const out: ScenarioResult[] = [];
  for (const s of CASES) {
    const r = await RUNS[s.id]();
    out.push({ id: s.id, title: s.title, expected: s.expected, ...r });
  }
  return out;
}
