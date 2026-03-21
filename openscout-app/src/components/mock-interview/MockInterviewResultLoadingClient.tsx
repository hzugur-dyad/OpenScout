"use client";

import { useSearchParams } from "next/navigation";
import { MockInterviewProcessingSkeleton } from "@/components/ui/Skeleton";
import { interviewUi, parseInterviewLocale } from "@/lib/interview-locale";

export function MockInterviewResultLoadingClient() {
  const searchParams = useSearchParams();
  const langRaw = searchParams.get("lang");
  const locale = parseInterviewLocale(langRaw);
  const ui = interviewUi[locale];

  return (
    <div className="mx-auto max-w-2xl py-4">
      <MockInterviewProcessingSkeleton title={ui.loadingResults} subtitle={ui.processingSubtitle} />
    </div>
  );
}
