import type { Metadata } from "next";
import Link from "next/link";
import { Info } from "@/components/Info";
import { ENDPOINTS, ERRORS } from "@/lib/api/endpoints";
import { LIMITS } from "@/lib/api/keys";
import { openapi } from "@/lib/api/openapi";
import "../../pages.css";
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
      </header>

      <section className="page-section" aria-labelledby="auth-h">
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

      {ENDPOINTS.map((e) => {
        const op = (spec.paths[e.path] as Record<string, { requestBody?: { content?: Record<string, { schema?: JsonSchema }> } }>)[e.method.toLowerCase()];
        const schema = op?.requestBody?.content?.["application/json"]?.schema ?? op?.requestBody?.content?.["multipart/form-data"]?.schema;
        const rows = schema ? fields(schema) : [];
        return (
          <section key={e.id} id={e.id} className="page-section doc-ep" aria-labelledby={`${e.id}-h`}>
            <div className="title-row">
              <h2 id={`${e.id}-h`}>{e.title}</h2>
              {e.ai && <span className="dev-tag">Claude</span>}
            </div>
            <p className="dev-route tabular">
              <span className="dev-method">{e.method}</span> {e.path}
            </p>
            <p className="page-prose">{e.summary}</p>
            {rows.length > 0 && (
              <div className="doc-table-wrap" tabIndex={0} role="region" aria-label={`${e.title} fields`}>
                <table className="doc-table">
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
                        <td className="tabular">
                          {r.name}
                          {r.required && <span className="doc-req"> required</span>}
                        </td>
                        <td className="tabular doc-type">{r.type}</td>
                        <td>{r.about}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {e.example !== undefined && <pre className="dev-pre tabular doc-example" tabIndex={0} aria-label={`${e.title} example request`}>{JSON.stringify(e.example, null, 2)}</pre>}
            {e.id !== "health" && (
              <p>
                <Link className="text-link" href={`/developers?endpoint=${e.id}#playground`}>
                  Try it in the playground
                </Link>
              </p>
            )}
          </section>
        );
      })}

      <section className="page-section" aria-labelledby="errors-h">
        <h2 id="errors-h">Errors</h2>
        <p className="page-prose">Every error has a code you can branch on and a plain message you can show to people.</p>
        <dl className="doc-errors">
          {ERRORS.map((x) => (
            <div key={x.code} id={`errors-${x.code}`} className="doc-error">
              <dt className="tabular">
                {x.code} <span className="muted">{x.status}</span>
              </dt>
              <dd>{x.plain}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
