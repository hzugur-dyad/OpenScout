"use client";

import { memo } from "react";
import { motion } from "framer-motion";

export type AiOrbState = "idle" | "listening" | "thinking" | "speaking";

type AiOrbProps = {
  state?: AiOrbState;
  className?: string;
  /** Optional: 0–1 for audio reactivity when speaking. Falls back to rhythmic animation if not provided. */
  audioLevel?: number;
};

const orbStyle = {
  background: "radial-gradient(circle at 30% 30%, var(--primary-lighter), var(--primary-light) 40%, var(--primary) 70%, var(--primary-dark))",
  boxShadow: [
    "0 0 60px 20px color-mix(in srgb, var(--primary) 35%, transparent)",
    "0 0 100px 40px color-mix(in srgb, var(--primary) 20%, transparent)",
    "inset 0 0 40px color-mix(in srgb, white 15%, transparent)",
  ].join(", "),
};

function AiOrbInner({ state = "idle", className = "", audioLevel }: AiOrbProps) {
  const hasAudioLevel = typeof audioLevel === "number";

  return (
    <div
      className={`relative flex items-center justify-center w-[220px] h-[220px] max-sm:w-[160px] max-sm:h-[160px] flex-shrink-0 ${className}`}
      aria-hidden
    >
      <motion.div
        className="absolute rounded-full will-change-transform w-full h-full max-w-[220px] max-h-[220px] max-sm:max-w-[160px] max-sm:max-h-[160px]"
        style={orbStyle}
        animate={
          state === "idle"
            ? { scale: [1, 1.05, 1] }
            : state === "listening"
              ? { scale: [1, 1.08, 1.02, 1.08] }
              : state === "thinking"
                ? { rotate: 360, scale: [1, 1.03, 1] }
                : state === "speaking"
                  ? hasAudioLevel
                    ? { scale: 1 + Math.min(0.15, audioLevel * 0.2) }
                    : { scale: [1, 1.12, 0.98, 1.1, 1] }
                  : {}
        }
        transition={
          state === "idle"
            ? { duration: 2.5, repeat: Infinity, ease: "easeInOut" }
            : state === "listening"
              ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
              : state === "thinking"
                ? {
                    rotate: { duration: 8, repeat: Infinity, ease: "linear" },
                    scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                  }
                : state === "speaking"
                  ? hasAudioLevel
                    ? { duration: 0.1 }
                    : { duration: 0.6, repeat: Infinity, ease: "easeInOut" }
                  : {}
        }
      />
    </div>
  );
}

export const AiOrb = memo(AiOrbInner);
