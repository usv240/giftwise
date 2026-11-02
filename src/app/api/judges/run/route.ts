import { connection } from "next/server";
import { fail, ok } from "@/lib/api/envelope";
import { audit } from "@/lib/audit";
import { dbConfigured } from "@/lib/db";
import { runScenarios } from "@/lib/judges/scenarios";
import { paypalConfigured } from "@/lib/paypal/client";

let lastRun = 0;

/** POST /api/judges/run: run every failure case live against the PayPal sandbox and report what happened. */
export async function POST() {
  await connection();
  const started = Date.now();
  if (!paypalConfigured() || !dbConfigured()) return fail("upstream_unavailable", "The failure-case runner needs PayPal sandbox keys and the database.", 503);
  if (started - lastRun < 20_000) return fail("rate_limited", "The checks ran a moment ago. Please wait 20 seconds and run them again.", 429);
  lastRun = started;
  const results = await runScenarios();
  await audit("system", "judges.failure_cases.run", "runner", { handled: results.filter((r) => r.outcome === "handled").length, total: results.length });
  return ok({ results, handled: results.filter((r) => r.outcome === "handled").length, total: results.length }, started, { source: "PayPal sandbox, live" });
}
