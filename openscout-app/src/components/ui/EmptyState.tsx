"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
  children?: ReactNode;
};

export function EmptyState({ icon: Icon, title, description, className, children }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-[10px] border border-dashed border-[var(--border)] bg-white/60 px-8 py-12 text-center dark:border-white/[0.08] dark:bg-zinc-900/40",
        className
      )}
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full"
        style={{ backgroundColor: "var(--primary-muted)" }}
      >
        <Icon className="h-7 w-7" style={{ color: "var(--primary-dark)" }} aria-hidden />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-gray-900 dark:text-zinc-100">{title}</h3>
      {description && (
        <p className="mt-2 max-w-md text-sm text-gray-500 dark:text-zinc-400">{description}</p>
      )}
      {children && <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{children}</div>}
    </div>
  );
}
