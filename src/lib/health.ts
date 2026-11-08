import { sql } from "drizzle-orm";
import { apiKeyState, cachedKeyCheck, keyAccepted } from "./ai/claude";
import { log } from "./log";
import { latestRun } from "./checks";
import { db, dbConfigured } from "./db";
import { accessToken, paypalConfigured } from "./paypal/client";
import { connectPayPalMcp, type PayPalMcpClient } from "./agent/paypal-mcp";
import { rulesWatch } from "./rules-watch";
import { channel3Configured } from "./channel3";
import { elasticConfigured } from "./rulebook";
import { samplePayees } from "./households";
import { RELEASE, sentryEnabled } from "./sentry";
import pkg from "../../package.json";

/** Versions as the project pins them; "npm:@bryntum/calendar-trial@7.3.7" reads as 7.3.7. */
const pinned = (name: string) => String((pkg.dependencies as Record<string, string>)[name] ?? "").replace(/^.*@/, "").replace(/^[~^]/, "");

/** One check of PayPal's MCP server: when it ran, whether get_order reached PayPal, and what it found. */
export type McpProbe = { at: number; ok: boolean; detail: string };

/**
 * The last check of PayPal's MCP server, kept on globalThis so the Status page, /api/health and /ops (separate route
 * bundles in one server process) all read the same one. The Status page runs a new check when the last is over ten
 * minutes old; the health route and /ops report the last one with its time, and start the first one themselves.
 */
const probeStore = globalThis as { __giftwiseMcpProbe?: McpProbe | null; __giftwiseMcpProbing?: Promise<McpProbe> | null };
const MCP_FRESH_MS = 10 * 60_000;

/** PayPal's MCP server (its @paypal/mcp package, run locally, else the hosted one): connect, list its tools and try get_order once. */
function paypalMcp(): Promise<McpProbe> {
  const last = probeStore.__giftwiseMcpProbe;
  if (last && Date.now() - last.at < MCP_FRESH_MS) return Promise.resolve(last);
  // One check at a time: callers that arrive while it runs share its answer.
  probeStore.__giftwiseMcpProbing ??= probePayPalMcp().finally(() => {
    probeStore.__giftwiseMcpProbing = null;
  });
  return probeStore.__giftwiseMcpProbing;
}

async function probePayPalMcp(): Promise<McpProbe> {
  let ok = false;
  let detail: string;
  let mcp: PayPalMcpClient | null = null;
  try {
    mcp = await connectPayPalMcp(12_000);
    const tools = await mcp.tools();
    const r = await mcp.call("get_order", { id: "0000000000000000X" });
    const text = r.content.map((x) => x.text ?? "").join("");
    // A made-up order id: PayPal answering "not found" proves the call reached PayPal's Orders API.
    const setupError = /PAYPAL_API_SETUP_ERROR/.test(text);
    const where = mcp.via === "local" ? `PayPal's @paypal/mcp ${mcp.version}, run by Giftwise` : "PayPal's hosted server";
    ok = !setupError;
    detail = setupError
      ? `${where}: ${tools.length} tools listed; tool calls return PAYPAL_API_SETUP_ERROR, so the assistant reads PayPal's Orders API instead`
      : `${where}: ${tools.length} tools listed; get_order reaches PayPal`;
  } catch (e) {
    // The kind of failure only: an upstream error's text can quote request headers. The full error goes to the masked log.
    log.warn("PayPal MCP probe did not finish", { err: e });
    detail = `Not reachable just now (${(e as Error).message === "timed out" ? "timed out" : "no answer"}); the assistant reads PayPal's Orders API instead`;
  } finally {
    mcp?.close();
  }
  probeStore.__giftwiseMcpProbe = { at: Date.now(), ok, detail };
  return probeStore.__giftwiseMcpProbe;
}

/**
 * live: working. fallback: not reachable or not set, and its fallback is in use. not_connected: a service Giftwise needs
 * is not set up here. off: an optional service that is not turned on, which nothing depends on. checking: the first
 * check since the server started is still running.
 */
export type Mode = "live" | "fallback" | "not_connected" | "off" | "checking";
/** The word on each service's badge, on /status and /ops. */
export const MODE_LABEL: Record<Mode, string> = { live: "Live", fallback: "Fallback", not_connected: "Not connected", off: "Optional, off", checking: "Checking" };
/** checkedAt: when a cached check ran (the PayPal MCP server). optional: the product works the same without it. */
export type Check = { id: string; name: string; mode: Mode; detail: string; ms?: number; checkedAt?: string; optional?: boolean };

/** "just now", "4 minutes ago", "2 hours ago". */
export function ago(at: number, now = Date.now()) {
  const min = Math.max(0, Math.round((now - at) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} ${min === 1 ? "minute" : "minutes"} ago`;
  const h = Math.round(min / 60);
  return `${h} ${h === 1 ? "hour" : "hours"} ago`;
}

/** The PayPal MCP server's line: the last check's answer and when it ran, the same on every page and in /api/health. */
export function mcpCheck(probe: McpProbe | null, configured: boolean, now = Date.now()): Check {
  const base = { id: "paypal-mcp", name: "PayPal MCP server" };
  if (!configured) return { ...base, mode: "not_connected", detail: "PayPal credentials not set" };
  if (!probe) return { ...base, mode: "checking", detail: "The first check since the server started is running now; this line shows its answer once it is in" };
  return { ...base, mode: probe.ok ? "live" : "fallback", detail: `${probe.detail}, checked ${ago(probe.at, now)}`, checkedAt: new Date(probe.at).toISOString() };
}

/**
 * Claude's line: what the API said about this server's key (a free models lookup), or why no key is in use. A key with
 * a space or a second line in it is never sent, and the line says so.
 */
export function claudeCheck(key: { ok: boolean; detail: string } | null, state = apiKeyState()): Check {
  const base = { id: "claude", name: "Claude Opus 5.5" };
  if (state === "malformed") return { ...base, mode: "not_connected", detail: "The API key on this server has more than one line or a space, so it is not used; enter it again as one line. Ready-made examples show saved results" };
  if (state === "missing") return { ...base, mode: "fallback", detail: "Ready-made examples show saved results" };
  if (!key) return { ...base, mode: "checking", detail: "The key check is running now; this line shows the API's answer once it is in" };
  return { ...base, mode: key.ok ? "live" : "fallback", detail: key.ok || /ready-made/i.test(key.detail) ? key.detail : `${key.detail} Ready-made examples show saved results` };
}

/**
 * How many services are live, out of the ones that count: an optional service that is off is named on its own, as a
 * choice rather than a fault. Shared by /status, /ops and /api/health so the three never disagree.
 */
export function liveSummary(checks: Check[]) {
  const counted = checks.filter((c) => c.mode !== "off");
  const fallback = counted.filter((c) => c.mode === "fallback").length;
  return { live: counted.filter((c) => c.mode === "live").length, of: counted.length, fallback, optionalOff: checks.filter((c) => c.mode === "off").map((c) => c.name) };
}

/** "Error tracking is optional and off." for the line under the count; empty when every optional service is on. */
export function optionalOffSentence(names: string[]) {
  if (!names.length) return "";
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `${list} ${names.length === 1 ? "is" : "are"} optional and off.`;
}

/** Who the sample page pays in the sandbox: one business account per shop when each is set, and her ABLE account. */
function payees(): Check {
  const p = samplePayees();
  const name = "PayPal payees";
  if (!p) return { id: "payees", name, mode: "not_connected", detail: "Sandbox payee accounts not set" };
  const able = p.ableOwn ? "her ABLE account another" : "her ABLE account the same one";
  const detail =
    p.shopAccounts === p.shops
      ? `Each of the ${p.shops} sample shops has its own sandbox business account, and ${able}; one order pays each of them directly`
      : `The ${p.shops} sample shops use ${p.shopAccounts} sandbox business ${p.shopAccounts === 1 ? "account" : "accounts"}, and ${able}; one order pays each payee directly`;
  return { id: "payees", name, mode: "live", detail };
}

async function timed(fn: () => Promise<string>): Promise<{ ok: boolean; detail: string; ms: number }> {
  const t = Date.now();
  try {
    const detail = await Promise.race([fn(), new Promise<string>((_, rej) => setTimeout(() => rej(new Error("timed out")), 8000))]);
    return { ok: true, detail, ms: Date.now() - t };
  } catch (e) {
    // Only our own short messages are shown; anything else (an upstream error's text can quote request headers) is
    // named by its kind, with the full error in the masked log.
    log.warn("health check did not pass", { err: e });
    const own = e instanceof Error && /^(timed out|PayPal token request failed \(\d{3}\))$/.test(e.message);
    return { ok: false, detail: own ? (e as Error).message : "Did not answer just now", ms: Date.now() - t };
  }
}

/**
 * Live checks for every integration, with the fallback each one uses when it is not reachable.
 * probeMcp: check PayPal's MCP server again when the last check is over ten minutes old (the Status page). Render's
 * health check and /ops leave it off to stay fast and report the last check with its time; the first request after a
 * start begins that first check in the background.
 */
export async function runChecks({ probeMcp = false }: { probeMcp?: boolean } = {}): Promise<Check[]> {
  if (!probeMcp && paypalConfigured() && !probeStore.__giftwiseMcpProbe) void paypalMcp().catch(() => undefined);
  const [pp, database, mcp, fr] = await Promise.all([
    paypalConfigured() ? timed(async () => (await accessToken()) && "Sandbox token issued") : Promise.resolve(null),
    dbConfigured() ? timed(async () => (await db().execute(sql`select 1`)) && "Postgres answered a test query") : Promise.resolve(null),
    paypalConfigured() && probeMcp ? paypalMcp() : Promise.resolve(probeStore.__giftwiseMcpProbe ?? null),
    probeMcp ? rulesWatch() : Promise.resolve(null),
  ]);
  // The Status page asks the API (a free models lookup, cached ten minutes); the frequent health probe reads the cache.
  // The health probe waits at most 1.5 s for a key check that is not cached yet (one every ten minutes), then reads
  // "checking" and lets it finish in the background.
  const key = probeMcp
    ? await keyAccepted()
    : (cachedKeyCheck() ??
      (apiKeyState() === "ok" ? await Promise.race([keyAccepted().catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 1500))]) : null));
  const agKey = Boolean(process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY?.trim());
  const run = database?.ok ? await latestRun().catch(() => null) : null;
  // The time of the run itself, so the line reads the same however long ago it was.
  const at = run ? `${new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }).format(new Date(run.finishedAt))} ET` : "";
  return [
    { id: "paypal", name: "PayPal sandbox", mode: pp?.ok ? "live" : "not_connected", detail: pp ? pp.detail : "Credentials not set", ms: pp?.ms },
    payees(),
    claudeCheck(key),
    {
      id: "webhooks",
      name: "PayPal webhooks",
      // Optional: every payment is captured on the server when the giver comes back; webhooks add PayPal's own notice.
      optional: true,
      mode: process.env.PAYPAL_WEBHOOK_ID?.trim() ? "live" : "off",
      detail: process.env.PAYPAL_WEBHOOK_ID?.trim() ? "Every event is signature-checked with PayPal before use" : "Optional, off: PAYPAL_WEBHOOK_ID is not set, and every payment is captured on the server either way",
    },
    mcpCheck(mcp, paypalConfigured()),
    { id: "apimatic", name: "PayPal Server SDK (APIMatic)", mode: "live", detail: `@paypal/paypal-server-sdk ${pinned("@paypal/paypal-server-sdk")} creates and reads orders; capture is plain REST with a PayPal-Request-Id` },
    {
      id: "ag-studio",
      name: "AG Studio",
      mode: agKey ? "live" : "fallback",
      detail: agKey ? `ag-studio-react ${pinned("ag-studio-react")}, licensed` : `ag-studio-react ${pinned("ag-studio-react")} on the trial; it shows a licence notice until a key is set`,
    },
    { id: "bryntum", name: "Bryntum Calendar", mode: "live", detail: `@bryntum/calendar ${pinned("@bryntum/calendar")}, the trial build, which shows a trial watermark` },
    {
      id: "rules-watch",
      name: "Federal Register watch",
      mode: fr ? (fr.live && fr.status === "current" ? "live" : "fallback") : "live",
      detail: fr ? fr.sentence : "Checked on the Status page and every night by the outside checks",
    },
    {
      id: "channel3",
      name: "Channel3 product search",
      mode: channel3Configured() ? "live" : "fallback",
      detail: channel3Configured() ? "Key set; the gift finder searches real products, each checked against the SSI rules" : "The gift finder uses its sample catalog until CHANNEL3_API_KEY is set",
    },
    {
      id: "elastic",
      name: "Elasticsearch rulebook search",
      mode: elasticConfigured() ? "live" : "fallback",
      detail: elasticConfigured() ? "Hybrid keyword and semantic search with jina-embeddings-v3, reranked by jina-reranker-v3, over the regulations, SSA's manual and its worked examples" : "Ask the rulebook uses the in-app keyword search until ELASTIC_URL and ELASTIC_API_KEY are set",
    },
    { id: "database", name: "Postgres", mode: database?.ok ? "live" : "not_connected", detail: database ? database.detail : "DATABASE_URL not set", ms: database?.ms },
    {
      id: "errors",
      name: "Error tracking",
      // Optional: without Sentry, every event is still a JSON log line with its request id.
      optional: true,
      mode: sentryEnabled() ? "live" : "off",
      detail: sentryEnabled()
        ? `Sentry receives server, edge and browser errors with personal data masked${RELEASE ? `, release ${RELEASE.slice(0, 7)}` : ""}`
        : "Optional, off: SENTRY_DSN is not set, and every event is still written as a JSON log line with its request id",
    },
    {
      id: "checks",
      name: "Outside checks",
      mode: run ? "live" : "not_connected",
      detail: run ? `${run.passed} of ${run.total} passed in the latest run, ${at}, ${run.source === "render-workflow" ? "on Render Workflows" : "run locally"}` : "No run filed yet; the nightly Render Workflow fills this in",
    },
  ];
}
