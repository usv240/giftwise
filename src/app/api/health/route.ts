import { connection } from "next/server";
import { liveSummary, runChecks } from "@/lib/health";
import { api } from "@/lib/api/handler";
import { clientAddress } from "@/lib/api/keys";

/**
 * GET /api/health: every integration and whether it is live, on its fallback, or optional and off. `ok` is the two
 * services nothing works without (PayPal and Postgres); `summary` is the count /status and /ops show.
 */
async function getRoute(req: Request) {
  await connection();
  const checks = await runChecks();
  const core = checks.filter((c) => c.id === "paypal" || c.id === "database");
  const s = liveSummary(checks);
  // Which header this request's address was read from (the name only, never the address), so an operator can
  // confirm the hosted site limits callers by an address they cannot choose.
  const client_address_from = clientAddress(req).source;
  return Response.json({ ok: core.every((c) => c.mode === "live"), summary: { live: s.live, of: s.of, fallback: s.fallback, optional_off: s.optionalOff }, checks, client_address_from, at: new Date().toISOString() });
}

export const GET = api("/api/health", getRoute);
