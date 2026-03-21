import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPublicCandidateProfileBySlug } from "@/lib/public-candidate-profile";
import {
  fetchPublicMockInterviewById,
  fetchSharedByFirstNameForResultId,
} from "@/lib/public-mock-interview-result";
import { createAdminClient } from "@/lib/supabase/server";
import {
  createAdminClientForInterviewResultShare,
  createAdminClientForPublicMockInterview,
  createAdminClientForPublicProfileFetch,
} from "@/test/supabase-mocks";

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(),
}));

const PUBLIC_PROFILE_KEYS = new Set([
  "slug",
  "hidden",
  "firstName",
  "targetRole",
  "summary",
  "bestScoutScore",
  "bestHiringScore",
  "hiringFitLabel",
  "latestInterviewCategory",
  "strengthsTop3",
  "latestResultId",
  "latestPassSlug",
  "latestEvaluatedRole",
  "openToCategory",
  "hasCompletedInterview",
]);

/** Version 4 UUID with variant nibble 8–b (required by isPublicMockInterviewId). */
const SAMPLE_PUBLIC_INTERVIEW_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("public profile / shared result privacy", () => {
  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
  });

  afterEach(() => {
    vi.mocked(createAdminClient).mockReset();
  });

  it("fetchPublicCandidateProfileBySlug returns only public view fields; no email, transcript, or notes", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      createAdminClientForPublicProfileFetch({
        profile: {
          user_id: "internal-user",
          first_name: "Jane",
          professional_summary: "Engineer",
          role: "candidate",
          public_profile_hidden: false,
        },
        prefs: null,
        interviews: [
          {
            id: "int-1",
            job_category: "Backend",
            created_at: "2025-01-01T00:00:00Z",
            score: 81,
            report: {
              strengths: ["Systems thinking"],
              transcript: "SECRET_TRANSCRIPT_BODY",
              private_notes: "SECRET_EMPLOYER_NOTES",
              email: "should.not.leak@example.com",
            },
          },
        ],
        passes: [],
        cvRows: [],
      }) as never
    );

    const out = await fetchPublicCandidateProfileBySlug("jane");
    expect(out.status).toBe("ok");
    if (out.status !== "ok") return;

    const serialized = JSON.stringify(out.data);
    expect(serialized).not.toMatch(/SECRET_TRANSCRIPT|SECRET_EMPLOYER_NOTES|should\.not\.leak/i);

    for (const key of Object.keys(out.data)) {
      expect(PUBLIC_PROFILE_KEYS.has(key), `unexpected public field: ${key}`).toBe(true);
    }
    expect(out.data.strengthsTop3).toEqual(["Systems thinking"]);
  });

  it("fetchPublicMockInterviewById maps report to strengths/improvements only; drops transcript and sensitive report keys", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      createAdminClientForPublicMockInterview({
        row: {
          user_id: "u-1",
          score: 70,
          job_category: "Sales",
          report: {
            strengths: ["Rapport"],
            improvements: ["Closing"],
            transcript: "SECRET_TRANSCRIPT",
            private_notes: "NOTES",
            email: "leak@corp.test",
          },
        },
      }) as never
    );

    const out = await fetchPublicMockInterviewById(SAMPLE_PUBLIC_INTERVIEW_ID);
    expect(out.status).toBe("ok");
    if (out.status !== "ok") return;

    const serialized = JSON.stringify(out.data);
    expect(serialized).not.toMatch(/SECRET_TRANSCRIPT|NOTES|leak@corp/i);

    const allowed = new Set([
      "score",
      "hiringScore",
      "fitTag",
      "strengths",
      "improvements",
      "job_category",
    ]);
    for (const key of Object.keys(out.data)) {
      expect(allowed.has(key), `unexpected interview public field: ${key}`).toBe(true);
    }
    expect(JSON.stringify(out.data)).not.toContain("u-1");
  });

  it("fetchSharedByFirstNameForResultId returns only a first name (no user id in return value)", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      createAdminClientForInterviewResultShare({
        interviewUserId: "INTERNAL_SUPABASE_AUTH_UID",
        firstName: "Sam",
      }) as never
    );
    const label = await fetchSharedByFirstNameForResultId(SAMPLE_PUBLIC_INTERVIEW_ID);
    expect(label).toBe("Sam");
    expect(label).not.toMatch(/INTERNAL_SUPABASE_AUTH_UID/);
  });

  it("hidden public profile response never includes the internal profile user_id", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      createAdminClientForPublicProfileFetch({
        profile: {
          user_id: "profile-internal-uuid-123",
          first_name: "Pat",
          professional_summary: "PM",
          role: "candidate",
          public_profile_hidden: true,
        },
        prefs: null,
        interviews: [
          {
            id: "int-1",
            job_category: "PM",
            created_at: "2025-01-01T00:00:00Z",
            score: 90,
            report: { strengths: ["x"] },
          },
        ],
        passes: [],
        cvRows: [],
      }) as never
    );

    const out = await fetchPublicCandidateProfileBySlug("pat");
    expect(out.status).toBe("ok");
    if (out.status !== "ok") return;
    expect(JSON.stringify(out.data)).not.toMatch(/profile-internal-uuid-123/);
  });
});
