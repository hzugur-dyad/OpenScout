import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: dsn || undefined,
  environment: process.env.NODE_ENV,
  tracesSampleRate: dsn ? (process.env.NODE_ENV === "production" ? 0.1 : 0) : 0,
  integrations: [Sentry.browserTracingIntegration()],
});
