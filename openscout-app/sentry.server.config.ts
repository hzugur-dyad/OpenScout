import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

Sentry.init({
  dsn: dsn || undefined,
  environment: process.env.NODE_ENV,
  tracesSampleRate: dsn ? (process.env.NODE_ENV === "production" ? 0.1 : 0) : 0,
  integrations: [Sentry.httpIntegration()],
});
