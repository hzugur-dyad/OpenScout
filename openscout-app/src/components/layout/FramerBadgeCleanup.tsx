"use client";

import { useEffect } from "react";

export function FramerBadgeCleanup() {
  useEffect(() => {
    const removeElement = () => {
      const target = document.getElementById("__framer-badge-container");
      if (target) target.remove();

      document
        .querySelectorAll('[id*="framer-badge"], [id*="__framer-badge"], .framer-badge')
        .forEach((el) => el.remove());
    };

    removeElement();

    const interval = setInterval(removeElement, 500);
    const timeout = setTimeout(() => clearInterval(interval), 4000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  return null;
}
