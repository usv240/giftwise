import { captureException } from "@sentry/nextjs";
import { db, dbConfigured, schema } from "../db";
import { acceptRequestId, log, runWithRequest } from "../log";
import { pruneEvery } from "../rate-limit";
import { fail } from "./envelope";

/**
 * Every API route is wrapped in api(route, handler): the request gets an id (its own x-request-id when it sends
 * one), the handler runs inside that context so every log line and ledger entry carries the id, and one line
 * records the route, status and duration. The same row goes to request_log, which /ops reads.
 */

/** Routes whose rows would not mean much: a stream stays open for minutes, and Render's health probe comes every few seconds. */
const UNRECORDED = new Set(["/api/ops/stream", "/api/health"]);

type Handler<A extends unknown[]> = (req: Request, ...rest: A) => Promise<Response> | Response;

export function api<A extends unknown[]>(route: string, handler: Handler<A>) {
  return async (req: Request, ...rest: A): Promise<Response> => {
    const requestId = acceptRequestId(req.headers.get("x-request-id"));
    const started = Date.now();
    return runWithRequest({ requestId, route, started }, async () => {
      let res: Response;
      try {
        res = await handler(req, ...rest);
      } catch (err) {
        log.error("request failed", { err, method: req.method });
        captureException(err);
        res = fail("internal", "Something went wrong on our side. Please try again.", 500);
      }
      const ms = Date.now() - started;
      if (!UNRECORDED.has(route) || res.status >= 400) {
        log.info("request", { method: req.method, status: res.status, ms });
        void record(requestId, route, req.method, res.status, ms);
      }
      const headers = new Headers(res.headers);
      headers.set("x-request-id", requestId);
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
    });
  };
}

async function record(requestId: string, route: string, method: string, status: number, ms: number) {
  if (!dbConfigured()) return;
  try {
    await db().insert(schema.requestLog).values({ requestId, route, method, status, ms });
    await pruneEvery();
  } catch (err) {
    log.warn("request log write failed", { err });
  }
}
