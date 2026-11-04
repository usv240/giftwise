/**
 * The outside checks for Giftwise. Each one calls the public site over HTTPS, the way a judge would, so nothing
 * here imports app code. main.ts runs every check as its own Render Workflows task; local.ts runs the same list
 * in one process for development.
 */

export type Group = "case" | "path" | "api";
export type CheckResult = { id: string; group: Group; title: string; ok: boolean; detail: string; ms: number; attempts: number };
export type Env = { app: string; secret: string };

/** A failure that is worth retrying: the network, a timeout, or a 5xx or 429 from the server. */
export class Transient extends Error {}

export function env(): Env {
  const app = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const secret = process.env.CHECKS_SECRET ?? "";
  if (!/^https?:\/\//.test(app)) throw new Error("APP_URL must be the public address of the Giftwise web service.");
  if (!secret) throw new Error("CHECKS_SECRET is not set.");
  return { app, secret };
}

async function call(url: string, init: RequestInit = {}, timeoutMs = 60_000) {
  let r: Response;
  try {
    r = await fetch(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    throw new Transient(`${url}: ${(e as Error).message}`);
  }
  if (r.status >= 500 || r.status === 429) throw new Transient(`${url}: HTTP ${r.status}`);
  return r;
}

const timed = async (fn: () => Promise<{ ok: boolean; detail: string }>) => {
  const t = Date.now();
  const r = await fn();
  return { ...r, ms: Date.now() - t };
};

// ---------- Failure cases: run inside the app against the PayPal sandbox, one task each ----------

export async function listCases(e: Env): Promise<{ id: string; title: string }[]> {
  const r = await call(`${e.app}/api/checks/case/list`);
  const j = (await r.json()) as { data?: { id: string; title: string }[] };
  if (!j.data?.length) throw new Transient("The app returned no failure cases.");
  return j.data;
}

export async function runCase(e: Env, id: string, title: string): Promise<Omit<CheckResult, "attempts">> {
  const r = await timed(async () => {
    const res = await call(`${e.app}/api/checks/case/${encodeURIComponent(id)}`, { method: "POST", headers: { Authorization: `Bearer ${e.secret}` } }, 120_000);
    const j = (await res.json()) as { data?: { outcome: string; evidence: string[] }; error?: { message: string } };
    if (!j.data) return { ok: false, detail: j.error?.message ?? `HTTP ${res.status}` };
    return { ok: j.data.outcome === "handled", detail: j.data.evidence.join(" | ").slice(0, 600) };
  });
  return { id: `case:${id}`, group: "case", title, ...r };
}

// ---------- The judges' path: every page a judge opens, with the words that prove it rendered ----------

export const PATH = [
  { id: "home", path: "/", title: "Home page", expect: "Give so she keeps" },
  { id: "gift-page", path: "/g/maya", title: "Maya's gift page", expect: "Help Maya" },
  { id: "report", path: "/g/maya/report?month=2026-10", title: "Maya's report to Social Security", expect: "Nothing here counts as income." },
  { id: "easy-read", path: "/g/maya/report/easy?month=2026-10&lang=es", title: "Her report in Easy Read, in Spanish", expect: "No tiene que llamar al Seguro Social" },
  { id: "judges", path: "/judges", title: "For judges", expect: "The five-minute path" },
  { id: "agents", path: "/agents", title: "For AI agents", expect: "For AI agents" },
  { id: "organizations", path: "/organizations", title: "For organizations", expect: "For organizations" },
  { id: "dashboard", path: "/dashboard", title: "Maya's year in AG Studio", expect: "year" },
  { id: "try", path: "/try", title: "Try it", expect: "Try it" },
] as const;

export async function checkPage(e: Env, id: string): Promise<Omit<CheckResult, "attempts">> {
  const step = PATH.find((p) => p.id === id);
  if (!step) throw new Error(`Unknown page check ${id}`);
  const r = await timed(async () => {
    const res = await call(`${e.app}${step.path}`);
    const html = await res.text();
    const found = html.includes(step.expect);
    return { ok: res.status === 200 && found, detail: `HTTP ${res.status}${found ? "" : `, missing "${step.expect}"`}, ${Math.round(html.length / 1024)} KB` };
  });
  return { id: `path:${id}`, group: "path", title: step.title, ...r };
}

// ---------- The public API, including the bugs this project has already fixed once ----------

export const API = [
  { id: "health", title: "Service status: PayPal, Claude and the database live" },
  { id: "ledger", title: "The audit ledger's hash chain verifies end to end" },
  { id: "ssa-report", title: "October's report: nothing counts, her check stays $994" },
  { id: "mcp", title: "The MCP server lists its six tools" },
  { id: "openapi", title: "OpenAPI names the public address, not the internal port" },
  { id: "paypal-return", title: "PayPal's return link sends people to the public address" },
] as const;

export async function checkApi(e: Env, id: string): Promise<Omit<CheckResult, "attempts">> {
  const item = API.find((a) => a.id === id);
  if (!item) throw new Error(`Unknown API check ${id}`);
  const r = await timed(async () => {
    switch (id) {
      case "health": {
        const j = (await (await call(`${e.app}/api/health`)).json()) as { ok: boolean; checks: { id: string; mode: string }[] };
        const live = (k: string) => j.checks.find((c) => c.id === k)?.mode === "live";
        return { ok: j.ok && live("paypal") && live("claude") && live("database"), detail: j.checks.map((c) => `${c.id} ${c.mode}`).join(", ") };
      }
      case "ledger": {
        const j = (await (await call(`${e.app}/api/ledger/verify`)).json()) as { data: { ok: boolean; count: number; brokenAt?: number } };
        return { ok: j.data.ok, detail: j.data.ok ? `${j.data.count} entries, every fingerprint matches` : `Chain breaks at entry ${j.data.brokenAt}` };
      }
      case "ssa-report": {
        const j = (await (await call(`${e.app}/api/v1/ssa-report?page=maya&month=2026-10`)).json()) as { data: { status: string; totals: { check: number; gifts: number }; due: { date: string } } };
        return { ok: j.data.status === "nothing_counts" && j.data.totals.check === 994 && j.data.due.date === "2026-11-10", detail: `${j.data.status}, ${j.data.totals.gifts} gifts, check $${j.data.totals.check}, due ${j.data.due.date}` };
      }
      case "mcp": {
        const res = await call(`${e.app}/api/mcp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) });
        const j = (await res.json()) as { result?: { tools: { name: string }[] } };
        const names = j.result?.tools.map((t) => t.name) ?? [];
        return { ok: names.length === 6 && names.includes("get_ssa_report") && names.includes("start_gift_checkout"), detail: names.join(", ") };
      }
      case "openapi": {
        const j = (await (await call(`${e.app}/openapi.json`)).json()) as { servers: { url: string }[] };
        const url = j.servers?.[0]?.url ?? "";
        return { ok: url === e.app, detail: url };
      }
      case "paypal-return": {
        const res = await call(`${e.app}/api/paypal/return?token=bad`);
        const to = res.headers.get("location") ?? "";
        return { ok: res.status === 303 && to.startsWith(`${e.app}/`), detail: `HTTP ${res.status} to ${to}` };
      }
      default:
        throw new Error(`Unknown API check ${id}`);
    }
  });
  return { id: `api:${id}`, group: "api", title: item.title, ...r };
}

// ---------- One run: fan out every check, then file the results with the app ----------

export type Runner = {
  runCase: (id: string, title: string) => Promise<CheckResult>;
  checkPage: (id: string) => Promise<CheckResult>;
  checkApi: (id: string) => Promise<CheckResult>;
};

/** Run every check at once. A check that still fails after its retries is recorded as failed, never dropped. */
export async function runAll(e: Env, runner: Runner): Promise<CheckResult[]> {
  const cases = await listCases(e);
  const settle = (p: Promise<CheckResult>, id: string, group: Group, title: string) =>
    p.catch((err: Error) => ({ id, group, title, ok: false, detail: `Did not finish after retries: ${err.message}`.slice(0, 600), ms: 0, attempts: 1 }));
  return Promise.all([
    ...cases.map((c) => settle(runner.runCase(c.id, c.title), `case:${c.id}`, "case", c.title)),
    ...PATH.map((p) => settle(runner.checkPage(p.id), `path:${p.id}`, "path", p.title)),
    ...API.map((a) => settle(runner.checkApi(a.id), `api:${a.id}`, "api", a.title)),
  ]);
}

export async function fileRun(e: Env, run: { source: "render-workflow" | "local"; runId: string; startedAt: string; results: CheckResult[] }) {
  const res = await call(`${e.app}/api/checks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${e.secret}` },
    body: JSON.stringify({ ...run, appUrl: e.app }),
  });
  const j = (await res.json()) as { data?: { id: number; passed: number; total: number }; error?: { message: string } };
  if (!j.data) throw new Error(`The app did not accept the run: ${j.error?.message ?? res.status}`);
  return j.data;
}

/** Retry transient failures with backoff, the same policy main.ts gives Render Workflows. */
export async function withRetry<T extends Omit<CheckResult, "attempts">>(fn: () => Promise<T>, maxRetries = 2, waitMs = 3000): Promise<T & { attempts: number }> {
  for (let attempt = 1; ; attempt++) {
    try {
      return { ...(await fn()), attempts: attempt };
    } catch (err) {
      if (!(err instanceof Transient) || attempt > maxRetries) throw err;
      await new Promise((r) => setTimeout(r, waitMs * 2 ** (attempt - 1)));
    }
  }
}
