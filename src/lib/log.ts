import { AsyncLocalStorage } from "node:async_hooks";
import { mask, maskEmail, maskText, redactSecrets, type Fields } from "./scrub";

/**
 * Structured logging: one JSON line per event, with the request id and route of the API call it happened in.
 * Nothing private is written: secrets, payees, photo bytes and full emails are masked before the line is built.
 */

export type Level = "info" | "warn" | "error";
export type { Fields };
export { mask, maskEmail, maskText };

/** What every log line and every ledger entry made during an API request can see. */
export type RequestContext = { requestId: string; route: string; started: number };

const store = new AsyncLocalStorage<RequestContext>();

/** req_ followed by 20 hex characters: the same shape the API envelope has always returned. */
export const newRequestId = () => `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;

/** A request id a caller sends in x-request-id, kept when it is plain and short, so one id can follow a call across services. */
export function acceptRequestId(incoming: string | null | undefined) {
  return incoming && /^[A-Za-z0-9_.-]{8,64}$/.test(incoming) ? incoming : newRequestId();
}

export const requestContext = () => store.getStore() ?? null;
export const requestId = () => requestContext()?.requestId ?? null;
export const runWithRequest = <T>(ctx: RequestContext, fn: () => Promise<T>) => store.run(ctx, fn);

type Sink = (line: string, level: Level) => void;
const stdio: Sink = (line, level) => (level === "error" ? process.stderr : process.stdout).write(line + "\n");
let sink: Sink = stdio;
/** Tests swap the sink to read the lines back. */
export function setLogSink(next: Sink | null) {
  sink = next ?? stdio;
}

/** Build the line's object (exported so tests can check it) and write it. */
export function logLine(level: Level, msg: string, fields: Fields = {}) {
  const ctx = requestContext();
  const { err, ...rest } = fields;
  const line: Fields = {
    ts: new Date().toISOString(),
    level,
    msg: redactSecrets(msg),
    request_id: ctx?.requestId ?? null,
    route: ctx?.route ?? null,
    ...(ctx ? { ms: Date.now() - ctx.started } : {}),
    ...(mask(rest) as Fields),
    ...(err !== undefined ? { err: mask(err instanceof Error ? err : { message: String(err) }) } : {}),
  };
  sink(JSON.stringify(line), level);
  return line;
}

export const log = {
  info: (msg: string, fields?: Fields) => logLine("info", msg, fields),
  warn: (msg: string, fields?: Fields) => logLine("warn", msg, fields),
  error: (msg: string, fields?: Fields) => logLine("error", msg, fields),
};
