import { connection } from "next/server";
import { fail, ok } from "@/lib/api/envelope";
import { api } from "@/lib/api/handler";
import { CardCheckError, cardCheckBlocked, runCardCheck } from "@/lib/card-check";
import { failureKind } from "@/lib/scrub";
import { checksAuth } from "@/lib/checks";
import { dbConfigured } from "@/lib/db";
import { log } from "@/lib/log";
import { paypalConfigured } from "@/lib/paypal/client";

/**
 * POST /api/checks/card-gift: pay one routed gift end to end with PayPal's sandbox test card, no login, and check the
 * split at PayPal (src/lib/card-check.ts). Only the checks workflow may call it. A wrong split answers 200 with ok
 * false, so the workflow records it; PayPal or the network failing answers 502, so the workflow tries again.
 */
async function postRoute(req: Request) {
  await connection();
  const started = Date.now();
  const auth = checksAuth(req);
  if (auth === "unset") return fail("upstream_unavailable", "CHECKS_SECRET is not set on this server.", 503);
  if (auth === "bad") return fail("unauthorized", "Only the Giftwise checks workflow can run the card check.", 401);
  if (!paypalConfigured() || !dbConfigured()) return fail("upstream_unavailable", "The card check needs PayPal keys and the database.", 503);
  const blocked = cardCheckBlocked();
  if (blocked) return fail("invalid_request", blocked, 409);
  try {
    return ok(await runCardCheck(), started);
  } catch (e) {
    log.error("card check failed", { err: e });
    return fail("upstream_unavailable", e instanceof CardCheckError ? `The card check did not finish: ${e.message}` : `The card check did not finish (${failureKind(e)}).`, 502);
  }
}

export const POST = api("/api/checks/card-gift", postRoute);
