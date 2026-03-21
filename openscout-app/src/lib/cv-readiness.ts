/** Shared CV readiness for mock interview + job apply (matches server `checkProfileAndCv` logic). */

const REQUIRED_PROFILE_FIELDS = ["first_name", "last_name", "email", "location"] as const;

export type ProfileBasics = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  location?: string | null;
} | null;

export type CvReadinessInput = {
  profile: ProfileBasics;
  cvFileUrl?: string | null;
  cvRawText?: string | null;
  /** True if the user has at least one row in `cv_analyses`. */
  hasCvAnalysisRow: boolean;
};

export type CvReadiness = {
  missingProfileFieldKeys: string[];
  profileComplete: boolean;
  hasUploadedCv: boolean;
  hasCvAnalysis: boolean;
  /** Profile OK and (uploaded CV text/file on file OR at least one analysis). Same as server `canApplyOrInterview`. */
  canAccessFlow: boolean;
  /** Uploaded CV on file but no analysis yet — prompt user to run analysis before interview. */
  needsCvAnalysisBeforeInterview: boolean;
};

export function computeCvReadiness(input: CvReadinessInput): CvReadiness {
  const missingProfileFieldKeys: string[] = [];
  for (const field of REQUIRED_PROFILE_FIELDS) {
    const v = input.profile?.[field];
    if (v === undefined || v === null || String(v).trim() === "") {
      missingProfileFieldKeys.push(field);
    }
  }
  const profileComplete = missingProfileFieldKeys.length === 0;
  const hasUploadedCv = hasUploadedCvMaterial(input.cvFileUrl, input.cvRawText);
  const hasCvAnalysis = input.hasCvAnalysisRow;
  const canAccessFlow = profileComplete && (hasUploadedCv || hasCvAnalysis);
  const needsCvAnalysisBeforeInterview = profileComplete && hasUploadedCv && !hasCvAnalysis;

  return {
    missingProfileFieldKeys,
    profileComplete,
    hasUploadedCv,
    hasCvAnalysis,
    canAccessFlow,
    needsCvAnalysisBeforeInterview,
  };
}

function hasUploadedCvMaterial(cvFileUrl?: string | null, cvRawText?: string | null): boolean {
  const url = cvFileUrl != null && String(cvFileUrl).trim() !== "";
  const raw = cvRawText != null && String(cvRawText).trim() !== "";
  return url || raw;
}

/** English UI copy for job apply (page is EN-only). Aligned with mock-interview messaging. */
export const CV_READINESS_COPY_EN = {
  applyGateTitle: "Profile and CV required",
  applyGateProfileHint: "Complete your profile (name, email, and location).",
  applyGateNoCvHint:
    "Upload a CV from your profile, or run CV analysis once with a file—either puts your résumé on file for applications and interviews.",
  applyStep1Title: "Step 1: CV analysis for this role",
  applyStep1Body:
    "We analyze your on-file CV against this job to check the minimum score. If you have not run analysis yet, this creates it for this listing.",
  applyAnalyzeButton: "Analyze my CV for this role",
  applyAnalyzingLabel: "Analyzing your CV against this position…",
} as const;
