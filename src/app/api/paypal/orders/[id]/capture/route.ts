import { fail, ok } from "@/lib/api/envelope";
import { captureAndRecord } from "@/lib/paypal/capture";

/** Capture an approved sandbox order and record every payee's capture. Safe to call twice. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const started = Date.now();
  const { id } = await ctx.params;
  if (!/^[A-Z0-9]{10,24}$/.test(id)) return fail("invalid_request", "That order id does not look right.", 400);
  const r = await captureAndRecord(id);
  switch (r.kind) {
    case "not_found":
      return fail("not_found", "That payment was not started on Giftwise.", 404);
    case "already":
      return ok({ id, status: "COMPLETED", already: true, captures: r.captures, capture_id: r.captures[0]?.capture_id ?? null, amount: total(r.captures), payer_first_name: null }, started);
    case "captured":
      return ok({ id, status: r.status, captures: r.captures, capture_id: r.captures[0]?.capture_id ?? null, amount: total(r.captures), payer_first_name: r.payerFirstName }, started);
    case "declined":
    case "failed":
      return fail(r.kind === "declined" ? "invalid_request" : "upstream_unavailable", r.plain, r.status, { issue: r.issue, debug_id: r.debugId });
  }
}

const total = (c: { amount: string | null }[]) => c.reduce((s, x) => s + Number(x.amount ?? 0), 0).toFixed(2);
