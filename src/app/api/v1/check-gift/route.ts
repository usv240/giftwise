import { guard } from "@/lib/api/keys";
import { fail, ok, today } from "@/lib/api/envelope";
import { CheckGiftRequest } from "@/lib/api/schemas";
import { DEFAULT_PROFILE, evaluateGift } from "@/lib/rules";
import { api } from "@/lib/api/handler";
import { checkGiftData } from "@/lib/api/check-gift";

/** POST /api/v1/check-gift: how one gift affects SSI, and the best way to deliver it. */
async function handle(req: Request) {
  const started = Date.now();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("invalid_request", "The request body must be JSON.", 400);
  }
  const parsed = CheckGiftRequest.safeParse(body);
  if (!parsed.success) {
    return fail("invalid_request", "Some fields are missing or not valid. See details.", 400, parsed.error.issues);
  }
  const { gift, profile } = parsed.data;
  const r = evaluateGift(
    {
      id: "api",
      date: gift.date ?? today(),
      amount: gift.amount,
      delivery: gift.delivery,
      category: gift.category,
      recurring: gift.recurring,
      giver: gift.giver,
      label: gift.label,
      covers: gift.covers,
      payerCoOwns: gift.payerCoOwns,
      rentPaid: gift.rentPaid,
      every: gift.every,
      loan: gift.loan,
    },
    { ...DEFAULT_PROFILE, ...profile },
  );
  return ok(checkGiftData(r, { ...DEFAULT_PROFILE, ...profile }), started);
}

const postRoute = (req: Request) => guard(req, "check-gift", () => handle(req));

export const POST = api("/api/v1/check-gift", postRoute);
