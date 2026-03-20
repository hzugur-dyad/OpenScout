import "server-only";

import { PostHog } from "posthog-node";
import type { AnalyticsEventName } from "@/lib/analytics";

let posthogInstance: PostHog | null = null;

function getPostHog(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? process.env.POSTHOG_KEY;
  const host =
    process.env.NEXT_PUBLIC_POSTHOG_HOST ??
    process.env.POSTHOG_HOST ??
    "https://us.i.posthog.com";
  if (!key) return null;
  if (!posthogInstance) {
    posthogInstance = new PostHog(key, { host, flushAt: 1, flushInterval: 0 });
  }
  return posthogInstance;
}

/** Use only from API routes / server code. */
export async function captureServer(
  distinctId: string,
  event: AnalyticsEventName,
  properties?: Record<string, unknown>
): Promise<void> {
  const ph = getPostHog();
  if (!ph) return;
  try {
    ph.capture({ distinctId, event, properties: properties ?? {} });
    await ph.flush();
  } catch {
    // Never break product flows on analytics failures
  }
}
