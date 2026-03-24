import { createClient } from "@/lib/supabase/server";
import { MockInterviewResultView } from "@/components/mock-interview/MockInterviewResultView";
import { MockInterviewResultFallback } from "@/components/mock-interview/MockInterviewResultFallback";
import { parseInterviewLocale } from "@/lib/interview-locale";

type PageProps = {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function MockInterviewResultPage({ params: routeParams, searchParams }: PageProps) {
  const { sessionId } = await routeParams;
  const params = await searchParams;
  const tooShort = params.tooShort === "1";
  const langRaw = typeof params.lang === "string" ? params.lang : Array.isArray(params.lang) ? params.lang[0] : undefined;
  const resultLocale = parseInterviewLocale(langRaw);
  const applicationSavedRaw = params.applicationSaved;
  const applicationSubmitted =
    (typeof applicationSavedRaw === "string" ? applicationSavedRaw : Array.isArray(applicationSavedRaw) ? applicationSavedRaw[0] : undefined) === "1";

  const errorParam = typeof params.error === "string" ? params.error : Array.isArray(params.error) ? params.error[0] : undefined;
  const evalError = errorParam === "1";

  if (evalError) {
    return <MockInterviewResultFallback locale={resultLocale} variant="eval_error" />;
  }

  if (tooShort) {
    return (
      <MockInterviewResultView
        tooShort
        score={0}
        strengths={[]}
        improvements={[]}
        category=""
        cvScore={null}
        locale={resultLocale}
        applicationSubmitted={applicationSubmitted}
      />
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <MockInterviewResultFallback locale={resultLocale} variant="unauthenticated" />;
  }

  const firstNameFromMeta =
    typeof user.user_metadata?.first_name === "string"
      ? user.user_metadata.first_name
      : typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name.split(/\s+/)[0]
        : undefined;

  if (!sessionId) {
    return <MockInterviewResultFallback locale={resultLocale} variant="not_found" />;
  }

  const { data: interview } = await supabase
    .from("mock_interviews")
    .select("score, report, job_category, job_id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!interview) {
    return <MockInterviewResultFallback locale={resultLocale} variant="not_found" />;
  }

  const report = (interview.report as {
    strengths?: string[];
    improvements?: string[];
    justification?: string;
    technical_score?: number;
    communication_score?: number;
    problem_solving_score?: number;
  }) ?? {};
  const score = typeof interview.score === "number" ? interview.score : 0;
  const strengths = Array.isArray(report.strengths) ? report.strengths : [];
  const improvements = Array.isArray(report.improvements) ? report.improvements : [];
  const justification = typeof report.justification === "string" ? report.justification : null;
  const technicalScore = typeof report.technical_score === "number" ? report.technical_score : null;
  const communicationScore = typeof report.communication_score === "number" ? report.communication_score : null;
  const problemSolvingScore = typeof report.problem_solving_score === "number" ? report.problem_solving_score : null;
  const category = typeof interview.job_category === "string" ? interview.job_category : "";

  let cvScore: number | null = null;
  const jobId = (interview as { job_id?: string | null }).job_id;
  const jobCategory = category;

  if (jobId) {
    const { data: cvByJob } = await supabase
      .from("cv_analyses")
      .select("overall_score")
      .eq("user_id", user.id)
      .eq("job_id", jobId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cvByJob != null && typeof cvByJob.overall_score === "number") {
      cvScore = cvByJob.overall_score;
    }
  }
  if (cvScore === null && jobCategory) {
    const { data: cvByCategory } = await supabase
      .from("cv_analyses")
      .select("overall_score")
      .eq("user_id", user.id)
      .eq("job_category", jobCategory)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cvByCategory != null && typeof cvByCategory.overall_score === "number") {
      cvScore = cvByCategory.overall_score;
    }
  }

  return (
    <MockInterviewResultView
      tooShort={false}
      score={score}
      strengths={strengths}
      improvements={improvements}
      category={category}
      cvScore={cvScore}
      locale={resultLocale}
      justification={justification}
      technicalScore={technicalScore}
      communicationScore={communicationScore}
      problemSolvingScore={problemSolvingScore}
      shareResultId={sessionId}
      applicationSubmitted={applicationSubmitted}
      firstName={firstNameFromMeta}
    />
  );
}
