import * as Sentry from "@sentry/nextjs";
import { resolveSentryDsnForRuntime } from "./sentry.resolve-dsn";

const dsn = resolveSentryDsnForRuntime();

Sentry.init({
  dsn,
  environment: process.env.NODE_ENV,
  tracesSampleRate: dsn ? (process.env.NODE_ENV === "production" ? 0.1 : 0) : 0,
});
