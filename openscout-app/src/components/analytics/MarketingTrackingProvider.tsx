"use client";

import Script from "next/script";
import { type ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  marketingTrackingConfigured,
  readMarketingConsent,
  type MarketingConsentState,
  writeMarketingConsent,
} from "@/lib/marketing-consent";

function MarketingConsentBanner({
  consent,
  onChange,
}: {
  consent: MarketingConsentState;
  onChange: (next: "granted" | "denied") => void;
}) {
  if (consent !== "unknown") return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-[120] mx-auto max-w-3xl rounded-[10px] border border-black/10 bg-white/95 p-4 shadow-lg backdrop-blur dark:border-white/10 dark:bg-zinc-950/92">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Marketing analytics</p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            Allow GA4, Google Ads, Meta Pixel, and Hotjar so OpenScout can measure acquisition and checkout performance.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => onChange("denied")}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => onChange("granted")}
            className="rounded-lg bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}

export function MarketingTrackingProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const trackingEnabled = marketingTrackingConfigured();
  const ga4MeasurementId = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
  const googleAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const hotjarId = process.env.NEXT_PUBLIC_HOTJAR_ID;
  const hotjarSv = process.env.NEXT_PUBLIC_HOTJAR_SV ?? "6";
  const [consent, setConsent] = useState<MarketingConsentState>(
    trackingEnabled ? "unknown" : "denied"
  );

  useEffect(() => {
    if (!trackingEnabled) {
      setConsent("denied");
      return;
    }
    setConsent(readMarketingConsent());
  }, [trackingEnabled]);

  useEffect(() => {
    if (!trackingEnabled || consent !== "granted") return;

    const win = window as Window &
      typeof globalThis & {
        gtag?: (...args: unknown[]) => void;
        fbq?: (...args: unknown[]) => void;
      };
    const pagePath = `${pathname}${window.location.search || ""}`;

    if (typeof win.gtag === "function") {
      win.gtag("event", "page_view", {
        page_path: pagePath,
        page_title: document.title,
      });
    }

    if (typeof win.fbq === "function") {
      win.fbq("track", "PageView");
    }
  }, [consent, pathname, trackingEnabled]);

  const handleConsentChange = (next: "granted" | "denied") => {
    writeMarketingConsent(next);
    setConsent(next);
  };

  const primaryGtagId = ga4MeasurementId ?? googleAdsId;

  return (
    <>
      {trackingEnabled && consent === "granted" && primaryGtagId && (
        <>
          <Script
            id="openscout-gtag-loader"
            src={`https://www.googletagmanager.com/gtag/js?id=${primaryGtagId}`}
            strategy="afterInteractive"
          />
          <Script id="openscout-gtag-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              window.gtag = function(){window.dataLayer.push(arguments);};
              window.gtag('js', new Date());
              ${ga4MeasurementId ? `window.gtag('config', '${ga4MeasurementId}', { send_page_view: false });` : ""}
              ${googleAdsId ? `window.gtag('config', '${googleAdsId}');` : ""}
            `}
          </Script>
        </>
      )}

      {trackingEnabled && consent === "granted" && metaPixelId && (
        <>
          <Script id="openscout-meta-pixel" strategy="afterInteractive">
            {`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${metaPixelId}');
            `}
          </Script>
          <noscript>
            <img
              alt=""
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      )}

      {trackingEnabled && consent === "granted" && hotjarId && (
        <Script id="openscout-hotjar" strategy="afterInteractive">
          {`
            (function(h,o,t,j,a,r){
              h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
              h._hjSettings={hjid:${JSON.stringify(hotjarId)},hjsv:${JSON.stringify(hotjarSv)}};
              a=o.getElementsByTagName('head')[0];
              r=o.createElement('script');r.async=1;
              r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
              a.appendChild(r);
            })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
          `}
        </Script>
      )}

      {children}
      {trackingEnabled && (
        <MarketingConsentBanner consent={consent} onChange={handleConsentChange} />
      )}
    </>
  );
}
