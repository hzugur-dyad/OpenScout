"use client";

import { SocialCardSharePanel } from "@/components/share/SocialCardSharePanel";
import { CvAnalysisCard } from "@/components/share/SocialCards";

type Props = {
  role: string;
  score: number;
  insight: string;
  firstName?: string;
};

export function CvAnalysisShareCardSection({ role, score, insight, firstName }: Props) {
  return (
    <SocialCardSharePanel
      title="Share card"
      fileName="openscout-cv-analysis"
      shareText={`My OpenScout CV score: ${score}/100`}
    >
      <CvAnalysisCard role={role} score={score} insightLine={insight} firstName={firstName} />
    </SocialCardSharePanel>
  );
}
