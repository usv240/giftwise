// Sentry on the edge runtime (proxy, edge routes). Loaded by src/instrumentation.ts; no SENTRY_DSN, no init.
import * as Sentry from "@sentry/nextjs";
import { sentryEnabled, sentryOptions } from "@/lib/sentry";

if (sentryEnabled()) Sentry.init(sentryOptions());
