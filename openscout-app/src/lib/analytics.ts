import posthog from "posthog-js";

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
  application_started: "application_started",
  application_completed: "application_completed",
  employer_job_created: "employer_job_created",
  employer_received_application: "employer_received_application",
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

/**
 * Browser-only capture. Safe to call from client components; no-ops when PostHog is not configured.
 * Server routes must use `captureServer` from `@/lib/analytics-server` instead.
 */
export function trackClient(
  event: AnalyticsEventName,
  properties?: Record<string, unknown>
): void {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  posthog.capture(event, properties);
}
