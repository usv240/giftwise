import { sql } from "drizzle-orm";
import { aiAvailable, aiPaused } from "./ai/claude";
import { latestRun } from "./checks";
import { db, dbConfigured } from "./db";
import { accessToken, paypalConfigured } from "./paypal/client";
import { connectPayPalMcp, type PayPalMcpClient } from "./agent/paypal-mcp";
import { rulesWatch } from "./rules-watch";
import { channel3Configured } from "./channel3";
import { elasticConfigured } from "./rulebook";
import { RELEASE, sentryEnabled } from "./sentry";
import pkg from "../../package.json";

/** Versions as the project pins them; "npm:@bryntum/calendar-trial@7.3.7" reads as 7.3.7. */
const pinned = (name: string) => String((pkg.dependencies as Record<string, string>)[name] ?? "").replace(/^.*@/, "").replace(/^[~^]/, "");

/** PayPal's MCP server (its @paypal/mcp package, run locally, else the hosted one): connect, list its tools and try get_order once. Cached for ten minutes. */
let mcpCache: { at: number; ok: boolean; detail: string } | null = null;
async function paypalMcp() {
  if (mcpCache && Date.now() - mcpCache.at < 10 * 60_000) return mcpCache;
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
    detail = `Not reachable (${(e as Error).message.slice(0, 60)}); the assistant reads PayPal's Orders API instead`;
  } finally {
    mcp?.close();
  }
  mcpCache = { at: Date.now(), ok, detail };
  return mcpCache;
}

export type Mode = "live" | "fallback" | "not_connected";
export type Check = { id: string; name: string; mode: Mode; detail: string; ms?: number };

async function timed(fn: () => Promise<string>): Promise<{ ok: boolean; detail: string; ms: number }> {
  const t = Date.now();
  try {
    const detail = await Promise.race([fn(), new Promise<string>((_, rej) => setTimeout(() => rej(new Error("timed out")), 8000))]);
    return { ok: true, detail, ms: Date.now() - t };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "failed", ms: Date.now() - t };
  }
}

/** Live checks for every integration, with the fallback each one uses when it is not reachable. */
/** probeMcp: also connect to PayPal's hosted MCP server (the Status page). Render's health check leaves it off to stay fast. */
export async function runChecks({ probeMcp = false }: { probeMcp?: boolean } = {}): Promise<Check[]> {
  const [pp, database, mcp, fr] = await Promise.all([
    paypalConfigured() ? timed(async () => (await accessToken()) && "Sandbox token issued") : Promise.resolve(null),
    dbConfigured() ? timed(async () => (await db().execute(sql`select 1`)) && "Postgres answered a test query") : Promise.resolve(null),
    paypalConfigured() && probeMcp ? paypalMcp() : Promise.resolve(mcpCache),
    probeMcp ? rulesWatch() : Promise.resolve(null),
  ]);
  const agKey = Boolean(process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY?.trim());
  const run = database?.ok ? await latestRun().catch(() => null) : null;
  const age = run ? (run.ageMinutes < 60 ? `${run.ageMinutes} min ago` : `${Math.round(run.ageMinutes / 60)} h ago`) : "";
  return [
    { id: "paypal", name: "PayPal sandbox", mode: pp?.ok ? "live" : "not_connected", detail: pp ? pp.detail : "Credentials not set", ms: pp?.ms },
    { id: "claude", name: "Claude Opus 5.5", mode: aiAvailable() ? "live" : "fallback", detail: aiAvailable() ? "API key set; bill and fundraiser reading are live" : aiPaused() ? "The API is not taking requests from this account just now; ready-made examples show saved results" : "Ready-made examples show saved results" },
    {
      id: "webhooks",
      name: "PayPal webhooks",
      mode: process.env.PAYPAL_WEBHOOK_ID?.trim() ? "live" : "not_connected",
      detail: process.env.PAYPAL_WEBHOOK_ID?.trim() ? "Every event is signature-checked with PayPal before use" : "Webhook ID not set; payments are captured on the server either way",
    },
    {
      id: "paypal-mcp",
      name: "PayPal MCP server",
      mode: mcp?.ok ? "live" : "fallback",
      detail: mcp ? mcp.detail : paypalConfigured() ? "Checked on the Status page" : "PayPal credentials not set",
    },
    { id: "apimatic", name: "PayPal Server SDK (APIMatic)", mode: "live", detail: `@paypal/paypal-server-sdk ${pinned("@paypal/paypal-server-sdk")} creates, reads and captures orders` },
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
      mode: sentryEnabled() ? "live" : "not_connected",
      detail: sentryEnabled() ? `Sentry receives server, edge and browser errors with personal data masked${RELEASE ? `, release ${RELEASE.slice(0, 7)}` : ""}` : "SENTRY_DSN not set; every event is still written as a JSON log line with its request id",
    },
    {
      id: "checks",
      name: "Outside checks",
      mode: run ? "live" : "not_connected",
      detail: run ? `${run.passed} of ${run.total} passed ${age}, ${run.source === "render-workflow" ? "on Render Workflows" : "run locally"}` : "No run filed yet; the nightly Render Workflow fills this in",
    },
  ];
}
