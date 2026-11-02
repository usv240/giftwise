import { sql } from "drizzle-orm";
import { aiAvailable } from "./ai/claude";
import { db, dbConfigured } from "./db";
import { accessToken, paypalConfigured } from "./paypal/client";

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
export async function runChecks(): Promise<Check[]> {
  const env = (k: string) => Boolean(process.env[k]?.trim());
  const [pp, database] = await Promise.all([
    paypalConfigured() ? timed(async () => (await accessToken()) && "Sandbox token issued") : Promise.resolve(null),
    dbConfigured() ? timed(async () => (await db().execute(sql`select 1`)) && "Query ok") : Promise.resolve(null),
  ]);
  return [
    { id: "paypal", name: "PayPal sandbox", mode: pp?.ok ? "live" : "not_connected", detail: pp ? pp.detail : "Credentials not set", ms: pp?.ms },
    { id: "claude", name: "Claude Opus 5.5", mode: aiAvailable() ? "live" : "fallback", detail: aiAvailable() ? "API key set; bill and fundraiser reading are live" : "Ready-made examples show saved results" },
    { id: "database", name: "Postgres", mode: database?.ok ? "live" : "not_connected", detail: database ? database.detail : "DATABASE_URL not set", ms: database?.ms },
    { id: "elastic", name: "Elastic", mode: env("ELASTIC_URL") && process.env.FALLBACK_ELASTIC !== "true" ? "live" : "fallback", detail: env("ELASTIC_URL") ? "Rulebook search" : "Citations come from the built-in rule table" },
    { id: "channel3", name: "Channel3", mode: env("CHANNEL3_API_KEY") ? "live" : "fallback", detail: env("CHANNEL3_API_KEY") ? "Product search" : "Saved product examples" },
    { id: "kernel", name: "KERNEL", mode: env("KERNEL_API_KEY") && process.env.FALLBACK_KERNEL !== "true" ? "live" : "fallback", detail: env("KERNEL_API_KEY") ? "Cloud browser for fundraiser pages" : "Pages are read with a direct fetch" },
    { id: "zapier", name: "Zapier", mode: env("ZAPIER_MCP_URL") && process.env.FALLBACK_ZAPIER !== "true" ? "live" : "fallback", detail: env("ZAPIER_MCP_URL") ? "Email and Drive actions" : "Statements download directly" },
    { id: "ag-studio", name: "AG Studio", mode: env("NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY") ? "live" : "fallback", detail: env("NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY") ? "Licensed" : "Runs with the trial watermark" },
    { id: "astropods", name: "Astropods", mode: env("ASTROPODS_AGENT_URL") && process.env.FALLBACK_ASTROPODS !== "true" ? "live" : "fallback", detail: env("ASTROPODS_AGENT_URL") ? "Hosted reviewer agent" : "Reviewers run inside the app" },
  ];
}
