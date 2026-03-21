import path from "node:path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Turbopack: proje kökünü bu uygulama klasörü yap (üstteki lockfile yüzünden root yanlış seçilmesin)
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Client bundle inlines NEXT_PUBLIC_* at build time. Set NEXT_PUBLIC_SENTRY_DSN for build,
  // or SENTRY_DSN at build so it maps through; runtime-only SENTRY_DSN still fixes server,
  // but the client needs one of these available when `next build` runs.
  env: {
    NEXT_PUBLIC_SENTRY_DSN: (
      process.env.NEXT_PUBLIC_SENTRY_DSN ||
      process.env.SENTRY_DSN ||
      ""
    ).trim(),
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
