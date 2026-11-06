import { newRequestId, requestId } from "@/lib/log";
import { RULES_VERSION } from "@/lib/rules";

export type ApiErrorCode = "invalid_request" | "rate_limited" | "unauthorized" | "not_found" | "upstream_unavailable" | "internal";

const DOCS = "/developers/docs#errors";

/** The id of the request being answered: the one api() gave it (or read from x-request-id), else a fresh one. */
const id = () => requestId() ?? newRequestId();

export function ok<T>(data: T, started: number, extra: Record<string, unknown> = {}) {
  return Response.json({
    data,
    meta: { request_id: id(), version: "2026-11-01", rules_version: RULES_VERSION, latency_ms: Date.now() - started, ...extra },
    error: null,
  });
}

/** Every error message ends with its request id, so anyone can paste it into /ops and see what that request did. */
export function fail(code: ApiErrorCode, message: string, status: number, details?: unknown) {
  const request_id = id();
  return Response.json(
    {
      data: null,
      meta: { request_id, version: "2026-11-01" },
      error: { code, message: `${message.trim()} Request id: ${request_id}`, docs: `${DOCS}-${code}`, details },
    },
    { status },
  );
}

/** Today's date in US Pacific time, YYYY-MM-DD. */
export function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
}
