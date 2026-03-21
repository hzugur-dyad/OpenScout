import { Suspense } from "react";
import { MockInterviewProcessingSkeleton } from "@/components/ui/Skeleton";
import { interviewUi } from "@/lib/interview-locale";
import { MockInterviewResultLoadingClient } from "@/components/mock-interview/MockInterviewResultLoadingClient";

function LoadingFallbackEn() {
  const ui = interviewUi.en;
  return (
    <div className="mx-auto max-w-2xl py-4">
      <MockInterviewProcessingSkeleton title={ui.loadingResults} subtitle={ui.processingSubtitle} />
    </div>
  );
}

export default function MockInterviewResultLoading() {
  return (
    <Suspense fallback={<LoadingFallbackEn />}>
      <MockInterviewResultLoadingClient />
    </Suspense>
  );
}
