import { connection } from "next/server";
import { verifyLedger } from "@/lib/audit";
import { api } from "@/lib/api/handler";

/** GET /api/ledger/verify: recompute the audit ledger's hash chain from the first event. */
async function getRoute() {
  await connection();
  return Response.json({ data: await verifyLedger(), error: null });
}

export const GET = api("/api/ledger/verify", getRoute);
