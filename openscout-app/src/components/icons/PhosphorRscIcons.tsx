"use client";

import {
  ArrowSquareOut,
  Briefcase,
  CaretLeft,
  ChatCircle,
  Check,
  CheckCircle,
  FileMagnifyingGlass,
  WarningCircle,
} from "@phosphor-icons/react";

/** Thin wrappers so Server Components can render Phosphor icons without pulling createContext into the RSC bundle. */

export function RscCheckIcon({ className }: { className?: string }) {
  return <Check className={className} weight="regular" aria-hidden />;
}

export function RscBriefcaseIcon({ className }: { className?: string }) {
  return <Briefcase className={className} weight="regular" aria-hidden />;
}

export function RscBriefcaseBoldIcon({ className }: { className?: string }) {
  return <Briefcase className={className} weight="bold" aria-hidden />;
}

export function RscCaretLeftIcon({ className }: { className?: string }) {
  return <CaretLeft className={className} weight="regular" aria-hidden />;
}

export function RscCheckCircleIcon({ className }: { className?: string }) {
  return <CheckCircle className={className} weight="regular" aria-hidden />;
}

export function RscWarningCircleIcon({ className }: { className?: string }) {
  return <WarningCircle className={className} weight="regular" aria-hidden />;
}

export function RscArrowSquareOutIcon({ className }: { className?: string }) {
  return <ArrowSquareOut className={className} weight="regular" aria-hidden />;
}

export function RscChatCircleIcon({ className }: { className?: string }) {
  return <ChatCircle className={className} weight="regular" aria-hidden />;
}

export function RscFileMagnifyingGlassIcon({ className }: { className?: string }) {
  return <FileMagnifyingGlass className={className} weight="regular" aria-hidden />;
}
