import { guard } from "@/lib/api/keys";
import { log } from "@/lib/log";
import { fail, ok } from "@/lib/api/envelope";
import { AiRefusedError, AiUnavailableError, aiAvailable, replayAvailable } from "@/lib/ai/claude";
import { letterResult, readLetter } from "@/lib/ai/letter";
import { pdfText } from "@/lib/ai/pdf-text";
import { prepareFile, type PreparedFile } from "@/lib/ai/upload";
import { answersToProfile } from "@/lib/situation";
import { api } from "@/lib/api/handler";

const MAX_BYTES = 10 * 1024 * 1024;
const PRONOUNS = new Set(["she", "he", "they"]);

/**
 * POST /api/v1/read-letter (multipart "file", optional "pronoun"): Claude reads the person's letter from Social Security
 * about their SSI payment into the plain questions a gift page asks. The rules engine computes the check from the facts
 * read and compares it with the payment the letter states; for a PDF with a text layer, each quote is checked against
 * the letter's own text. The file is read in memory and never stored, and nothing here is saved: the organizer confirms
 * the answers, and only those are saved, with the page (POST /api/v1/gift-pages or PATCH /api/manage/{token}).
 */
async function handle(req: Request) {
  const started = Date.now();
  // With no key, the sample letter is still read, from Claude's recorded answer to it (content/ai-replay).
  if (!aiAvailable() && !(await replayAvailable())) {
    return fail("upstream_unavailable", "Reading a letter needs the AI service, which is not connected on this server yet. The questions work without it.", 503);
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("invalid_request", "Send the letter as multipart form data in a field named file.", 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return fail("invalid_request", "Attach a photo or PDF of the letter in the field named file.", 400);
  if (file.size > MAX_BYTES) return fail("invalid_request", "That file is larger than 10 MB. Try a smaller photo.", 413);
  if (file.type !== "application/pdf" && !file.type.startsWith("image/")) return fail("invalid_request", "Use a photo (JPEG, PNG, WebP) or a PDF.", 415);
  const p = String(form.get("pronoun") ?? "");
  const pronoun = PRONOUNS.has(p) ? (p as "she" | "he" | "they") : undefined;

  const bytes = Buffer.from(await file.arrayBuffer());
  // An image is re-encoded (src/lib/ai/upload.ts): EXIF location data and any embedded payloads are stripped.
  let prepared: PreparedFile;
  try {
    prepared = await prepareFile(bytes, file.type);
  } catch {
    return fail("invalid_request", "That image could not be opened. Try taking the photo again, or upload a PDF.", 422);
  }

  try {
    // The PDF's own text, when it has one, checks each quote; a photo has none.
    const [{ data, model, replayed, recordedAt }, text] = await Promise.all([readLetter(prepared), file.type === "application/pdf" ? pdfText(bytes) : Promise.resolve(null)]);
    const r = letterResult(data, text, pronoun);
    const { profile, given } = answersToProfile(r.answers, pronoun);
    return ok(
      { letter: r.letter, answers: r.answers, profile: Object.fromEntries(given.map((k) => [k, profile[k]])), check: r.check, quotes: r.quotes, stored: false },
      started,
      { model, replayed, ...(recordedAt ? { recorded_at: recordedAt } : {}) },
    );
  } catch (e) {
    if (e instanceof AiUnavailableError) return fail("upstream_unavailable", `${e.message} The questions work without it, and the sample letter reads on its recorded answer.`, 503);
    if (e instanceof AiRefusedError) return fail("upstream_unavailable", "The AI could not read this letter. Try a clearer photo, or answer the questions instead.", 422);
    log.error("read-letter failed", { err: e });
    return fail("internal", "Something went wrong while reading the letter. Please try again.", 500);
  }
}

const postRoute = (req: Request) => guard(req, "read-letter", () => handle(req));

export const POST = api("/api/v1/read-letter", postRoute);
