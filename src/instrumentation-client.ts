// Sentry in the browser. Next loads this file before the app's client code. The DSN reaches the browser as
// NEXT_PUBLIC_SENTRY_DSN (next.config.ts copies SENTRY_DSN into it at build time); with none, nothing is set up.
import * as Sentry from "@sentry/nextjs";
import { sentryEnabled, sentryOptions } from "@/lib/sentry";

if (sentryEnabled()) Sentry.init({ ...sentryOptions(), replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 0 });

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
