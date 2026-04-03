"use client";

import type { ButtonHTMLAttributes, SVGProps } from "react";
import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

function MenuLinesIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
      {...props}
    >
      <path
        d="M5 7.5H19"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M7 12H19"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M5 16.5H17"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

type MobileNavToggleButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: "menu" | "close";
};

export function MobileNavToggleButton({
  className,
  icon = "menu",
  type = "button",
  ...props
}: MobileNavToggleButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-black/10 bg-white/70 text-zinc-900 shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-md transition-[background-color,border-color,color,box-shadow,transform] duration-200 hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.98] dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-100 dark:hover:bg-white/[0.1]",
        className
      )}
      {...props}
    >
      {icon === "close" ? (
        <X className="h-[1.05rem] w-[1.05rem]" weight="regular" aria-hidden />
      ) : (
        <MenuLinesIcon className="h-[1.05rem] w-[1.05rem]" />
      )}
    </button>
  );
}
