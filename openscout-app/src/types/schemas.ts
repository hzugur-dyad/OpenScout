import { z } from "zod";

/** Optional string id from JSON/form: empty or whitespace → undefined; invalid types → undefined */
const optionalTrimmedId = z.preprocess((v) => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}, z.string().min(1).max(200).optional());

// --- Candidate registration / profile payload (register + sessionStorage) ---

export const workExperienceEntrySchema = z.object({
  company_name: z.string(),
  job_title: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  employment_type: z.string(),
  location: z.string(),
  is_remote: z.boolean(),
  description: z.string(),
  highlights: z.array(z.string()),
});

export const educationEntrySchema = z.object({
  institution: z.string(),
  location: z.string(),
  degree_type: z.string(),
  field_of_study: z.string(),
  start_year: z.string(),
  end_year: z.string(),
  completed: z.boolean(),
});

export const candidateProfilePayloadSchema = z.object({
  first_name: z.string(),
  last_name: z.string(),
  location: z.string(),
  professional_summary: z.string(),
  work_experiences: z.array(workExperienceEntrySchema),
  educations: z.array(educationEntrySchema),
  job_search_status: z.string(),
  available_start: z.string(),
  domain: z.string(),
  linkedin: z.string(),
  github: z.string(),
  portfolio: z.string(),
});

export type WorkExperienceEntry = z.infer<typeof workExperienceEntrySchema>;
export type EducationEntry = z.infer<typeof educationEntrySchema>;
export type CandidateProfilePayload = z.infer<typeof candidateProfilePayloadSchema>;

/** Alias: full candidate registration payload shape */
export const candidateSchema = candidateProfilePayloadSchema;
export type CandidateRegistration = z.infer<typeof candidateSchema>;

// --- CV analysis (JSON POST body) ---

export const cvAnalysisJsonBodySchema = z.object({
  cvText: z.string().min(10, "CV text must be at least 10 characters"),
  jobCategory: z.string().trim().min(1, "jobCategory is required"),
  jobId: optionalTrimmedId,
});

export type CvAnalysisJsonBody = z.infer<typeof cvAnalysisJsonBodySchema>;

/** Multipart text fields only (file validated separately) */
export const cvAnalysisMultipartFieldsSchema = z.object({
  jobCategory: z.string().trim().min(1, "jobCategory is required"),
  jobId: optionalTrimmedId,
});

export type CvAnalysisMultipartFields = z.infer<typeof cvAnalysisMultipartFieldsSchema>;

// --- Job application ---

export const jobApplicationSchema = z.object({
  jobId: z.string().trim().min(1, "jobId is required"),
});

export type JobApplicationBody = z.infer<typeof jobApplicationSchema>;

/** PATCH /api/employer/applications/[applicationId] */
export const employerApplicationPatchSchema = z
  .object({
    status: z
      .enum([
        "applied",
        "screening",
        "shortlisted",
        "interviewing",
        "offer",
        "hired",
        "rejected",
      ])
      .optional(),
    notes: z.string().max(20_000).optional(),
  })
  .refine((d) => d.status !== undefined || d.notes !== undefined, {
    message: "At least one of status or notes is required",
  });

export type EmployerApplicationPatchBody = z.infer<typeof employerApplicationPatchSchema>;

// --- Mock interview chat request ---

export const interviewMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().max(100_000),
});

export const interviewControlSchema = z.object({
  questionId: z.string().trim().min(1).max(200),
  attemptCount: z.number().int().min(1).max(2),
});

export const interviewResponseSchema = z.object({
  messages: z
    .array(interviewMessageSchema)
    .min(1, "messages must include at least one item")
    .max(100),
  sessionId: z.string().uuid().optional(),
  jobCategory: z.string().trim().min(1, "jobCategory is required").max(500),
  userName: z.string().trim().max(200).optional(),
  jobId: optionalTrimmedId,
  interviewLanguage: z.enum(["en", "tr"]).optional(),
  interviewControl: interviewControlSchema.optional(),
});

export type InterviewMessage = z.infer<typeof interviewMessageSchema>;
export type InterviewControl = z.infer<typeof interviewControlSchema>;
/** Request body for POST /api/mock-interview */
export type InterviewResponseBody = z.infer<typeof interviewResponseSchema>;

// --- Employer job listing (create / update payload) ---

export const aiInterviewConfigSchema = z.object({
  custom_questions: z.array(z.string().max(5000)).max(100).optional(),
  cv_required_items: z.array(z.string().max(1000)).max(100).optional(),
});

export type AiInterviewConfig = z.infer<typeof aiInterviewConfigSchema>;

export const jobListingCreatePayloadSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.union([z.string().max(50_000), z.null()]),
  requirements: z.union([z.string().max(50_000), z.null()]),
  min_cv_score: z.number().int().min(0).max(100),
  is_active: z.boolean(),
  ai_interview_config: aiInterviewConfigSchema,
});

export type JobListingCreatePayload = z.infer<typeof jobListingCreatePayloadSchema>;

// --- CV analysis API response (client / typing) ---

export const cvHolderSchema = z.object({
  full_name: z.string(),
  current_role: z.string(),
  department_or_field: z.string(),
  location: z.string(),
  email: z.string(),
  summary_line: z.string(),
});

export type CVHolder = z.infer<typeof cvHolderSchema>;

export const analysisResultSchema = z.object({
  cv_holder: cvHolderSchema.optional(),
  overall_score: z.number(),
  category_scores: z.record(z.string(), z.number()),
  category_feedback: z.record(z.string(), z.string()).optional(),
  detailed_report: z.string().optional(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;
