import type { ErrorEvent, Breadcrumb } from "@sentry/nextjs";
import { scrubEvent } from "./scrub";

/**
 * Error tracking is on only when SENTRY_DSN is set; with no DSN, Sentry's init is skipped and nothing changes.
 * Release is the git commit (Render sets RENDER_GIT_COMMIT), environment comes from Render, and nothing
 * personal leaves the server: no default PII, and every event goes through the same masking as the logs.
 */
export const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || "";
export const sentryEnabled = () => Boolean(SENTRY_DSN);
export const RELEASE = process.env.RENDER_GIT_COMMIT || process.env.NEXT_PUBLIC_GIT_COMMIT || undefined;
export const ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || (process.env.RENDER ? "production" : process.env.NODE_ENV || "development");

export function sentryOptions() {
  return {
    dsn: SENTRY_DSN,
    enabled: sentryEnabled(),
    release: RELEASE,
    environment: ENVIRONMENT,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: (event: ErrorEvent) => scrubEvent(event as unknown as Record<string, unknown>) as unknown as ErrorEvent,
    beforeBreadcrumb: (crumb: Breadcrumb) => {
      if (crumb.data) crumb.data = scrubEvent(crumb.data);
      if (crumb.message) crumb.message = String(scrubEvent({ message: crumb.message }).message);
      return crumb;
    },
  };
}
