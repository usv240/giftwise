import { connection } from "next/server";
import { ok } from "@/lib/api/envelope";
import { api } from "@/lib/api/handler";
import { feed } from "@/lib/ops";

/** GET /api/ops/feed: the last 50 masked events from the ledger and the request log, newest first. Public. */
async function getRoute() {
  await connection();
  const started = Date.now();
  return ok({ events: await feed() }, started);
}

export const GET = api("/api/ops/feed", getRoute);
