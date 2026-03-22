"use client";

import { forwardRef } from "react";
import { motion } from "framer-motion";
import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type MotionButtonProps = React.ComponentPropsWithoutRef<typeof motion.button>;

interface ButtonProps extends Omit<MotionButtonProps, "children"> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: Icon;
  iconPosition?: "left" | "right";
  isLoading?: boolean;
  children: React.ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-zinc-950";

const variants = {
  primary: "bg-primary text-white hover:bg-primary-dark active:bg-primary-dark",
  secondary:
    "bg-primary-lighter text-primary-dark hover:bg-primary-muted dark:bg-primary-muted dark:text-primary-dark dark:hover:bg-primary-lighter",
  outline:
    "border border-[var(--border-strong)] bg-transparent hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800",
  ghost: "bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800",
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
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <>
          {Icon && iconPosition === "left" && <Icon className="h-4 w-4" weight="regular" aria-hidden />}
          {children}
          {Icon && iconPosition === "right" && <Icon className="h-4 w-4" weight="regular" aria-hidden />}
        </>
      )}
    </motion.button>
  )
);

Button.displayName = "Button";
