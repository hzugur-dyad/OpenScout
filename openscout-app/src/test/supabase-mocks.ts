import { vi } from "vitest";

/** Minimal chain mock for POST /api/job-applications (checkProfileAndCv + apply flow). */
export type JobApplicationsMockOptions = {
  userId: string | null;
  job: {
    id: string;
    title: string;
    min_cv_score: number | null;
    company_id?: string | null;
  };
  /** Row returned when querying CV by job_id first (null → falls back to job_category). */
  cvByJob: { overall_score: number } | null;
  /** Used when cvByJob is null. */
  cvByCategory: { overall_score: number } | null;
  interviewByJob: { score: number; report: Record<string, unknown> } | null;
  interviewByCategory: { score: number; report: Record<string, unknown> } | null;
  profileGuard: "complete" | "incomplete" | "no_cv";
  upsertMock?: ReturnType<typeof vi.fn>;
};

export function createSupabaseForJobApplicationsRoute(opts: JobApplicationsMockOptions) {
  const upsertMock = opts.upsertMock ?? vi.fn().mockResolvedValue({ error: null });

  const guardProfile =
    opts.profileGuard === "incomplete"
      ? { first_name: "A", last_name: "B", email: "a@b.com", location: "" }
      : { first_name: "A", last_name: "B", email: "a@b.com", location: "Berlin" };

  const guardCvRow =
    opts.profileGuard === "no_cv" ? null : { id: "cv-guard-row" };

  const from = (table: string) => {
    let selectCols = "";
    let selectOpts: { count?: string; head?: boolean } | undefined;
    const eqPairs: [string, unknown][] = [];

    const chain: Record<string, unknown> = {};

    chain.select = (cols: string, options?: { count?: string; head?: boolean }) => {
      selectCols = cols;
      selectOpts = options;
      return chain;
    };

    chain.eq = (col: string, val: unknown) => {
      eqPairs.push([col, val]);
      return chain;
    };

    chain.order = (_col?: string, _opts?: { ascending?: boolean }) => chain;
    chain.limit = (_n?: number) => chain;

    chain.in = () =>
      Promise.resolve({
        count: 0,
        data: null,
        error: null,
      });

    chain.maybeSingle = async () => {
      if (table === "profiles" && selectCols.includes("email")) {
        return { data: guardProfile, error: null };
      }
      if (table === "profile_private") {
        return { data: {}, error: null };
      }
      if (table === "cv_analyses" && selectCols === "id") {
        return { data: guardCvRow, error: null };
      }
      if (table === "cv_analyses" && selectCols.includes("overall_score")) {
        const hasJobId = eqPairs.some(([c]) => c === "job_id");
        if (hasJobId) {
          return { data: opts.cvByJob, error: null };
        }
        return { data: opts.cvByCategory, error: null };
      }
      if (table === "mock_interviews" && selectCols.includes("score")) {
        const hasJobId = eqPairs.some(([c]) => c === "job_id");
        if (hasJobId) {
          return { data: opts.interviewByJob, error: null };
        }
        return { data: opts.interviewByCategory, error: null };
      }
      if (table === "job_listings" && selectCols.includes("min_cv_score")) {
        return { data: opts.job, error: null };
      }
      if (table === "companies" && selectCols.includes("total_application_limit")) {
        return {
          data: { total_application_limit: 50, stripe_subscription_status: "inactive" },
          error: null,
        };
      }
      if (table === "companies" && selectCols.includes("user_id") && selectCols.trim() === "user_id") {
        return { data: null, error: null };
      }
      return { data: null, error: null };
    };

    chain.upsert = async (payload: unknown, _conf?: unknown) => {
      (upsertMock as (p: unknown) => void)(payload);
      return { error: null };
    };

    return chain;
  };

  return {
    upsertMock,
    client: {
      auth: {
        getUser: async () => ({
          data: { user: opts.userId ? { id: opts.userId } : null },
        }),
      },
      from,
    },
  };
}

export type MockInterviewResultSupabaseOptions = {
  userId: string | null;
  insertMock?: ReturnType<typeof vi.fn>;
  profileGuard: "complete" | "blocked";
};

export function createSupabaseForMockInterviewResultRoute(opts: MockInterviewResultSupabaseOptions) {
  const insertMock = opts.insertMock ?? vi.fn().mockResolvedValue({ error: null });
  const upsertMock = insertMock;

  const guardProfile =
    opts.profileGuard === "blocked"
      ? { first_name: "", last_name: "B", email: "a@b.com", location: "X" }
      : { first_name: "A", last_name: "B", email: "a@b.com", location: "Berlin" };

  const guardCvRow = opts.profileGuard === "blocked" ? null : { id: "cv" };

  const from = (table: string) => {
    let selectCols = "";
    const eqPairs: [string, unknown][] = [];
    const chain: Record<string, unknown> = {};

    chain.select = (cols: string) => {
      selectCols = cols;
      return chain;
    };
    chain.eq = (col: string, val: unknown) => {
      eqPairs.push([col, val]);
      return chain;
    };
    chain.limit = () => chain;

    chain.maybeSingle = async () => {
      if (table === "profiles" && selectCols.includes("email")) {
        return { data: guardProfile, error: null };
      }
      if (table === "profile_private") {
        return { data: {}, error: null };
      }
      if (table === "cv_analyses" && selectCols === "id") {
        return { data: guardCvRow, error: null };
      }
      if (table === "profiles" && selectCols.includes("plan")) {
        return { data: { plan: "pro", bonus_mock_interview_credits: 0 }, error: null };
      }
      return { data: null, error: null };
    };

    chain.insert = async (payload: unknown) => {
      if (table === "mock_interviews") {
        (insertMock as (p: unknown) => void)(payload);
      }
      return { error: null };
    };

    chain.upsert = async (payload: unknown) => {
      if (table === "mock_interviews") {
        (upsertMock as (p: unknown) => void)(payload);
      }
      return { error: null };
    };

    return chain;
  };

  return {
    insertMock: upsertMock,
    client: {
      auth: {
        getUser: async () => ({
          data: { user: opts.userId ? { id: opts.userId } : null },
        }),
      },
      from,
    },
  };
}

export type MockInterviewRealtimeSupabaseOptions = {
  userId: string | null;
  profileGuard: "complete" | "blocked";
  jobRow?:
    | {
        title?: string | null;
        description?: string | null;
        requirements?: string | null;
        ai_interview_config?: unknown;
      }
    | null;
};

export function createSupabaseForMockInterviewRealtimeRoute(opts: MockInterviewRealtimeSupabaseOptions) {
  const guardProfile =
    opts.profileGuard === "blocked"
      ? { first_name: "", last_name: "B", email: "a@b.com", location: "X" }
      : { first_name: "A", last_name: "B", email: "a@b.com", location: "Berlin" };

  const guardCvRow = opts.profileGuard === "blocked" ? null : { id: "cv" };

  const from = (table: string) => {
    let selectCols = "";
    const chain: Record<string, unknown> = {};

    chain.select = (cols: string) => {
      selectCols = cols;
      return chain;
    };
    chain.eq = (_col: string, _val: unknown) => chain;
    chain.limit = () => chain;
    chain.maybeSingle = async () => {
      if (table === "profiles" && selectCols.includes("email")) {
        return { data: guardProfile, error: null };
      }
      if (table === "profile_private") {
        return { data: {}, error: null };
      }
      if (table === "cv_analyses" && selectCols === "id") {
        return { data: guardCvRow, error: null };
      }
      if (table === "job_listings" && selectCols.includes("ai_interview_config")) {
        return { data: opts.jobRow ?? null, error: null };
      }
      return { data: null, error: null };
    };

    return chain;
  };

  return {
    client: {
      auth: {
        getUser: async () => ({
          data: { user: opts.userId ? { id: opts.userId } : null },
        }),
      },
      from,
    },
  };
}

export type EmployerApplicationPatchMockOptions = {
  authUserId: string | null;
  application: { id: string; job_id: string } | null;
  job: { id: string; company_id: string } | null;
  company: { user_id: string; stripe_subscription_status: string } | null;
  updateMock?: ReturnType<typeof vi.fn>;
};

export function createSupabaseForEmployerApplicationPatch(opts: EmployerApplicationPatchMockOptions) {
  const updateMock = opts.updateMock ?? vi.fn().mockResolvedValue({ error: null });

  const from = (table: string) => {
    const chain: Record<string, unknown> = {};
    chain.select = (_cols: string) => chain;
    chain.eq = (_col: string, _val: unknown) => chain;
    chain.maybeSingle = async () => {
      if (table === "job_applications") {
        return { data: opts.application, error: null };
      }
      if (table === "job_listings") {
        return { data: opts.job, error: null };
      }
      if (table === "companies") {
        return { data: opts.company, error: null };
      }
      return { data: null, error: null };
    };
    chain.update = (payload: unknown) => {
      (updateMock as (p: unknown) => void)(payload);
      return {
        eq: async () => ({ error: null }),
      };
    };
    chain.insert = async () => ({ error: null });
    return chain;
  };

  return {
    updateMock,
    client: {
      auth: {
        getUser: async () => ({
          data: { user: opts.authUserId ? { id: opts.authUserId } : null },
        }),
      },
      from,
    },
  };
}

export type PublicProfileMockOptions = {
  profile: Record<string, unknown> | null;
  prefs: Record<string, unknown> | null;
  interviews: Array<Record<string, unknown>>;
  passes: Array<Record<string, unknown>>;
  cvRows: Array<Record<string, unknown>>;
};

export function createAdminClientForPublicProfileFetch(opts: PublicProfileMockOptions) {
  const from = (table: string) => {
    let selectCols = "";
    const chain: Record<string, unknown> = {};

    chain.select = (cols: string) => {
      selectCols = cols;
      return chain;
    };
    chain.eq = (_c: string, _v: unknown) => chain;
    chain.order = (_col?: string, _opts?: { ascending?: boolean }) => chain;
    chain.limit = (_n?: number) => chain;

    chain.maybeSingle = async () => {
      if (table === "profiles") {
        return { data: opts.profile, error: null };
      }
      if (table === "job_preferences") {
        return { data: opts.prefs, error: null };
      }
      return { data: null, error: null };
    };

    if (table === "mock_interviews") {
      chain.order = () =>
        Promise.resolve({
          data: opts.interviews,
          error: null,
        });
    }
    if (table === "scout_credentials") {
      chain.order = () => ({
        limit: () =>
          Promise.resolve({
            data: opts.passes,
            error: null,
          }),
      });
    }
    if (table === "cv_analyses") {
      chain.order = () => ({
        limit: () =>
          Promise.resolve({
            data: opts.cvRows,
            error: null,
          }),
      });
    }

    return chain;
  };

  return { from };
}

export type PublicMockInterviewFetchOptions = {
  row: Record<string, unknown> | null;
  error?: { message: string } | null;
};

export function createAdminClientForPublicMockInterview(opts: PublicMockInterviewFetchOptions) {
  const from = (_table: string) => ({
    select: (_cols: string) => ({
      eq: (_c: string, _v: unknown) => ({
        maybeSingle: async () => ({
          data: opts.row,
          error: opts.error ?? null,
        }),
      }),
    }),
  });
  return { from };
}

export type ManualCvAnalysisSupabaseOpts = {
  userId: string | null;
  profilePlan: string | null;
  insertCvMock: ReturnType<typeof vi.fn>;
  insertError?: { message: string } | null;
  jobListingRow?: { ai_interview_config?: unknown } | null;
};

export function createSupabaseForManualCvAnalysis(opts: ManualCvAnalysisSupabaseOpts) {
  return {
    auth: {
      getUser: async () => ({
        data: { user: opts.userId ? { id: opts.userId } : null },
      }),
    },
    from(table: string) {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: opts.profilePlan != null ? { plan: opts.profilePlan } : null,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "job_listings") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: opts.jobListingRow ?? null,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "cv_analyses") {
        return {
          insert: async (payload: unknown) => {
            (opts.insertCvMock as (p: unknown) => void)(payload);
            return { error: opts.insertError ?? null };
          },
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      };
    },
  };
}

export type AutoCvAnalysisSupabaseOpts = {
  userId: string | null;
  existingAnalysis: { overall_score: number } | null;
  privateRow: { cv_raw_text?: string; cv_file_url?: string | null };
  jobRow: { title: string; company_id: string; ai_interview_config?: unknown } | null;
  insertCvMock: ReturnType<typeof vi.fn>;
  insertEmployerUsageMock: ReturnType<typeof vi.fn>;
  insertCvError?: { message: string } | null;
};

export function createSupabaseForAutoCvAnalysis(opts: AutoCvAnalysisSupabaseOpts) {
  let cvAnalysesFromCount = 0;
  return {
    auth: {
      getUser: async () => ({
        data: { user: opts.userId ? { id: opts.userId } : null },
      }),
    },
    from(table: string) {
      if (table === "cv_analyses") {
        cvAnalysesFromCount += 1;
        if (cvAnalysesFromCount === 1) {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({
                        data: opts.existingAnalysis,
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {
          insert: async (payload: unknown) => {
            (opts.insertCvMock as (p: unknown) => void)(payload);
            return { error: opts.insertCvError ?? null };
          },
        };
      }
      if (table === "profile_private") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: opts.privateRow, error: null }),
            }),
          }),
        };
      }
      if (table === "job_listings") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: opts.jobRow, error: null }),
            }),
          }),
        };
      }
      if (table === "employer_usage_logs") {
        return {
          insert: async (payload: unknown) => {
            (opts.insertEmployerUsageMock as (p: unknown) => void)(payload);
            return { error: null };
          },
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      };
    },
  };
}

/** Admin client for fetchSharedByFirstNameForResultId (mock_interviews → profiles). */
export function createAdminClientForInterviewResultShare(opts: {
  interviewUserId: string;
  firstName: string | null;
}) {
  return {
    from(table: string) {
      if (table === "mock_interviews") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { user_id: opts.interviewUserId },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: opts.firstName != null ? { first_name: opts.firstName } : null,
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      };
    },
  };
}
