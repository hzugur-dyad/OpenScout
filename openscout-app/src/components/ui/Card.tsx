"use client";

import { forwardRef } from "react";
import { motion } from "framer-motion";
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

const CardInteractive = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof motion.div>
>(({ className, ...props }, ref) => (
  <motion.div
    ref={ref}
    whileHover={{ y: -2 }}
    whileTap={{ scale: 0.99 }}
    transition={{ type: "spring", stiffness: 400, damping: 25 }}
    className={cn(
      "cursor-pointer rounded-xl border border-[var(--border)] bg-white shadow-soft transition-shadow hover:shadow-card dark:border-white/[0.06] dark:bg-zinc-900",
      className
    )}
    {...props}
  />
));
CardInteractive.displayName = "CardInteractive";

export { Card, CardInteractive };
