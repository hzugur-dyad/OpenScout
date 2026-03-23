"use client";

import { forwardRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const Card = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border border-[var(--border)] bg-white shadow-[0_1px_0_rgba(0,0,0,0.04),0_4px_14px_-4px_rgba(15,23,42,0.06)] dark:border-white/[0.1] dark:bg-zinc-900/90 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_28px_-8px_rgba(0,0,0,0.45)]",
      className
    )}
    {...props}
  />
));
Card.displayName = "Card";

type CardInteractiveProps = React.ComponentPropsWithoutRef<typeof motion.div> & {
  /** Ultra-flat bento card: 8px radius, no lift, hover shadow only (minimalist UI). */
  flat?: boolean;
};

const CardInteractive = forwardRef<HTMLDivElement, CardInteractiveProps>(
  ({ className, flat, ...props }, ref) => {
    const reduceMotion = useReducedMotion();
    return (
      <motion.div
        ref={ref}
        whileHover={reduceMotion || flat ? undefined : { y: -2 }}
        whileTap={reduceMotion ? undefined : { scale: flat ? 0.98 : 0.99 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className={cn(
          flat
            ? "cursor-pointer rounded-lg border border-[#EAEAEA] bg-[#FFFFFF] shadow-none transition-shadow duration-200 ease-out hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-white/[0.08] dark:bg-[#141414] dark:hover:shadow-[0_2px_8px_rgba(0,0,0,0.2)]"
            : "cursor-pointer rounded-xl border border-[var(--border)] bg-white shadow-[0_1px_0_rgba(0,0,0,0.04),0_4px_14px_-4px_rgba(15,23,42,0.06)] transition-[box-shadow,transform] hover:shadow-[0_8px_24px_-8px_rgba(15,23,42,0.1)] dark:border-white/[0.1] dark:bg-zinc-900/90 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_28px_-8px_rgba(0,0,0,0.45)] dark:hover:shadow-[0_12px_36px_-10px_rgba(0,0,0,0.55)]",
          className
        )}
        {...props}
      />
    );
  }
);
CardInteractive.displayName = "CardInteractive";

export { Card, CardInteractive };
