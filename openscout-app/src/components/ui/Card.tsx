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
      "rounded-xl border border-[var(--border)] bg-white shadow-soft dark:border-white/[0.06] dark:bg-zinc-900",
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
            : "cursor-pointer rounded-xl border border-[var(--border)] bg-white shadow-soft transition-shadow hover:shadow-card dark:border-white/[0.06] dark:bg-zinc-900",
          className
        )}
        {...props}
      />
    );
  }
);
CardInteractive.displayName = "CardInteractive";

export { Card, CardInteractive };
