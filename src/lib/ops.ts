import { sql } from "drizzle-orm";
import { AI_DAILY_CAP_USD } from "./ai/claude";
import { latestRun, type CheckRun } from "./checks";
import { db, dbConfigured } from "./db";
import { runChecks, type Check } from "./health";
import { rowsOf } from "./rate-limit";

/**
 * Everything the public operations page shows, read from tables the app already writes: the request log, the audit
 * ledger, payments and payouts, AI usage and the outside checks. Nothing here carries a name, a payee, a key or an
 * address; ids are shortened before they leave.
 */

const q = <T>(s: ReturnType<typeof sql>) => db().execute(s).then((r) => rowsOf<T>(r));
const n = (v: unknown) => Number(v ?? 0);

/** An id with its middle cut out: order:5AB…X8K. Enough to recognize, never enough to look up. */
export function shortId(ref: string) {
  const i = ref.indexOf(":");
  const [kind, id] = i > 0 ? [ref.slice(0, i), ref.slice(i + 1)] : ["", ref];
  const short = id.length > 10 ? `${id.slice(0, 4)}…${id.slice(-3)}` : id.length > 6 ? `${id.slice(0, 3)}…${id.slice(-2)}` : id;
  return kind ? `${kind}:${short}` : short;
}

export type RouteStat = { route: string; requests: number; p50: number; p95: number; errors: number; refused: number; errorRate: number };
export type Counts = Record<string, number>;

/** PayPal's and Giftwise's status words folded into five plain ones: planned, paid, waiting, returned, failed. */
export function foldStatus(s: string) {
  const u = s.toUpperCase();
  if (u === "CREATED") return "planned";
  if (u === "PENDING" || u === "ONHOLD" || u === "UNCLAIMED") return "waiting";
  if (u === "CAPTURED" || u === "SUCCESS") return "paid";
  if (u === "REFUNDED" || u === "RETURNED" || u === "REVERSED") return "returned";
  return "failed";
}

/**
 * The payments the outside checks make on purpose (src/lib/cases/scenarios.ts): $12 test orders with reference "runner"
 * and no gift page. Each run declines a test card, tries a capture before approval, and pays two (the double-click and
 * refund checks), so "failed" here is the checks working.
 */
export type CheckPayments = { declined: number; refused: number; paid: number; other: number };

export function checkPaymentsOf(rows: { status: string; n: number }[]): CheckPayments {
  const out: CheckPayments = { declined: 0, refused: 0, paid: 0, other: 0 };
  for (const r of rows) {
    const s = r.status.toLowerCase();
    if (s === "declined") out.declined += r.n;
    else if (s === "failed") out.refused += r.n;
    else if (s === "captured" || s === "refunded") out.paid += r.n;
    else out.other += r.n;
  }
  return out;
}

/** One plain sentence for the outside checks' test payments; empty when there were none. */
export function describeCheckPayments(c: CheckPayments) {
  const total = c.declined + c.refused + c.paid + c.other;
  if (!total) return "";
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  const parts = [
    c.declined ? n(c.declined, "test card declined on purpose (the declined-card check)", "test cards declined on purpose (the declined-card check)") : "",
    c.refused ? n(c.refused, "capture refused because the giver had not approved yet (the unapproved-order check)", "captures refused because the giver had not approved yet (the unapproved-order check)") : "",
    c.paid ? n(c.paid, "test order of $12 paid (the double-click and refund checks)", "test orders of $12 paid (the double-click and refund checks)") : "",
    c.other ? n(c.other, "test order started", "test orders started") : "",
  ].filter(Boolean);
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
  return `Not counted above: ${n(total, "test payment", "test payments")} the outside checks made in the sandbox: ${list}.`;
}

export async function rightNow() {
  const checks: Check[] = await runChecks();
  if (!dbConfigured()) return { checks, aiToday: 0, aiCap: AI_DAILY_CAP_USD, aiCallsToday: 0, lastHour: 0, lastHourErrors: 0 };
  const [[ai], [hour]] = await Promise.all([
    q<{ cost: string; calls: string }>(sql`select coalesce(sum(cost_usd), 0) as cost, count(*) as calls from ai_usage where created_at >= (date_trunc('day', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles')`),
    q<{ n: string; errors: string }>(sql`select count(*) as n, count(*) filter (where status >= 500) as errors from request_log where created_at >= now() - interval '1 hour'`),
  ]);
  return { checks, aiToday: n(ai?.cost), aiCap: AI_DAILY_CAP_USD, aiCallsToday: n(ai?.calls), lastHour: n(hour?.n), lastHourErrors: n(hour?.errors) };
}

export async function lastDay() {
  if (!dbConfigured()) return { routes: [] as RouteStat[], payments: {} as Counts, checkPayments: checkPaymentsOf([]), webhooks: { received: 0, handledOnce: 0, duplicates: 0, unverified: 0 }, ai: [] as { route: string; calls: number; inputTokens: number; outputTokens: number; cost: number; replayed: number }[] };
  const [routes, pay, payouts, hooks, ai] = await Promise.all([
    q<{ route: string; n: string; p50: string; p95: string; errors: string; refused: string }>(sql`
      select route, count(*) as n,
        percentile_cont(0.5) within group (order by ms) as p50,
        percentile_cont(0.95) within group (order by ms) as p95,
        count(*) filter (where status >= 500) as errors,
        count(*) filter (where status >= 400 and status < 500) as refused
      from request_log where created_at >= now() - interval '24 hours'
      group by route order by n desc`),
    // A gift has a page; the outside checks' $12 test orders carry reference "runner" and none.
    q<{ status: string; test: boolean; n: string }>(sql`select status, (reference_id = 'runner' and household_id is null) as test, count(*) as n from payments where created_at >= now() - interval '24 hours' group by 1, 2`),
    q<{ status: string; n: string }>(sql`select status, count(*) as n from payouts where updated_at >= now() - interval '24 hours' group by status`),
    q<{ received: string; distinct_events: string; unverified: string }>(sql`
      select count(*) filter (where action like 'paypal.webhook.%' and action <> 'paypal.webhook.unverified') as received,
        count(distinct detail->>'eventId') filter (where action like 'paypal.webhook.%' and action <> 'paypal.webhook.unverified') as distinct_events,
        count(*) filter (where action = 'paypal.webhook.unverified') as unverified
      from audit_events where at >= now() - interval '24 hours'`),
    q<{ route: string; calls: string; input_tokens: string; output_tokens: string; cost: string; replayed: string }>(sql`
      select route, count(*) as calls, sum(input_tokens) as input_tokens, sum(output_tokens) as output_tokens, sum(cost_usd) as cost, count(*) filter (where replayed) as replayed
      from ai_usage where created_at >= now() - interval '24 hours' group by route order by cost desc`),
  ]);
  // Gifts and payout items by status, with PayPal's words folded into five plain ones; the checks' test orders on their own.
  const payments: Counts = { planned: 0, paid: 0, waiting: 0, returned: 0, failed: 0 };
  for (const r of [...pay.filter((p) => !p.test), ...payouts]) payments[foldStatus(r.status)] += n(r.n);
  const checkPayments = checkPaymentsOf(pay.filter((p) => p.test).map((p) => ({ status: p.status, n: n(p.n) })));
  const h = hooks[0];
  const received = n(h?.received);
  const handledOnce = n(h?.distinct_events);
  return {
    routes: routes.map((r) => ({ route: r.route, requests: n(r.n), p50: Math.round(n(r.p50)), p95: Math.round(n(r.p95)), errors: n(r.errors), refused: n(r.refused), errorRate: n(r.n) ? n(r.errors) / n(r.n) : 0 })),
    payments,
    checkPayments,
    webhooks: { received, handledOnce, duplicates: Math.max(0, received - handledOnce), unverified: n(h?.unverified) },
    ai: ai.map((r) => ({ route: r.route || "(outside a request)", calls: n(r.calls), inputTokens: n(r.input_tokens), outputTokens: n(r.output_tokens), cost: n(r.cost), replayed: n(r.replayed) })),
  };
}

export type FeedEvent = { kind: "ledger" | "request"; at: string; text: string; detail: string; id: string; tone: "ok" | "attention" | "plain" };

type LedgerRow = { id: number; at: Date | string; actor: string; action: string; ref: string; request_id: string | null };
type RequestRow = { id?: number; request_id: string; route: string; method: string; status: number; ms: number; created_at: Date | string };

/**
 * One feed, newest first: the latest `limit` events from the ledger and the request log, and every 5xx of the last
 * hour, which the "answered 5xx" tile counts. A busy hour can push an error past the latest events, so each counted
 * error is kept in the feed by its own query and listed once.
 */
export function mergeFeed(ledger: LedgerRow[], requests: RequestRow[], errorsLastHour: RequestRow[], limit = 50): FeedEvent[] {
  const asRequest = (r: RequestRow): FeedEvent => ({ kind: "request", at: new Date(r.created_at).toISOString(), text: `${r.method} ${r.route}`, detail: `${r.status} in ${r.ms} ms`, id: r.request_id, tone: r.status >= 500 ? "attention" : r.status >= 400 ? "plain" : "ok" });
  const latest: FeedEvent[] = [
    ...ledger.map((r) => ({ kind: "ledger" as const, at: new Date(r.at).toISOString(), text: r.action, detail: `${r.actor}, ${shortId(r.ref)}`, id: r.request_id ?? `ledger:${r.id}`, tone: /declined|failed|unverified|tampered/.test(r.action) ? ("attention" as const) : ("ok" as const) })),
    ...requests.map(asRequest),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, limit);
  const key = (e: FeedEvent) => `${e.kind}:${e.id}:${e.at}`;
  const shown = new Set(latest.map(key));
  const errors = errorsLastHour.map(asRequest).filter((e) => !shown.has(key(e)));
  return [...latest, ...errors].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/** The last 50 events from the ledger and the request log as one feed, newest first, masked, with every 5xx of the last hour. */
export async function feed(limit = 50): Promise<FeedEvent[]> {
  if (!dbConfigured()) return [];
  const [ledger, requests, errors] = await Promise.all([
    q<LedgerRow>(sql`select id, at, actor, action, ref, detail->>'request_id' as request_id from audit_events order by id desc limit ${limit}`),
    q<RequestRow>(sql`select id, request_id, route, method, status, ms, created_at from request_log order by id desc limit ${limit}`),
    // The same rows the "answered 5xx" tile counts (rightNow below).
    q<RequestRow>(sql`select id, request_id, route, method, status, ms, created_at from request_log where status >= 500 and created_at >= now() - interval '1 hour' order by id desc`),
  ]);
  return mergeFeed(ledger, requests, errors, limit);
}

export type HourPoint = { hour: string; requests: number; errors: number };

/** Requests and errors per hour for the last seven days, every hour present. */
export async function week(): Promise<HourPoint[]> {
  const end = new Date();
  end.setUTCMinutes(0, 0, 0);
  const hours: HourPoint[] = [];
  for (let i = 167; i >= 0; i--) hours.push({ hour: new Date(end.getTime() - i * 3600_000).toISOString(), requests: 0, errors: 0 });
  if (!dbConfigured()) return hours;
  const rows = await q<{ hour: Date | string; n: string; errors: string }>(sql`select date_trunc('hour', created_at) as hour, count(*) as n, count(*) filter (where status >= 500) as errors from request_log where created_at >= now() - interval '7 days' group by 1`);
  const by = new Map(hours.map((h) => [h.hour, h]));
  for (const r of rows) {
    const h = by.get(new Date(r.hour).toISOString());
    if (h) {
      h.requests = n(r.n);
      h.errors = n(r.errors);
    }
  }
  return hours;
}

export type Trace = { id: string; requests: { route: string; method: string; status: number; ms: number; at: string }[]; ledger: { action: string; ref: string; actor: string; at: string; hash: string }[]; ai: { model: string; route: string; ms: number; replayed: boolean }[] };

/** Everything one request id touched: its log lines, the ledger entries it made, and the AI calls it paid for. */
export async function trace(id: string): Promise<Trace> {
  const clean = id.trim().slice(0, 64);
  if (!dbConfigured() || !/^[A-Za-z0-9_.-]{8,64}$/.test(clean)) return { id: clean, requests: [], ledger: [], ai: [] };
  const [requests, ledger, ai] = await Promise.all([
    q<{ route: string; method: string; status: number; ms: number; created_at: Date | string }>(sql`select route, method, status, ms, created_at from request_log where request_id = ${clean} order by id`),
    q<{ action: string; ref: string; actor: string; at: Date | string; hash: string }>(sql`select action, ref, actor, at, hash from audit_events where detail->>'request_id' = ${clean} order by id`),
    q<{ model: string; route: string; ms: number; replayed: boolean }>(sql`select model, route, ms, replayed from ai_usage where request_id = ${clean} order by id`),
  ]);
  return {
    id: clean,
    requests: requests.map((r) => ({ route: r.route, method: r.method, status: r.status, ms: r.ms, at: new Date(r.created_at).toISOString() })),
    ledger: ledger.map((r) => ({ action: r.action, ref: shortId(r.ref), actor: r.actor, at: new Date(r.at).toISOString(), hash: r.hash.slice(0, 12) })),
    ai: ai.map((r) => ({ model: r.model, route: r.route, ms: r.ms, replayed: r.replayed })),
  };
}

export type Alert = { id: string; name: string; rule: string; ok: boolean; state: string };

/** The conditions a pager would watch, each computed live. */
export async function alerts(): Promise<{ alerts: Alert[]; run: CheckRun | null }> {
  const run = dbConfigured() ? await latestRun().catch(() => null) : null;
  if (!dbConfigured()) return { alerts: [], run };
  const [[q15], [ai], [hook], [payout]] = await Promise.all([
    q<{ n: string; errors: string }>(sql`select count(*) as n, count(*) filter (where status >= 500) as errors from request_log where created_at >= now() - interval '15 minutes'`),
    q<{ cost: string }>(sql`select coalesce(sum(cost_usd), 0) as cost from ai_usage where created_at >= (date_trunc('day', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles')`),
    q<{ n: string }>(sql`select count(*) as n from audit_events where action = 'paypal.webhook.unverified' and at >= now() - interval '24 hours'`),
    q<{ n: string }>(sql`select count(*) as n from payouts where status in ('FAILED', 'BLOCKED', 'RETURNED', 'REVERSED') and updated_at >= now() - interval '24 hours'`),
  ]);
  const total = n(q15?.n);
  const errors = n(q15?.errors);
  const rate = total ? errors / total : 0;
  const cost = n(ai?.cost);
  const ageH = run ? run.ageMinutes / 60 : null;
  return {
    run,
    alerts: [
      { id: "errors", name: "Error rate", rule: "Over 5% of API requests answered 5xx in the last 15 minutes", ok: rate <= 0.05, state: total ? `${errors} of ${total} requests, ${(rate * 100).toFixed(1)}%` : "No requests in the last 15 minutes" },
      { id: "ai", name: "AI spend", rule: `Over the day's $${AI_DAILY_CAP_USD.toFixed(2)} cap`, ok: cost <= AI_DAILY_CAP_USD, state: `$${cost.toFixed(2)} today` },
      { id: "webhook", name: "Webhook signatures", rule: "A webhook arrived whose signature PayPal did not verify, in the last 24 hours", ok: n(hook?.n) === 0, state: n(hook?.n) ? `${n(hook?.n)} unverified` : "Every webhook verified" },
      { id: "payout", name: "Payouts", rule: "A payout item failed, was blocked or came back, in the last 24 hours", ok: n(payout?.n) === 0, state: n(payout?.n) ? `${n(payout?.n)} to look at` : "None failed" },
      { id: "checks", name: "Outside checks", rule: "The nightly run is older than 36 hours or did not pass every check", ok: Boolean(run && ageH !== null && ageH <= 36 && run.passed === run.total), state: run ? `${run.passed} of ${run.total} passed, ${ageH !== null && ageH < 1 ? `${run.ageMinutes} min` : `${Math.round(ageH ?? 0)} h`} ago` : "No run filed yet" },
    ],
  };
}
