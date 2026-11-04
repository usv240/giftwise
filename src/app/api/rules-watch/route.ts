import { connection } from "next/server";
import { ok } from "@/lib/api/envelope";
import { rulesWatch } from "@/lib/rules-watch";

/** GET /api/rules-watch: the Federal Register documents that change SSI's income rules or amounts, each matched to what Giftwise does with it. */
export async function GET() {
  await connection();
  const started = Date.now();
  return ok(await rulesWatch(), started);
}
