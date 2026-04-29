"use client";

import { useEffect, useState } from "react";

const LIGHT_SRC = "https://courageous-customer-454833.framer.app/home";
const DARK_SRC = "https://courageous-customer-454833.framer.app/";

function resolveSrc() {
  if (typeof document === "undefined") return LIGHT_SRC;
  return document.documentElement.classList.contains("dark") ? DARK_SRC : LIGHT_SRC;
}

export function FramerBackgroundEmbed() {
  const [src, setSrc] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [frameVisible, setFrameVisible] = useState(false);

  useEffect(() => {
    let timeoutId: number | undefined;
    const rafId: number | undefined = window.requestAnimationFrame(() => {
      timeoutId = window.setTimeout(showEmbed, 60);
    });

    const showEmbed = () => {
      setSrc(resolveSrc());
      setReady(true);
    };

    // Paint a stable fallback immediately, then attach the iframe on next frame.
    const observer = new MutationObserver(() => {
      setSrc(resolveSrc());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
      if (timeoutId) window.clearTimeout(timeoutId);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    // Theme or source switch starts hidden again to avoid flashing partial frame.
    setFrameVisible(false);
  }, [src]);

  return (
    <div className="framer-wrapper">
      <div
        aria-hidden
        className="fixed inset-0 z-0 bg-[#f4f5f0] transition-opacity duration-500 dark:bg-[#09090b]"
        style={{ opacity: frameVisible ? 0 : 1 }}
      />
      {ready && src ? (
        <iframe
          src={src}
          title=""
          aria-hidden
          scrolling="no"
          className="pointer-events-none fixed inset-y-0 left-0 z-0 block h-full w-[calc(100%+20px)] border-0 transition-opacity duration-700"
          style={{ marginRight: "-20px", opacity: frameVisible ? 1 : 0 }}
          loading="eager"
          onLoad={() => {
            // Keep fallback briefly after load so user never sees intermediary frame paints.
            window.setTimeout(() => setFrameVisible(true), 220);
          }}
        />
      ) : null}
    </div>
  );
}
