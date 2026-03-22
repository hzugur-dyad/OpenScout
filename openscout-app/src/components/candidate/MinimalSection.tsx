"use client";

import { motion } from "framer-motion";
import { useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Minimalist-ui: fade + 12px rise, 600ms, cubic-bezier(0.16, 1, 0.3, 1). IntersectionObserver via Framer viewport. */
const editorialEase: [number, number, number, number] = [0.16, 1, 0.3, 1];

function subscribePrefersReducedMotion(onChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getPrefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** SSR + first paint must match client hydration; real preference applies after hydrate. */
function getPrefersReducedMotionServerSnapshot(): boolean {
  return false;
}

export function MinimalSection({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useSyncExternalStore(
    subscribePrefersReducedMotion,
    getPrefersReducedMotion,
    getPrefersReducedMotionServerSnapshot
  );
  return (
    <motion.div
      className={cn(className)}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-48px" }}
      transition={
        reduceMotion ? { duration: 0 } : { duration: 0.6, ease: editorialEase, delay }
      }
    >
      {children}
    </motion.div>
  );
}
