import { guard } from "@/lib/api/keys";
import { log } from "@/lib/log";
import sharp from "sharp";
import { fail, ok, today } from "@/lib/api/envelope";
import { AiRefusedError, AiUnavailableError, aiAvailable } from "@/lib/ai/claude";
import { readBill } from "@/lib/ai/tasks";
import { routeReadBill } from "@/lib/ai/bill-review";
import { DEFAULT_PROFILE, evaluateGift } from "@/lib/rules";
import { api } from "@/lib/api/handler";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * POST /api/v1/read-bill (multipart "file"): Claude reads the bill, the rules engine checks it. A bill at or near housing,
 * or one Claude was not sure of, also goes to the two reviewers, and the referee decides its route (`route`, `review`).
 */
async function handle(req: Request) {
  const started = Date.now();
  if (!aiAvailable()) {
    return fail(
      "upstream_unavailable",
      "Live bill reading needs the AI service, which is not connected on this server yet. Open the Wheelchair repair or Electric bill example to see the full result.",
      503,
    );
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("invalid_request", "Send the bill as multipart form data in a field named file.", 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return fail("invalid_request", "Attach a photo or PDF in the field named file.", 400);
  if (file.size > MAX_BYTES) return fail("invalid_request", "That file is larger than 10 MB. Try a smaller photo.", 413);

  const buf = Buffer.from(await file.arrayBuffer());
  let base64: string;
  let mediaType: string;
  if (file.type === "application/pdf") {
    base64 = buf.toString("base64");
    mediaType = "application/pdf";
  } else if (file.type.startsWith("image/")) {
    // Re-encode: strips EXIF location data and any embedded payloads, and keeps the image a sensible size.
    try {
      const out = await sharp(buf).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
      base64 = out.toString("base64");
      mediaType = "image/jpeg";
    } catch {
      return fail("invalid_request", "That image could not be opened. Try taking the photo again, or upload a PDF.", 422);
    }
  } else {
    return fail("invalid_request", "Use a photo (JPEG, PNG, WebP) or a PDF.", 415);
  }

  try {
    const { data: bill, model } = await readBill({ base64, mediaType });
    // `check`: the rules engine on the one reading, paid to the vendor. `route`: the way Giftwise pays it, after the reviewers when they ran.
    const result = evaluateGift(
      { id: "bill", date: bill.due_date ?? today(), amount: bill.amount_due, delivery: "vendor", category: bill.vendor_category, label: bill.vendor_name },
      DEFAULT_PROFILE,
    );
    const { route, review } = await routeReadBill(bill, today(), DEFAULT_PROFILE);
    return ok(
      { bill, check: { check_after: result.checkAfter, best_route: result.bestRoute, check_with_best_route: result.checkWithBestRoute, rule_ids: result.ruleIds, ambiguous: result.ambiguous, explanation: result.explanation }, route, review },
      started,
      { model },
    );
  } catch (e) {
    if (e instanceof AiUnavailableError) return fail("upstream_unavailable", `${e.message} Open the Wheelchair repair or Electric bill example to see the full result.`, 503);
    if (e instanceof AiRefusedError) return fail("upstream_unavailable", "The AI could not read this document. Try a clearer photo.", 422);
    log.error("read-bill failed", { err: e });
    return fail("internal", "Something went wrong while reading the bill. Please try again.", 500);
  }
}

const postRoute = (req: Request) => guard(req, "read-bill", () => handle(req));

export const POST = api("/api/v1/read-bill", postRoute);
