"use client";

import { forwardRef } from "react";
import { motion } from "framer-motion";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type MotionButtonProps = React.ComponentPropsWithoutRef<typeof motion.button>;

/** Lucide or Phosphor icons (both accept `className` on the rendered SVG). */
export type ButtonIcon = LucideIcon | PhosphorIcon;

interface ButtonProps extends Omit<MotionButtonProps, "children"> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "charcoal";
  size?: "sm" | "md" | "lg";
  icon?: ButtonIcon;
  iconPosition?: "left" | "right";
  isLoading?: boolean;
  children: React.ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-black";

const variants = {
  primary: "bg-primary text-white hover:bg-primary-dark active:bg-primary-dark",
  secondary:
    "bg-primary-lighter text-primary-dark hover:bg-primary-muted dark:bg-primary-muted dark:text-primary-dark dark:hover:bg-primary-lighter",
  outline:
    "border border-[var(--border-strong)] bg-transparent hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-800",
  ghost: "bg-transparent hover:bg-gray-100 dark:hover:bg-zinc-800",
  charcoal:
    "rounded-md border border-transparent bg-[#111111] text-white shadow-none hover:bg-[#333333] active:bg-[#222222] focus-visible:ring-[#111111] dark:border-transparent dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-neutral-200 dark:active:bg-neutral-300 dark:focus-visible:ring-neutral-300",
};

const sizes = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-base",
  lg: "h-12 px-8 text-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      icon: Icon,
      iconPosition = "right",
      isLoading = false,
      children,
      className,
      disabled,
      ...props
    },
    ref
  ) => (
    <motion.button
      ref={ref}
      whileTap={disabled || isLoading ? undefined : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <>
          {Icon && iconPosition === "left" && <Icon className="h-4 w-4" />}
          {children}
          {Icon && iconPosition === "right" && <Icon className="h-4 w-4" />}
        </>
      )}
    </motion.button>
  )
);

Button.displayName = "Button";
