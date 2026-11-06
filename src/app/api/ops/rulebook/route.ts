import { connection } from "next/server";
import { fail, ok } from "@/lib/api/envelope";
import { checksAuth } from "@/lib/checks";
import { reindexRulebook } from "@/lib/rulebook";
import { api } from "@/lib/api/handler";

/** POST /api/ops/rulebook: rebuild the Elastic rulebook index from the rule files. Only callers with CHECKS_SECRET. */
async function postRoute(req: Request) {
  await connection();
  const started = Date.now();
  const a = checksAuth(req);
  if (a === "unset") return fail("upstream_unavailable", "CHECKS_SECRET is not set on this server.", 503);
  if (a === "bad") return fail("unauthorized", "Only the Giftwise workflow can do this.", 401);
  const r = await reindexRulebook();
  if (!r.ok) return ok({ skipped: true, reason: r.reason }, started);
  return ok(r, started);
}

export const POST = api("/api/ops/rulebook", postRoute);
