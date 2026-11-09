import { newRequestId, requestId } from "@/lib/log";
import { RULES_VERSION } from "@/lib/rules";
import { redactDeep, redactSecrets } from "@/lib/scrub";
import { API_VERSION } from "./version";

export type ApiErrorCode = "invalid_request" | "rate_limited" | "unauthorized" | "not_found" | "upstream_unavailable" | "internal";

const DOCS = "/developers/docs#errors";

/** The id of the request being answered: the one api() gave it (or read from x-request-id), else a fresh one. */
const id = () => requestId() ?? newRequestId();

export function ok<T>(data: T, started: number, extra: Record<string, unknown> = {}) {
  return Response.json({
    // No credential-shaped text leaves in a response, whatever an upstream service or a model put in it.
    data: redactDeep(data),
    meta: { request_id: id(), version: API_VERSION, rules_version: RULES_VERSION, latency_ms: Date.now() - started, ...extra },
    error: null,
  });
}

/** Every error message ends with its request id, so anyone can paste it into /ops and see what that request did. */
export function fail(code: ApiErrorCode, message: string, status: number, details?: unknown) {
  const request_id = id();
  return Response.json(
    {
      data: null,
      meta: { request_id, version: API_VERSION },
      error: { code, message: `${redactSecrets(message.trim())} Request id: ${request_id}`, docs: `${DOCS}-${code}`, details: redactDeep(details) },
    },
    { status },
  );
}

/** Today's date in US Pacific time, YYYY-MM-DD: the one calendar src/lib/time.ts keeps for every income date. */
export { today } from "@/lib/time";
