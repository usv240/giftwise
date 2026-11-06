import { connection } from "next/server";
import { fail, ok } from "@/lib/api/envelope";
import { api } from "@/lib/api/handler";
import { trace } from "@/lib/ops";

/** GET /api/ops/trace?id=req_...: that request's log lines, the ledger entries it made and the AI calls it paid for. Public, masked. */
async function getRoute(req: Request) {
  await connection();
  const started = Date.now();
  const id = new URL(req.url).searchParams.get("id")?.trim() ?? "";
  if (!/^[A-Za-z0-9_.-]{8,64}$/.test(id)) return fail("invalid_request", "Paste a request id from any API response, such as req_ followed by 20 characters.", 400);
  return ok(await trace(id), started);
}

export const GET = api("/api/ops/trace", getRoute);
