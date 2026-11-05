import { fail, ok } from "@/lib/api/envelope";
import { guard } from "@/lib/api/keys";
import { AskRulesRequest } from "@/lib/api/schemas";
import { AiRefusedError, AiUnavailableError } from "@/lib/ai/claude";
import { askRulebook } from "@/lib/rulebook";

/** POST /api/v1/ask-rules: retrieve the rulebook's passages (Elasticsearch, or in-app), answer from them, check every quote. */
async function handle(req: Request) {
  const started = Date.now();
  const parsed = AskRulesRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid_request", "Send JSON with a question of 4 to 300 characters.", 400, parsed.error.issues);
  try {
    const a = await askRulebook(parsed.data.question);
    return ok(
      {
        question: a.question,
        answer: a.answer,
        quotes: a.quotes.map((q) => ({ cite: q.doc.cite, passage_id: q.doc.id, quote: q.quote, found_word_for_word: q.found, url: q.doc.url })),
        passages: a.retrieval.docs.map((d) => ({ id: d.id, kind: d.kind, cite: d.cite, title: d.title, text: d.text, url: d.url, score: d.score })),
        retrieval: { engine: a.retrieval.mode === "elastic" ? "elasticsearch" : "in-app", model: a.retrieval.model },
        ai: a.ai,
      },
      started,
    );
  } catch (e) {
    if (e instanceof AiUnavailableError || e instanceof AiRefusedError) return fail("upstream_unavailable", "The answer could not be written just now. The passages are still searchable; please try again.", 503);
    console.error("ask-rules failed", e);
    return fail("internal", "Something went wrong while searching the rulebook. Please try again.", 500);
  }
}

export const POST = (req: Request) => guard(req, "ask-rules", () => handle(req));
