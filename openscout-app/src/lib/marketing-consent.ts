export const MARKETING_CONSENT_STORAGE_KEY = "openscout.marketing-consent";

export type MarketingConsentState = "granted" | "denied" | "unknown";

export function marketingTrackingConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID ||
      process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ||
      process.env.NEXT_PUBLIC_META_PIXEL_ID ||
      process.env.NEXT_PUBLIC_HOTJAR_ID
  );
}

export function readMarketingConsent(): MarketingConsentState {
  if (typeof window === "undefined") return "unknown";
  const stored = window.localStorage.getItem(MARKETING_CONSENT_STORAGE_KEY);
  if (stored === "granted" || stored === "denied") return stored;
  return "unknown";
}

export function writeMarketingConsent(next: Exclude<MarketingConsentState, "unknown">): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MARKETING_CONSENT_STORAGE_KEY, next);
}
