import { beforeEach, describe, expect, it, vi } from "vitest";

const posthogCapture = vi.fn();

vi.mock("posthog-js", () => ({
  default: {
    capture: posthogCapture,
  },
}));

describe("trackClient", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    delete (
      window as Window & typeof globalThis & { gtag?: unknown; fbq?: unknown; hj?: unknown }
    ).gtag;
    delete (
      window as Window & typeof globalThis & { gtag?: unknown; fbq?: unknown; hj?: unknown }
    ).fbq;
    delete (
      window as Window & typeof globalThis & { gtag?: unknown; fbq?: unknown; hj?: unknown }
    ).hj;

    process.env.NEXT_PUBLIC_POSTHOG_KEY = "ph_test";
    process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID = "G-TEST123";
    process.env.NEXT_PUBLIC_GOOGLE_ADS_ID = "AW-123456";
    process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_CONVERSION_LABEL = "purchase_label";
    process.env.NEXT_PUBLIC_META_PIXEL_ID = "123456789";
    process.env.NEXT_PUBLIC_HOTJAR_ID = "111111";
  });

  it("sends product analytics even when marketing consent is denied", async () => {
    window.localStorage.setItem("openscout.marketing-consent", "denied");
    const { ANALYTICS_EVENTS, trackClient } = await import("@/lib/analytics");

    const gtag = vi.fn();
    const fbq = vi.fn();
    (window as Window & typeof globalThis & { gtag?: typeof gtag; fbq?: typeof fbq }).gtag = gtag;
    (window as Window & typeof globalThis & { gtag?: typeof gtag; fbq?: typeof fbq }).fbq = fbq;

    trackClient(ANALYTICS_EVENTS.pricing_viewed, { surface: "candidate_pricing" });

    expect(posthogCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.pricing_viewed, {
      surface: "candidate_pricing",
    });
    expect(gtag).not.toHaveBeenCalled();
    expect(fbq).not.toHaveBeenCalled();
  });

  it("forwards purchase events to GA4, Google Ads, Meta, and Hotjar when consent is granted", async () => {
    window.localStorage.setItem("openscout.marketing-consent", "granted");
    const { ANALYTICS_EVENTS, trackClient } = await import("@/lib/analytics");

    const gtag = vi.fn();
    const fbq = vi.fn();
    const hj = vi.fn();
    (
      window as Window & typeof globalThis & { gtag?: typeof gtag; fbq?: typeof fbq; hj?: typeof hj }
    ).gtag = gtag;
    (
      window as Window & typeof globalThis & { gtag?: typeof gtag; fbq?: typeof fbq; hj?: typeof hj }
    ).fbq = fbq;
    (
      window as Window & typeof globalThis & { gtag?: typeof gtag; fbq?: typeof fbq; hj?: typeof hj }
    ).hj = hj;

    trackClient(
      ANALYTICS_EVENTS.purchase_completed,
      { scope: "candidate", plan: "pro" },
      { posthog: false }
    );

    expect(posthogCapture).not.toHaveBeenCalled();
    expect(gtag).toHaveBeenCalledWith("event", "purchase", {
      scope: "candidate",
      plan: "pro",
      event_name: ANALYTICS_EVENTS.purchase_completed,
      value: 19.99,
      currency: "USD",
    });
    expect(gtag).toHaveBeenCalledWith("event", "conversion", {
      send_to: "AW-123456/purchase_label",
      scope: "candidate",
      plan: "pro",
      event_name: ANALYTICS_EVENTS.purchase_completed,
      value: 19.99,
      currency: "USD",
    });
    expect(fbq).toHaveBeenCalledWith("track", "Purchase", {
      scope: "candidate",
      plan: "pro",
      event_name: ANALYTICS_EVENTS.purchase_completed,
      value: 19.99,
      currency: "USD",
    });
    expect(hj).toHaveBeenCalledWith("event", ANALYTICS_EVENTS.purchase_completed);
  });
});
