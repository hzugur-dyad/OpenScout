"use client";

import type { ReactNode } from "react";
import { Briefcase, Inbox, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Serializable icon key so Server Components can render EmptyState (no passing Lucide components across the RSC boundary). */
const EMPTY_STATE_ICONS = {
  briefcase: Briefcase,
  inbox: Inbox,
  messageCircle: MessageCircle,
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
