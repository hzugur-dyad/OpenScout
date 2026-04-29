import posthog from "posthog-js";
import {
  marketingTrackingConfigured,
  readMarketingConsent,
} from "@/lib/marketing-consent";

/** Canonical PostHog event names — use these everywhere to avoid duplicates. */
export const ANALYTICS_EVENTS = {
  auth_signup_started: "auth_signup_started",
  auth_signup_completed: "auth_signup_completed",
  email_confirmed: "email_confirmed",
  onboarding_completed: "onboarding_completed",
  cv_analysis_started: "cv_analysis_started",
  cv_analysis_completed: "cv_analysis_completed",
  cv_analysis_failed: "cv_analysis_failed",
  interview_started: "interview_started",
  interview_completed: "interview_completed",
  interview_too_short: "interview_too_short",
  report_viewed: "report_viewed",
  application_started: "application_started",
  application_completed: "application_completed",
  employer_job_created: "employer_job_created",
  employer_received_application: "employer_received_application",
  pricing_viewed: "pricing_viewed",
  upgrade_clicked: "upgrade_clicked",
  checkout_started: "checkout_started",
  purchase_completed: "purchase_completed",
  subscription_started: "subscription_started",
  subscription_active: "subscription_active",
  subscription_failed: "subscription_failed",
  /** User copied or used native share for a public interview result link */
  result_shared: "result_shared",
  /** SEO job page CTA → mock interview (job = URL slug, page_type = route segment) */
  seo_cta_clicked: "seo_cta_clicked",
  /** Candidate shared public profile link (role = target/open category, best_score = top Scout score) */
  public_profile_shared: "public_profile_shared",
  /** Scout Pass link copied or shared (channel = copy_link | native | linkedin | twitter | modal_copy) */
  scout_pass_shared: "scout_pass_shared",
  /** Candidate copied invite link from dashboard */
  referral_link_copied: "referral_link_copied",
  /** Referred user attributed to a referrer (no PII in properties) */
  referral_attributed: "referral_attributed",
  /** Referred user met onboarding + qualifying interview; about to grant rewards */
  referral_qualified: "referral_qualified",
  /** Bonus credits granted to referrer and/or referred (see properties.role) */
  referral_rewarded: "referral_rewarded",
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

type TrackClientOptions = {
  posthog?: boolean;
  marketing?: boolean;
};

type BrowserAnalyticsWindow = Window &
  typeof globalThis & {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    hj?: (...args: unknown[]) => void;
  };

const PURCHASE_VALUES_BY_PLAN: Partial<Record<string, number>> = {
  plus: 9.99,
  pro: 19.99,
  growth: 99,
  scale: 149,
};

function getBrowserWindow(): BrowserAnalyticsWindow | null {
  if (typeof window === "undefined") return null;
  return window as BrowserAnalyticsWindow;
}

function getGoogleAnalyticsEventName(event: AnalyticsEventName): string {
  switch (event) {
    case ANALYTICS_EVENTS.auth_signup_completed:
      return "sign_up";
    case ANALYTICS_EVENTS.checkout_started:
      return "begin_checkout";
    case ANALYTICS_EVENTS.purchase_completed:
      return "purchase";
    case ANALYTICS_EVENTS.report_viewed:
      return "view_item";
    case ANALYTICS_EVENTS.upgrade_clicked:
      return "select_item";
    default:
      return event;
  }
}

function getMetaPixelEventName(event: AnalyticsEventName): string | null {
  switch (event) {
    case ANALYTICS_EVENTS.auth_signup_completed:
      return "CompleteRegistration";
    case ANALYTICS_EVENTS.checkout_started:
      return "InitiateCheckout";
    case ANALYTICS_EVENTS.purchase_completed:
      return "Purchase";
    case ANALYTICS_EVENTS.report_viewed:
      return "ViewContent";
    default:
      return null;
  }
}

function getGoogleAdsConversionLabel(event: AnalyticsEventName): string | null {
  switch (event) {
    case ANALYTICS_EVENTS.auth_signup_completed:
      return process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_CONVERSION_LABEL ?? null;
    case ANALYTICS_EVENTS.checkout_started:
      return process.env.NEXT_PUBLIC_GOOGLE_ADS_CHECKOUT_CONVERSION_LABEL ?? null;
    case ANALYTICS_EVENTS.purchase_completed:
      return process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_CONVERSION_LABEL ?? null;
    default:
      return null;
  }
}

function coerceAnalyticsValue(properties?: Record<string, unknown>): number | undefined {
  const raw = properties?.value;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const plan = typeof properties?.plan === "string" ? properties.plan.toLowerCase() : null;
  return plan ? PURCHASE_VALUES_BY_PLAN[plan] : undefined;
}

function buildMarketingProperties(
  event: AnalyticsEventName,
  properties?: Record<string, unknown>
): Record<string, unknown> {
  const value = coerceAnalyticsValue(properties);
  return {
    ...properties,
    event_name: event,
    ...(value !== undefined ? { value } : {}),
    ...(event === ANALYTICS_EVENTS.purchase_completed && value !== undefined
      ? { currency: "USD" }
      : {}),
  };
}

function dispatchMarketingEvent(
  event: AnalyticsEventName,
  properties?: Record<string, unknown>
): void {
  if (!marketingTrackingConfigured()) return;
  if (readMarketingConsent() !== "granted") return;

  const win = getBrowserWindow();
  if (!win) return;

  const marketingProperties = buildMarketingProperties(event, properties);
  const gaEventName = getGoogleAnalyticsEventName(event);
  if (typeof win.gtag === "function") {
    win.gtag("event", gaEventName, marketingProperties);

    const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
    const adsLabel = getGoogleAdsConversionLabel(event);
    if (adsId && adsLabel) {
      win.gtag("event", "conversion", {
        send_to: `${adsId}/${adsLabel}`,
        ...marketingProperties,
      });
    }
  }

  const metaPixelEventName = getMetaPixelEventName(event);
  if (metaPixelEventName && typeof win.fbq === "function") {
    win.fbq("track", metaPixelEventName, marketingProperties);
  }

  if (typeof win.hj === "function") {
    win.hj("event", event);
  }
}

/**
 * Browser-only capture. Safe to call from client components; no-ops when PostHog is not configured.
 * Server routes must use `captureServer` from `@/lib/analytics-server` instead.
 */
export function trackClient(
  event: AnalyticsEventName,
  properties?: Record<string, unknown>,
  options?: TrackClientOptions
): void {
  if (typeof window === "undefined") return;
  const posthogEnabled = options?.posthog !== false;
  const marketingEnabled = options?.marketing !== false;

  if (posthogEnabled && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthog.capture(event, properties);
  }

  if (marketingEnabled) {
    dispatchMarketingEvent(event, properties);
  }
}
