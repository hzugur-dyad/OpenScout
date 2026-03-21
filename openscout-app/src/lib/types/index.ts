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
  /** Users who signed up with your link (attributed). */
  referredCount?: number;
  /** Referred users who finished onboarding + a qualifying interview; rewards granted. */
  successfulReferralsCount?: number;
  /** Spendable bonus mock interviews (referrals and other sources). */
  bonusInterviewCreditsBalance?: number;
};

export type ReferralAttributeBody = {
  code: string;
};

/** Employer / Stripe */

export type EmployerVerifySessionBody = {
  session_id: string;
};
