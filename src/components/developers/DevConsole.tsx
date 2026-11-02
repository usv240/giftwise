"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ENDPOINTS, type Endpoint } from "@/lib/api/endpoints";
import { Info } from "../Info";

type Sent = { status: number; ms: number; requestId: string | null; remaining: string | null; body: string };
type Lang = "curl" | "js" | "python";

const PLAYABLE = ENDPOINTS.filter((e) => e.id !== "health");
const SAMPLE_BILL = "/samples/northside-electric-bill.png";
const pretty = (v: unknown) => JSON.stringify(v, null, 2);
const pathFor = (e: Endpoint) => e.path.replace("{id}", "electric-bill");

/** Get a key (shown once), then send real requests to the live API with it. */
export function DevConsole() {
  const [key, setKey] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState<Endpoint>(PLAYABLE[0]);
  const [body, setBody] = useState(pretty(PLAYABLE[0].example));
  const [file, setFile] = useState<File | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const [busy, setBusy] = useState(false);
  const [lang, setLang] = useState<Lang>("curl");
  const [origin, setOrigin] = useState("https://giftwise.example");
  const playground = useRef<HTMLElement>(null);

  useEffect(() => {
    // The page origin is only known in the browser; snippets show it once mounted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
    const want = new URLSearchParams(window.location.search).get("endpoint");
    const e = PLAYABLE.find((x) => x.id === want);
    if (e) {
      setEndpoint(e);
      setBody(e.example ? pretty(e.example) : "");
    }
  }, []);

  function choose(e: Endpoint) {
    setEndpoint(e);
    setBody(e.example ? pretty(e.example) : "");
    setSent(null);
  }

  async function send() {
    setBusy(true);
    const started = performance.now();
    try {
      const headers: Record<string, string> = {};
      if (key.trim()) headers.Authorization = `Bearer ${key.trim()}`;
      let init: RequestInit = { method: endpoint.method, headers };
      if (endpoint.upload) {
        const f = file ?? new File([await (await fetch(SAMPLE_BILL)).blob()], "northside-electric-bill.png", { type: "image/png" });
        const form = new FormData();
        form.append("file", f);
        init = { ...init, body: form };
      } else if (endpoint.method === "POST") {
        try {
          JSON.parse(body);
        } catch {
          setSent({ status: 0, ms: 0, requestId: null, remaining: null, body: "The request body is not valid JSON yet. Check the commas and quotes." });
          return;
        }
        headers["Content-Type"] = "application/json";
        init = { ...init, body };
      }
      const res = await fetch(pathFor(endpoint), init);
      const text = await res.text();
      let shown = text;
      let requestId: string | null = null;
      try {
        const j = JSON.parse(text);
        requestId = j.meta?.request_id ?? null;
        shown = pretty(j);
      } catch {
        /* CSV or plain text stays as it is */
      }
      setSent({ status: res.status, ms: Math.round(performance.now() - started), requestId, remaining: res.headers.get("x-ratelimit-remaining"), body: shown });
    } finally {
      setBusy(false);
    }
  }

  const snippet = useMemo(() => snippetFor(lang, endpoint, origin, key.trim() || "$GIFTWISE_KEY", body), [lang, endpoint, origin, key, body]);

  return (
    <>
      <section className="page-section dev-keys" aria-labelledby="key-h">
        <div className="title-row">
          <h2 id="key-h">Get a free sandbox key</h2>
          <Info id="dev.keys" label="" />
        </div>
        {fresh ? (
          <KeyReveal
            value={fresh}
            onUse={() => {
              setKey(fresh);
              choose(PLAYABLE[0]);
              playground.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
        ) : (
          <KeyForm onKey={setFresh} />
        )}
      </section>

      <section ref={playground} id="playground" className="page-section dev-play" aria-labelledby="play-h">
        <div className="title-row">
          <h2 id="play-h">Playground</h2>
          <Info id="dev.playground" label="" />
        </div>
        <p className="page-prose dev-intro">Every request here hits the live API. A key is optional: without one you use the demo tier of 20 requests a minute.</p>
        <div className="dev-grid">
          <div className="dev-pane" data-ui>
            <div className="dev-eps" role="radiogroup" aria-label="Endpoint">
              {PLAYABLE.map((e) => (
                <button key={e.id} type="button" role="radio" aria-checked={endpoint.id === e.id} className="dev-ep" onClick={() => choose(e)}>
                  {e.title}
                </button>
              ))}
            </div>
            <p className="dev-route tabular">
              <span className="dev-method">{endpoint.method}</span> {pathFor(endpoint)}
              {endpoint.ai && <span className="dev-tag">Claude</span>}
            </p>
            <p className="dev-summary">{endpoint.summary}</p>
            <label className="dev-field">
              <span>API key (optional)</span>
              <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="gw_test_…" spellCheck={false} autoComplete="off" className="tabular" />
            </label>
            {endpoint.upload ? (
              <label className="dev-field">
                <span>Bill photo or PDF (leave empty to send the sample electric bill)</span>
                <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            ) : endpoint.method === "POST" ? (
              <label className="dev-field">
                <span>Request body (JSON)</span>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} spellCheck={false} className="tabular" />
              </label>
            ) : null}
            <button type="button" className="btn btn-primary dev-send" onClick={send} disabled={busy}>
              {busy ? "Sending…" : "Send request"}
            </button>
          </div>

          <div className="dev-pane dev-out" data-ui aria-live="polite">
            {sent ? (
              <>
                <p className="dev-status">
                  <span className="dev-code-badge" data-ok={sent.status >= 200 && sent.status < 300 ? "" : undefined}>
                    {sent.status || "Not sent"}
                  </span>
                  {sent.status > 0 && <span className="tabular">{sent.ms} ms</span>}
                  {sent.requestId && <span className="tabular muted">{sent.requestId}</span>}
                  {sent.remaining && <span className="muted">{sent.remaining} left this minute</span>}
                </p>
                <pre className="dev-pre tabular" tabIndex={0} aria-label="Response body">
                  {sent.body}
                </pre>
              </>
            ) : (
              <p className="muted">The response appears here: status, time, request id and the full JSON.</p>
            )}
            <div className="dev-snip">
              <div className="dev-langs" role="radiogroup" aria-label="Code sample language">
                {(["curl", "js", "python"] as const).map((l) => (
                  <button key={l} type="button" role="radio" aria-checked={lang === l} className="dev-lang" onClick={() => setLang(l)}>
                    {l === "curl" ? "cURL" : l === "js" ? "JavaScript" : "Python"}
                  </button>
                ))}
                <CopyButton text={snippet} label="Copy code" />
              </div>
              <pre className="dev-pre tabular" tabIndex={0} aria-label="Code sample">
                {snippet}
              </pre>
            </div>
          </div>
        </div>
        <p className="dev-more">
          <Link className="text-link" href="/developers/docs">
            Read the docs
          </Link>
          <Link className="text-link" href="/developers/keys">
            Your keys and usage
          </Link>
          <a className="text-link" href="/openapi.json">
            OpenAPI 3.1 spec
          </a>
        </p>
      </section>
    </>
  );
}

function KeyForm({ onKey }: { onKey: (k: string) => void }) {
  const [state, setState] = useState<"idle" | "busy">("idle");
  const [note, setNote] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState("busy");
    setNote("");
    const r = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: f.get("name"), email: f.get("email"), purpose: f.get("purpose") || undefined, accept: f.get("accept") === "on" }),
    });
    const j = await r.json().catch(() => null);
    setState("idle");
    if (!r.ok) return setNote(j?.error?.message ?? "The key was not created. Please try again.");
    onKey(j.data.key);
  }
  return (
    <form className="dev-form" onSubmit={submit} data-ui>
      <label className="dev-field">
        <span>Name</span>
        <input name="name" required maxLength={80} autoComplete="name" />
      </label>
      <label className="dev-field">
        <span>Email</span>
        <input name="email" type="email" required maxLength={200} autoComplete="email" />
      </label>
      <label className="dev-field dev-wide">
        <span>What are you building? (optional)</span>
        <input name="purpose" maxLength={200} />
      </label>
      <label className="dev-check dev-wide">
        <input type="checkbox" name="accept" required />
        <span>I understand sandbox keys are for testing: no real money and no real personal data.</span>
      </label>
      <div className="dev-wide dev-form-foot">
        <button type="submit" className="btn btn-ink" disabled={state === "busy"}>
          {state === "busy" ? "Creating…" : "Get an API key"}
        </button>
        {note && (
          <p className="dev-note" role="status">
            {note}
          </p>
        )}
      </div>
    </form>
  );
}

function KeyReveal({ value, onUse }: { value: string; onUse: () => void }) {
  return (
    <div className="dev-reveal" data-ui role="status">
      <p className="dev-reveal-k">Your key</p>
      <code className="dev-key tabular">{value}</code>
      <p className="dev-reveal-note">This is the only time the full key is shown. Giftwise keeps only a fingerprint of it. You can create another one anytime.</p>
      <div className="dev-reveal-actions">
        <button type="button" className="btn btn-primary" onClick={onUse}>
          Send your first request
        </button>
        <CopyButton text={value} label="Copy key" />
        <a className="btn btn-quiet" download="giftwise.env" href={`data:text/plain;charset=utf-8,${encodeURIComponent(`GIFTWISE_KEY=${value}\n`)}`}>
          Download .env line
        </a>
      </div>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-quiet dev-copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          /* clipboard blocked: the text stays visible to select by hand */
        }
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}

function snippetFor(lang: Lang, e: Endpoint, origin: string, key: string, body: string) {
  const url = `${origin}${pathFor(e)}`;
  const compact = (() => {
    try {
      return JSON.stringify(JSON.parse(body));
    } catch {
      return body;
    }
  })();
  if (lang === "curl") {
    const parts = [`curl${e.method === "POST" ? " -X POST" : ""} "${url}"`, `  -H "Authorization: Bearer ${key}"`];
    if (e.upload) parts.push(`  -F "file=@northside-electric-bill.png"`);
    else if (e.method === "POST") parts.push(`  -H "Content-Type: application/json"`, `  -d '${compact}'`);
    return parts.join(" \\\n");
  }
  if (lang === "js") {
    if (e.upload) return `const form = new FormData();\nform.append("file", fileInput.files[0]);\n\nconst res = await fetch("${url}", {\n  method: "POST",\n  headers: { Authorization: "Bearer ${key}" },\n  body: form,\n});\nconst { data, error } = await res.json();`;
    if (e.method === "GET") return `const res = await fetch("${url}", {\n  headers: { Authorization: "Bearer ${key}" },\n});\nconst data = await res.json();`;
    return `const res = await fetch("${url}", {\n  method: "POST",\n  headers: {\n    Authorization: "Bearer ${key}",\n    "Content-Type": "application/json",\n  },\n  body: JSON.stringify(${compact}),\n});\nconst { data, error } = await res.json();`;
  }
  if (e.upload) return `import requests\n\nwith open("northside-electric-bill.png", "rb") as f:\n    r = requests.post(\n        "${url}",\n        headers={"Authorization": "Bearer ${key}"},\n        files={"file": f},\n    )\nprint(r.json())`;
  if (e.method === "GET") return `import requests\n\nr = requests.get("${url}", headers={"Authorization": "Bearer ${key}"})\nprint(r.json())`;
  return `import requests\n\nr = requests.post(\n    "${url}",\n    headers={"Authorization": "Bearer ${key}"},\n    json=${compact.replace(/\btrue\b/g, "True").replace(/\bfalse\b/g, "False").replace(/\bnull\b/g, "None")},\n)\nprint(r.json())`;
}
