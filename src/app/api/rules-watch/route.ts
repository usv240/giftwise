import { connection } from "next/server";
import { ok } from "@/lib/api/envelope";
import { rulesWatch } from "@/lib/rules-watch";
import { api } from "@/lib/api/handler";

/** GET /api/rules-watch: the Federal Register documents that change SSI's income rules or amounts, each matched to what Giftwise does with it. */
async function getRoute() {
  await connection();
  const started = Date.now();
  return ok(await rulesWatch(), started);
}

export const GET = api("/api/rules-watch", getRoute);
