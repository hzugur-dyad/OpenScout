"use client";

import { useEffect, useState } from "react";

/**
 * Animates from 0 to target over durationMs (ease-out cubic).
 */
export function useCountUp(target: number, durationMs = 1400, enabled = true): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setValue(Math.round(target));
      return;
    }
    const end = Math.round(Math.min(100, Math.max(0, target)));
    let raf = 0;
    const t0 = performance.now();

    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / durationMs);
      const eased = 1 - (1 - p) ** 3;
      setValue(Math.round(end * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, enabled]);

  return value;
}
