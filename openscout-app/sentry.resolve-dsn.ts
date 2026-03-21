/**
 * DSN resolution for Node + Edge Sentry init (not imported by client config).
 * Prefer SENTRY_DSN; fall back to NEXT_PUBLIC_SENTRY_DSN so either env works at runtime.
 */
export function resolveSentryDsnForRuntime(): string | undefined {
  const d = (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || "").trim();
  return d || undefined;
}
