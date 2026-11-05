/**
 * "Ask the rulebook": a small agent over SSI's own text. Step 1, retrieve: Elasticsearch hybrid search (keyword plus
 * semantic, with jina-embeddings-v3 on Elastic's inference service, fused by reciprocal rank, then reranked by
 * jina-reranker-v3) over the regulations,
 * SSA's operating manual, its worked examples, and Giftwise's rule table. Without ELASTIC_URL and ELASTIC_API_KEY,
 * an in-app keyword ranking (BM25) stands in. Step 2, answer: Claude answers in plain words from only the passages
 * retrieved. Step 3, check: a program confirms every quote appears word for word in the passage it cites.
 */
import { z } from "zod";
import authorities from "../../content/authorities.json";
import ssaExamples from "../../content/eval/ssa-examples.json";
import { AiUnavailableError, aiAvailable, structured } from "./ai/claude";
import { RULES } from "./rules/table";

export type RuleDoc = { id: string; kind: "regulation" | "manual" | "example" | "rule"; cite: string; title: string; text: string; url: string | null };

const INDEX = "giftwise-rulebook";

/** Every document the rulebook holds, built from the same files the rules engine and reviewers cite. */
export function ruleDocs(): RuleDoc[] {
  const passages = (authorities as { passages: { id: string; authority: string; cite: string; url: string; section_heading?: string; text: string }[] }).passages.map((p) => ({
    id: p.id,
    kind: (p.authority === "regs" ? "regulation" : "manual") as RuleDoc["kind"],
    cite: p.cite,
    title: p.section_heading ?? p.cite,
    text: p.text,
    url: p.url,
  }));
  const examples = (ssaExamples as { cases: { id: string; title: string; cite: string; part?: string; passage: string; source?: string }[] }).cases.map((c) => ({
    id: `example-${c.id}`,
    kind: "example" as const,
    cite: `${c.cite}${c.part ? ` ${c.part}` : ""}`,
    title: c.title,
    text: c.passage,
    url: null,
  }));
  const rules = Object.values(RULES).map((r) => ({ id: `rule-${r.id}`, kind: "rule" as const, cite: r.id, title: r.name, text: r.plain, url: null }));
  return [...passages, ...examples, ...rules];
}

export const elasticConfigured = () => Boolean(process.env.ELASTIC_URL?.trim() && process.env.ELASTIC_API_KEY?.trim());
const esUrl = () => process.env.ELASTIC_URL!.trim().replace(/\/$/, "");

async function es<T>(path: string, init: RequestInit = {}): Promise<{ status: number; body: T }> {
  const r = await fetch(`${esUrl()}${path}`, {
    ...init,
    headers: { Authorization: `ApiKey ${process.env.ELASTIC_API_KEY!.trim()}`, "Content-Type": init.body && String(init.body).includes("\n{") ? "application/x-ndjson" : "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await r.json().catch(() => ({}))) as T;
  return { status: r.status, body };
}

let ready: Promise<{ semantic: boolean; model: string | null }> | null = null;

/**
 * Create the index on first use, with a semantic_text field on jina-embeddings-v3 (falling back to the
 * deployment's default model), and load every document. Safe to call often; the work happens once per process.
 */
export function ensureIndex() {
  ready ??= (async () => {
    const head = await fetch(`${esUrl()}/${INDEX}`, { method: "HEAD", headers: { Authorization: `ApiKey ${process.env.ELASTIC_API_KEY!.trim()}` }, signal: AbortSignal.timeout(15_000) });
    if (head.status === 200) {
      const m = await es<Record<string, { mappings?: { properties?: { semantic?: { inference_id?: string } } } }>>(`/${INDEX}/_mapping`);
      const props = m.body[INDEX]?.mappings?.properties;
      return { semantic: Boolean(props?.semantic), model: props?.semantic?.inference_id ?? (props?.semantic ? "default" : null) };
    }
    const fields = { id: { type: "keyword" }, kind: { type: "keyword" }, cite: { type: "text", copy_to: "semantic" }, title: { type: "text", copy_to: "semantic" }, text: { type: "text", copy_to: "semantic" }, url: { type: "keyword", index: false } };
    let model: string | null = ".jina-embeddings-v3";
    let made = await es(`/${INDEX}`, { method: "PUT", body: JSON.stringify({ mappings: { properties: { ...fields, semantic: { type: "semantic_text", inference_id: model } } } }) });
    if (made.status >= 300) {
      model = "default";
      made = await es(`/${INDEX}`, { method: "PUT", body: JSON.stringify({ mappings: { properties: { ...fields, semantic: { type: "semantic_text" } } } }) });
    }
    if (made.status >= 300) {
      model = null;
      made = await es(`/${INDEX}`, { method: "PUT", body: JSON.stringify({ mappings: { properties: fields } }) });
    }
    if (made.status >= 300) throw new Error(`Elastic could not create the index (${made.status})`);
    const lines = ruleDocs().flatMap((d) => [JSON.stringify({ index: { _index: INDEX, _id: d.id } }), JSON.stringify(d)]);
    const bulk = await es<{ errors?: boolean }>(`/_bulk?refresh=wait_for`, { method: "POST", body: lines.join("\n") + "\n" });
    if (bulk.status >= 300 || bulk.body.errors) throw new Error(`Elastic could not load the rulebook (${bulk.status})`);
    return { semantic: model !== null, model };
  })();
  ready.catch(() => {
    ready = null;
  });
  return ready;
}

/** Rebuild the index from the rule files: delete it, then create and load it again. Used by the Render Workflow. */
export async function reindexRulebook() {
  if (!elasticConfigured()) return { ok: false as const, reason: "Elastic is not connected on this server." };
  await es(`/${INDEX}`, { method: "DELETE" });
  ready = null;
  const idx = await ensureIndex();
  const count = await es<{ count?: number }>(`/${INDEX}/_count`);
  return { ok: true as const, docs: count.body.count ?? 0, semantic: idx.semantic, model: idx.model };
}

// ---------- The in-app fallback: BM25 over the same documents ----------

const tokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9$%.\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[.-]+|[.-]+$/g, ""))
    .filter((w) => w.length > 2 && !STOP.has(w));
const STOP = new Set("the and for that this with from are was were has have had not but you your his her their they them its can will would should may any all one who what when how does did into than then also our out per each".split(" "));

let bm: { docs: RuleDoc[]; tf: Map<string, number>[]; len: number[]; df: Map<string, number>; avg: number } | null = null;
export function localSearch(query: string, k = 6): (RuleDoc & { score: number })[] {
  if (!bm) {
    const docs = ruleDocs();
    const tf = docs.map((d) => {
      const m = new Map<string, number>();
      for (const w of tokens(`${d.cite} ${d.title} ${d.title} ${d.text}`)) m.set(w, (m.get(w) ?? 0) + 1);
      return m;
    });
    const len = tf.map((m) => [...m.values()].reduce((a, b) => a + b, 0));
    const df = new Map<string, number>();
    for (const m of tf) for (const w of m.keys()) df.set(w, (df.get(w) ?? 0) + 1);
    bm = { docs, tf, len, df, avg: len.reduce((a, b) => a + b, 0) / len.length };
  }
  const { docs, tf, len, df, avg } = bm;
  const q = [...new Set(tokens(query))];
  const N = docs.length;
  return docs
    .map((d, i) => {
      let s = 0;
      for (const w of q) {
        const f = tf[i].get(w) ?? 0;
        if (!f) continue;
        const idf = Math.log(1 + (N - (df.get(w) ?? 0) + 0.5) / ((df.get(w) ?? 0) + 0.5));
        s += idf * ((f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (len[i] / avg))));
      }
      return { ...d, score: Math.round(s * 1000) / 1000 };
    })
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

export type Retrieved = { mode: "elastic" | "local"; model: string | null; reranker: string | null; docs: (RuleDoc & { score: number })[] };

const RERANKER = ".jina-reranker-v3";
const SOURCE = ["id", "kind", "cite", "title", "text", "url"];

/**
 * Step 1: retrieve. On Elastic, three stages in one request: keyword and semantic retrievers fused by reciprocal rank,
 * then the top 20 reranked by jina-reranker-v3 against the question. If the reranker does not answer, the fused
 * ranking is used; if Elastic does not answer, the in-app ranking.
 */
export async function retrieve(query: string, k = 6): Promise<Retrieved> {
  if (elasticConfigured()) {
    try {
      const idx = await ensureIndex();
      const lexical = { standard: { query: { multi_match: { query, fields: ["cite^3", "title^2", "text"] } } } };
      const fused = { rrf: { retrievers: [lexical, { standard: { query: { semantic: { field: "semantic", query } } } }], rank_window_size: 30 } };
      const search = (body: unknown) => es<{ hits?: { hits?: { _score: number | null; _source: RuleDoc }[] } }>(`/${INDEX}/_search`, { method: "POST", body: JSON.stringify(body) });
      const toDocs = (hits: { _score: number | null; _source: RuleDoc }[]) => hits.map((h, i) => ({ ...h._source, score: Math.round((h._score ?? 1 / (i + 1)) * 1000) / 1000 }));
      if (idx.semantic) {
        const ranked = await search({ retriever: { text_similarity_reranker: { retriever: fused, field: "text", inference_id: RERANKER, inference_text: query, rank_window_size: 20 } }, size: k, _source: SOURCE });
        if (ranked.status < 300 && ranked.body.hits?.hits) return { mode: "elastic", model: idx.model, reranker: RERANKER, docs: toDocs(ranked.body.hits.hits) };
      }
      const r = await search(idx.semantic ? { retriever: fused, size: k, _source: SOURCE } : { query: lexical.standard.query, size: k, _source: SOURCE });
      if (r.status < 300 && r.body.hits?.hits) return { mode: "elastic", model: idx.model, reranker: null, docs: toDocs(r.body.hits.hits) };
    } catch {
      /* fall through to the in-app ranking */
    }
  }
  return { mode: "local", model: null, reranker: null, docs: localSearch(query, k) };
}

const norm = (s: string) => s.toLowerCase().replace(/[“”"]/g, '"').replace(/[‘’']/g, "'").replace(/\s+/g, " ").trim();

const Answer = z.object({
  answer: z.string().describe("Two or three short sentences in plain words. Say what the rules say about the question. If the passages do not settle it, say so plainly."),
  quotes: z
    .array(z.object({ doc_id: z.string().describe("The id of the passage quoted."), quote: z.string().describe("Words copied exactly from that passage, at least eight words.") }))
    .max(3)
    .describe("Up to three quotes that support the answer, each copied word for word."),
});

export type Asked = {
  question: string;
  retrieval: Retrieved;
  answer: string | null;
  quotes: { doc: RuleDoc; quote: string; found: boolean }[];
  ai: boolean;
};

/** Steps 2 and 3: answer from only what was retrieved, then check every quote against its passage. */
export async function askRulebook(question: string): Promise<Asked> {
  const retrieval = await retrieve(question, 6);
  if (!aiAvailable() || retrieval.docs.length === 0) return { question, retrieval, answer: null, quotes: [], ai: false };
  const context = retrieval.docs.map((d) => `[${d.id}] ${d.cite}, ${d.title}\n${d.text}`).join("\n\n");
  let data: z.infer<typeof Answer>;
  try {
    ({ data } = await structured({
      schema: Answer,
      effort: "low",
      maxTokens: 2000,
      system:
        "You explain US Supplemental Security Income (SSI) rules about gifts and help from others. Use only the passages given. Quote them exactly. Never compute a benefit amount. If the passages do not answer the question, say that they do not.",
      content: [{ type: "text", text: `Passages:\n\n${context}\n\nQuestion: ${question}` }],
    }));
  } catch (e) {
    // The passages stand on their own: with the AI busy or away, they are the answer.
    if (e instanceof AiUnavailableError) return { question, retrieval, answer: null, quotes: [], ai: false };
    throw e;
  }
  const byId = new Map(retrieval.docs.map((d) => [d.id, d]));
  const quotes = data.quotes.flatMap((q) => {
    const doc = byId.get(q.doc_id);
    if (!doc) return [];
    const quote = q.quote.replace(/^["'\s.]+|["'\s]+$/g, "");
    return [{ doc, quote, found: quote.length >= 20 && norm(doc.text).includes(norm(quote)) }];
  });
  return { question, retrieval, answer: data.answer, quotes, ai: true };
}
