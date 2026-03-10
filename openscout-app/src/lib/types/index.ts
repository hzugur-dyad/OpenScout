/** Scout credential / Scout Pass */

export type ScoutPassReport = {
  strengths?: string[];
  improvements?: string[];
};

export type ScoutPassData = {
  job_category: string;
  cv_score: number | null;
  interview_score: number | null;
  report: ScoutPassReport;
  display_name: string | null;
  created_at?: string;
};

export type ScoutCredentialCreateBody = {
  jobCategory: string;
  cvScore?: number;
  interviewScore: number;
  report: ScoutPassReport;
};

export type ScoutCredentialResponse = {
  slug: string;
  passUrl: string;
};

/** Referral */

export type ReferralMyCodeResponse = {
  code: string;
  referredCount?: number;
};

export type ReferralAttributeBody = {
  code: string;
};

/** Employer / Stripe */

export type EmployerVerifySessionBody = {
  session_id: string;
};
