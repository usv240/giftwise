import { RULES_VERSION } from "@/lib/rules";

export type ApiErrorCode = "invalid_request" | "rate_limited" | "unauthorized" | "not_found" | "upstream_unavailable" | "internal";

const DOCS = "/developers/docs#errors";

export function ok<T>(data: T, started: number, extra: Record<string, unknown> = {}) {
  return Response.json({
    data,
    meta: { request_id: `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`, version: "2026-11-01", rules_version: RULES_VERSION, latency_ms: Date.now() - started, ...extra },
    error: null,
  });
}

export function fail(code: ApiErrorCode, message: string, status: number, details?: unknown) {
  return Response.json(
    {
      data: null,
      meta: { request_id: `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`, version: "2026-11-01" },
      error: { code, message, docs: `${DOCS}-${code}`, details },
    },
    { status },
  );
}

/** Today's date in US Pacific time, YYYY-MM-DD. */
export function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
}
