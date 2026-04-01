"use client";

import { MockInterviewProcessingSkeleton } from "@/components/ui/Skeleton";
import { interviewUi } from "@/lib/interview-locale";

export function MockInterviewResultLoadingClient() {
  const ui = interviewUi.en;

  return (
    <div className="mx-auto max-w-2xl py-4">
      <MockInterviewProcessingSkeleton title={ui.loadingResults} subtitle={ui.processingSubtitle} />
    </div>
  );
}
