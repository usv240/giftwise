import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";

/** Runs once per server start: Sentry for the runtime this instance is, when SENTRY_DSN is set. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("../sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("../sentry.edge.config");
}

/** Every server error Next catches (pages, routes, server actions) is reported with its route and a masked request. */
export const onRequestError: Instrumentation.onRequestError = (...args) => {
  if (process.env.SENTRY_DSN) Sentry.captureRequestError(...args);
};
