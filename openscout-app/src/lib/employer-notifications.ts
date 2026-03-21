import { logInfo } from "@/lib/logger";

/**
 * Placeholder for transactional email (e.g. Resend). Logs in development; extend when API keys exist.
 */
export function notifyEmployerNewApplication(opts: {
  employerUserId: string;
  jobId: string;
  applicantUserId: string;
}): void {
  logInfo("employer notification: new application (email not configured)", {
    employer_user_id: opts.employerUserId,
    job_id: opts.jobId,
    applicant_user_id: opts.applicantUserId,
  });
}
