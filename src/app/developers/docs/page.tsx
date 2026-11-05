import type { Metadata } from "next";
import Link from "next/link";
import { Info } from "@/components/Info";
import { OpenOnHash } from "@/components/OpenOnHash";
import { OpenAll } from "@/components/developers/OpenAll";
import { Toc } from "@/components/learn/Toc";
import { ENDPOINTS, ERRORS } from "@/lib/api/endpoints";
import { LIMITS } from "@/lib/api/keys";
import { openapi } from "@/lib/api/openapi";
import { RECORDED_ON, docExamples } from "./examples";
import "../../pages.css";
import "../../learn/toc.css";
import "../../learn/disclosure.css";
import "../dev.css";

export const metadata: Metadata = { title: "API docs", description: "Every Giftwise endpoint, its fields, errors and limits." };

type JsonSchema = { type?: string | string[]; description?: string; enum?: unknown[]; default?: unknown; properties?: Record<string, JsonSchema>; required?: string[]; items?: JsonSchema; anyOf?: JsonSchema[] };

function typeOf(s: JsonSchema): string {
  if (s.enum) return s.enum.map((v) => JSON.stringify(v)).join(" | ");
  if (s.anyOf) return s.anyOf.map(typeOf).join(" | ");
  if (s.type === "array") return `array of ${s.items ? typeOf(s.items) : "items"}`;
  return Array.isArray(s.type) ? s.type.join(" | ") : (s.type ?? "any");
}

/** Flatten a request schema into rows: gift.amount, gift.delivery, profile.savings, and so on. */
function fields(s: JsonSchema, prefix = ""): { name: string; type: string; required: boolean; about: string }[] {
  const out: { name: string; type: string; required: boolean; about: string }[] = [];
  for (const [k, v] of Object.entries(s.properties ?? {})) {
    const name = prefix ? `${prefix}.${k}` : k;
    const nested = v.type === "object" ? v : v.type === "array" && v.items?.type === "object" ? v.items : null;
    out.push({ name: nested && v.type === "array" ? `${name}[]` : name, type: nested ? (v.type === "array" ? "array of objects" : "object") : typeOf(v), required: Boolean(s.required?.includes(k)), about: [v.description, v.default !== undefined ? `Default ${JSON.stringify(v.default)}.` : ""].filter(Boolean).join(" ") });
    if (nested) out.push(...fields(nested, nested === v ? name : `${name}[]`));
  }
  return out;
}

export default function DocsPage() {
  const spec = openapi("");
  const examples = docExamples();
  const contents = [{ id: "keys", title: "Keys and limits" }, ...ENDPOINTS.map((e) => ({ id: e.id, title: e.title })), { id: "errors", title: "Errors" }];
  return (
    <div className="page frame dev-docs">
      <header className="page-head">
        <div className="title-row">
          <h1 className="page-title">API docs</h1>
          <Info id="page.docs" />
        </div>
        <p className="lede">
          Every endpoint, its fields, errors and limits. The same description is at{" "}
          <a className="text-link" href="/openapi.json">
            /openapi.json
          </a>{" "}
          for Postman, SDK generators and AI agents.
        </p>
        <p className="page-prose">
          Or start from the{" "}
          <a className="text-link" href="/postman/giftwise.postman_collection.json" download>
            Giftwise Postman collection
          </a>{" "}
          and its{" "}
          <a className="text-link" href="/postman/giftwise.postman_environment.json" download>
            environment
          </a>
          : 16 requests in five folders, each with tests, from checking a gift to calling the MCP server. The same collection runs in our test suite with Newman.
        </p>
      </header>

      <div className="doc-body">
        <Toc className="doc-toc" items={contents} />

        <div className="doc-main">
          <section id="keys" className="page-section doc-sec" aria-labelledby="auth-h">
            <h2 id="auth-h">Keys and limits</h2>
            <div className="page-prose">
              <p>
                Send your key as <code>Authorization: Bearer gw_test_…</code>. A key is optional. With one: {LIMITS.keyPerMinute} requests a minute and {LIMITS.keyPerDay.toLocaleString("en-US")} a day, and every call shows on your usage page. Without one: {LIMITS.demoPerMinute} a minute.
              </p>
              <p>
                Every response has the same shape: <code>{"{ data, meta, error }"}</code>. <code>meta</code> carries <code>request_id</code>, <code>version</code>, <code>rules_version</code> and <code>latency_ms</code>. Rate-limit headers: <code>X-RateLimit-Limit</code>, <code>X-RateLimit-Remaining</code>, and <code>Retry-After</code> on a 429.
              </p>
              <p>
                <Link className="text-link" href="/developers#key-h">
                  Get a free key
                </Link>
              </p>
            </div>
          </section>

          <section className="page-section doc-eps" aria-labelledby="endpoints-h">
            <div className="doc-eps-head">
              <h2 id="endpoints-h">Endpoints</h2>
              <OpenAll selector=".doc-ep" controls={ENDPOINTS.map((e) => e.id).join(" ")} />
            </div>
            <p className="page-prose">{ENDPOINTS.length} endpoints. Each one opens to its fields, an example request and the response.</p>
            <div className="doc-ep-list">
              {ENDPOINTS.map((e) => {
                const op = (spec.paths[e.path] as Record<string, { requestBody?: { content?: Record<string, { schema?: JsonSchema }> } }>)[e.method.toLowerCase()];
                const schema = op?.requestBody?.content?.["application/json"]?.schema ?? op?.requestBody?.content?.["multipart/form-data"]?.schema;
                const rows = schema ? fields(schema) : [];
                const ex = examples[e.id];
                return (
                  <details key={e.id} id={e.id} className="dsc doc-ep doc-sec">
                    <summary>
                      <h3 id={`${e.id}-h`} className="dsc-k">
                        {e.title}
                      </h3>
                      <span className="dev-route tabular">
                        <code>
                          <span className="dev-method">{e.method}</span> {e.path}
                        </code>
                        {e.ai && <span className="dev-tag">Claude</span>}
                      </span>
                      <span className="doc-ep-line">{e.summary}</span>
                    </summary>
                    <div className="doc-ep-body">
                      {rows.length > 0 && (
                        <div className="doc-table-wrap" tabIndex={0} role="region" aria-label={`${e.title} fields`}>
                          <table className="doc-table doc-fields">
                            <thead>
                              <tr>
                                <th scope="col">Field</th>
                                <th scope="col">Type</th>
                                <th scope="col">About</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((r) => (
                                <tr key={r.name}>
                                  <td className="doc-name">
                                    <code>{r.name}</code>
                                    {r.required && <span className="doc-req"> required</span>}
                                  </td>
                                  <td className="doc-type">
                                    <code>{r.type}</code>
                                  </td>
                                  <td>{r.about}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {ex && (
                        <div className="doc-examples">
                          <figure className="doc-example">
                            <figcaption className="doc-cap">
                              Example request
                              {ex.sampleBill && (
                                <>
                                  , with the{" "}
                                  <a className="text-link" href={ex.sampleBill}>
                                    sample electric bill
                                  </a>
                                </>
                              )}
                            </figcaption>
                            <pre className="dev-pre tabular" tabIndex={0} aria-label={`${e.title}: example request`}>
                              {ex.request}
                            </pre>
                          </figure>
                          <figure className="doc-example">
                            <figcaption className="doc-cap">
                              Example response <span className="muted">{ex.how === "computed" ? "Computed by the rules engine when this page was built." : `Recorded from the live API on ${RECORDED_ON}.`}</span>
                            </figcaption>
                            <pre className="dev-pre tabular doc-response" tabIndex={0} aria-label={`${e.title}: example response`}>
                              {ex.response}
                            </pre>
                          </figure>
                        </div>
                      )}
                      {e.id !== "health" && (
                        <p>
                          <Link className="text-link" href={`/developers?endpoint=${e.id}#playground`}>
                            Try it in the playground
                          </Link>
                        </p>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          </section>

          <section id="errors" className="page-section doc-sec" aria-labelledby="errors-h">
            <h2 id="errors-h">Errors</h2>
            <p className="page-prose">Every error has a code you can branch on and a plain message you can show to people.</p>
            <dl className="doc-errors">
              {ERRORS.map((x) => (
                <div key={x.code} id={`errors-${x.code}`} className="doc-error">
                  <dt>
                    <code>{x.code}</code> <span className="muted tabular">{x.status}</span>
                  </dt>
                  <dd>{x.plain}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
      <OpenOnHash />
    </div>
  );
}
