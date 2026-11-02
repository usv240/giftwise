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
  const [pp, database] = await Promise.all([
    paypalConfigured() ? timed(async () => (await accessToken()) && "Sandbox token issued") : Promise.resolve(null),
    dbConfigured() ? timed(async () => (await db().execute(sql`select 1`)) && "Query ok") : Promise.resolve(null),
  ]);
  return [
    { id: "paypal", name: "PayPal sandbox", mode: pp?.ok ? "live" : "not_connected", detail: pp ? pp.detail : "Credentials not set", ms: pp?.ms },
    { id: "claude", name: "Claude Opus 5.5", mode: aiAvailable() ? "live" : "fallback", detail: aiAvailable() ? "API key set; bill and fundraiser reading are live" : "Ready-made examples show saved results" },
    {
      id: "webhooks",
      name: "PayPal webhooks",
      mode: process.env.PAYPAL_WEBHOOK_ID?.trim() ? "live" : "not_connected",
      detail: process.env.PAYPAL_WEBHOOK_ID?.trim() ? "Every event is signature-checked with PayPal before use" : "Webhook ID not set; payments are captured on the server either way",
    },
    { id: "database", name: "Postgres", mode: database?.ok ? "live" : "not_connected", detail: database ? database.detail : "DATABASE_URL not set", ms: database?.ms },
  ];
}
