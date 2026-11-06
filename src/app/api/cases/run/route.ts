import { connection } from "next/server";
import { fail, ok } from "@/lib/api/envelope";
import { audit } from "@/lib/audit";
import { dbConfigured } from "@/lib/db";
import { runScenarios } from "@/lib/cases/scenarios";
import { paypalConfigured } from "@/lib/paypal/client";
import { api } from "@/lib/api/handler";
import { hit } from "@/lib/rate-limit";

/** POST /api/cases/run: run every failure case live against the PayPal sandbox and report what happened. One run per 20 seconds, across every instance. */
async function postRoute() {
  await connection();
  const started = Date.now();
  if (!paypalConfigured() || !dbConfigured()) return fail("upstream_unavailable", "The failure-case runner needs PayPal sandbox keys and the database.", 503);
  if (!(await hit("cases:run", 20, 1)).allowed) return fail("rate_limited", "The checks ran a moment ago. Please wait 20 seconds and run them again.", 429);
  const results = await runScenarios();
  await audit("system", "cases.failure_cases.run", "runner", { handled: results.filter((r) => r.outcome === "handled").length, total: results.length });
  return ok({ results, handled: results.filter((r) => r.outcome === "handled").length, total: results.length }, started, { source: "PayPal sandbox, live" });
}

export const POST = api("/api/cases/run", postRoute);
