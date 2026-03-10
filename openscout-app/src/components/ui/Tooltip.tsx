"use client";

import { ReactNode } from "react";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: "left" | "right" | "top" | "bottom";
  /** When true, tooltip is shown on hover (e.g. only when sidebar is collapsed) */
  enabled?: boolean;
}

export function Tooltip({
  content,
  children,
  side = "right",
  enabled = true,
}: TooltipProps) {
  if (!enabled) {
    return <>{children}</>;
  }

  const positionClasses = {
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  };

  return (
    <div className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-[100] whitespace-nowrap rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 dark:bg-zinc-700 ${positionClasses[side]}`}
      >
        {content}
      </span>
    </div>
  );
}
