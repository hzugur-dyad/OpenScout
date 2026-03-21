/**
 * Lightweight “what’s next” hints from existing data only (no new DB fields).
 */

export type JourneySignals = {
  profileComplete: boolean;
  hasCv: boolean;
  hasCvAnalysis: boolean;
  hasInterview: boolean;
  hasApplication: boolean;
};

export type NextStepCardModel = {
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
};

function cvOnFile(cvFileUrl?: string | null, cvRawText?: string | null): boolean {
  const u = cvFileUrl != null && String(cvFileUrl).trim() !== "";
  const t = cvRawText != null && String(cvRawText).trim() !== "";
  return u || t;
}

/** Build flags from Supabase row shapes (client or server). */
export function buildJourneySignals(input: {
  onboardingCompletedAt: string | null | undefined;
  cvFileUrl?: string | null;
  cvRawText?: string | null;
  cvAnalysisRowExists: boolean;
  mockInterviewRowExists: boolean;
  jobApplicationRowExists: boolean;
}): JourneySignals {
  return {
    profileComplete: !!input.onboardingCompletedAt,
    hasCv: cvOnFile(input.cvFileUrl, input.cvRawText),
    hasCvAnalysis: input.cvAnalysisRowExists,
    hasInterview: input.mockInterviewRowExists,
    hasApplication: input.jobApplicationRowExists,
  };
}

/**
 * Ordered funnel: profile → CV file → analysis → interview → apply.
 * `hasApplication` is kept on signals for future use; the card always ends at “apply” once prior steps are done.
 */
export function deriveDashboardNextStep(s: JourneySignals): NextStepCardModel {
  if (!s.profileComplete) {
    return {
      title: "Complete your profile",
      description: "Add your details once so applications and interviews can use them.",
      href: "/onboarding",
      ctaLabel: "Complete profile",
    };
  }
  if (!s.hasCv) {
    return {
      title: "Upload your CV",
      description: "Add a PDF or TXT to your profile so we can score and match you to roles.",
      href: "/onboarding",
      ctaLabel: "Upload CV",
    };
  }
  if (!s.hasCvAnalysis) {
    return {
      title: "Analyze your CV",
      description: "Run AI analysis to get feedback and unlock interview prep aligned with your background.",
      href: "/cv-analysis",
      ctaLabel: "Analyze CV",
    };
  }
  if (!s.hasInterview) {
    return {
      title: "Take your first AI interview",
      description: "Practice with Nova and get a scored report you can share with employers.",
      href: "/mock-interview",
      ctaLabel: "Start interview",
    };
  }
  return {
    title: "Apply to jobs",
    description: "You’re set up—browse listings and submit applications with your CV and interview scores.",
    href: "/dashboard/jobs",
    ctaLabel: "Browse jobs",
  };
}
