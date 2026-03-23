"use client";

import type { ReactNode } from "react";
import { Briefcase, ChatCircle, Tray } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/** Serializable icon key so Server Components can render EmptyState (no passing component refs across the RSC boundary). */
const EMPTY_STATE_ICONS = {
  briefcase: Briefcase,
  inbox: Tray,
  messageCircle: ChatCircle,
} as const;

export type EmptyStateIconName = keyof typeof EMPTY_STATE_ICONS;

type EmptyStateProps = {
  iconName: EmptyStateIconName;
  title: string;
  description?: string;
  className?: string;
  children?: ReactNode;
};

export function EmptyState({ iconName, title, description, className, children }: EmptyStateProps) {
  const Icon = EMPTY_STATE_ICONS[iconName];
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed border-[var(--border-strong)] bg-white/80 px-8 py-14 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-sm dark:border-white/[0.14] dark:bg-zinc-900/50 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        className
      )}
    >
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl ring-1 ring-black/[0.04] dark:ring-white/[0.08]"
        style={{ backgroundColor: "var(--primary-muted)" }}
      >
        <Icon className="h-8 w-8" style={{ color: "var(--primary-dark)" }} weight="regular" aria-hidden />
      </div>
      <h3 className="mt-6 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h3>
      {description && (
        <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{description}</p>
      )}
      {children && <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{children}</div>}
    </div>
  );
}
