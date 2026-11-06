import Anthropic from "@anthropic-ai/sdk";
import type { AgLlmRequest } from "ag-studio";
import { MODEL, aiError, claude, recordAiUsage } from "@/lib/ai/claude";
import { log } from "@/lib/log";
import { fail } from "@/lib/api/envelope";
import { clientId } from "@/lib/api/keys";
import { dbConfigured } from "@/lib/db";
import { hit } from "@/lib/rate-limit";
import { toParams, toStudioEvents, toolNames } from "@/lib/studio-ai/translate";
import { api } from "@/lib/api/handler";

const MAX_BODY = 600_000;
// One question can take a dozen turns, so the assistant has its own budget instead of the shared 20 a minute.
const TURNS_PER_MINUTE = 60;

/** Count this visitor's turns in their own bucket, in Postgres, so the limit holds across instances. */
async function overLimit(req: Request) {
  if (!dbConfigured()) return false;
  return !(await hit(`studio:${clientId(req)}`, 60, TURNS_PER_MINUTE)).allowed;
}

/**
 * POST /api/studio-ai: one turn of AG Studio's agent loop, answered by Claude. Studio runs the loop and its tools in
 * the browser; this route only calls the model, so the API key never leaves the server. The reply is NDJSON:
 * one {"event": ...} line per streamed AG Studio event, then {"complete": ...} with the finished turn.
 */
async function postRoute(req: Request) {
  const c = claude();
  if (!c) return fail("upstream_unavailable", "The dashboard assistant needs the AI service, which is not connected on this server.", 503);
  const raw = await req.text();
  if (raw.length > MAX_BODY) return fail("invalid_request", "That conversation is too long. Start a new chat.", 413);
  let request: AgLlmRequest;
  try {
    request = JSON.parse(raw);
  } catch {
    return fail("invalid_request", "Send an AG Studio turn as JSON.", 400);
  }
  if (!Array.isArray(request?.input) || request.input.length === 0) return fail("invalid_request", "The turn has no messages.", 400);
  if (await overLimit(req)) return fail("rate_limited", "The assistant has been busy this minute. Please wait a moment and ask again.", 429);

  const names = toolNames(request);
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (line: unknown) => controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
      const run = async (withFormat: boolean) => {
        const t = Date.now();
        const stream = c.messages.stream(toParams(request, names, withFormat), { signal: req.signal });
        for await (const out of toStudioEvents(stream, () => stream.finalMessage(), names)) send(out);
        const final = await stream.finalMessage();
        await recordAiUsage({ model: final.model ?? MODEL, usage: final.usage, ms: Date.now() - t, replayed: false });
      };
      try {
        try {
          await run(true);
        } catch (e) {
          // A schema Claude's structured outputs cannot take: ask for the same JSON in the instructions instead.
          if (e instanceof Anthropic.APIError && e.status === 400 && /schema|output_config|format/i.test(e.message)) await run(false);
          else throw e;
        }
      } catch (e) {
        aiError(e); // pauses the AI features if the API turned the account away
        log.error("studio-ai turn failed", { err: e });
        send({ error: "The assistant could not answer just now. Please try again." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}

export const POST = api("/api/studio-ai", postRoute);
