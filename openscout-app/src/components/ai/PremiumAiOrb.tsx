"use client";

import { memo } from "react";
import { motion } from "framer-motion";

export type PremiumAiOrbState = "idle" | "listening" | "thinking" | "speaking";

type PremiumAiOrbProps = {
  state?: PremiumAiOrbState;
  className?: string;
};

const CORE_GRADIENT =
  "radial-gradient(circle, #FFD86B 0%, #F4B942 40%, #D99A1A 80%)";
const CORE_GLOW = "0 0 40px rgba(255, 216, 107, 0.6)";
const HALO_COLOR = "rgba(255, 200, 80, 0.5)";
const RING_COLOR = "rgba(255, 200, 80, 0.3)";

function PremiumAiOrbInner({ state = "idle", className = "" }: PremiumAiOrbProps) {
  return (
    <div
      className={`relative flex h-[220px] w-[220px] max-sm:h-[160px] max-sm:w-[160px] flex-shrink-0 items-center justify-center ${className}`}
      aria-hidden
    >
      {/* Layer 2 — Halo Glow (behind core, so render first) */}
      <motion.div
        className="absolute inset-0 rounded-full will-change-transform"
        style={{
          background: HALO_COLOR,
          filter: "blur(40px)",
          opacity: 0.6,
          transformOrigin: "center",
        }}
        animate={
          state === "thinking"
            ? { rotate: 360, scale: [1.15, 1.2, 1.15] }
            : { scale: 1.15 }
        }
        transition={
          state === "thinking"
            ? {
                rotate: { duration: 8, repeat: Infinity, ease: "linear" },
                scale: { duration: 4, repeat: Infinity, ease: "easeInOut" },
              }
            : { duration: 0.3 }
        }
      />

      {/* Layer 1 — Core */}
      <motion.div
        className="absolute inset-0 rounded-full will-change-transform"
        style={{
          background: CORE_GRADIENT,
          boxShadow: CORE_GLOW,
          transformOrigin: "center",
        }}
        animate={
          state === "idle"
            ? { scale: [1, 1.05, 1] }
            : state === "listening"
              ? { scale: [1, 1.08, 1] }
              : state === "thinking"
                ? { scale: [1, 1.03, 1] }
                : state === "speaking"
                  ? { scale: [1, 1.12, 1] }
                  : {}
        }
        transition={
          state === "idle"
            ? { duration: 4, repeat: Infinity, ease: "easeInOut" }
            : state === "listening"
              ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
              : state === "thinking"
                ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
                : state === "speaking"
                  ? { duration: 0.8, repeat: Infinity, ease: "easeInOut" }
                  : {}
        }
      />

      {/* Layer 3 — Energy Ring */}
      <motion.div
        className="absolute inset-0 rounded-full border-2 will-change-transform"
        style={{
          borderColor: RING_COLOR,
          transformOrigin: "center",
          pointerEvents: "none",
        }}
        animate={
          state === "speaking"
            ? { scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }
            : state === "thinking"
              ? { opacity: [0.5, 0.8, 0.5] }
              : {}
        }
        transition={
          state === "speaking"
            ? { duration: 0.8, repeat: Infinity, ease: "easeInOut" }
            : state === "thinking"
              ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
              : {}
        }
      />
    </div>
  );
}

export const PremiumAiOrb = memo(PremiumAiOrbInner);
