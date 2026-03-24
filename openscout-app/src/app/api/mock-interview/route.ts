import { NextRequest, NextResponse } from "next/server";
import { getGroq } from "@/lib/groq";
import { createClient } from "@/lib/supabase/server";
import {
  getRateLimitIdentifier,
  isRateLimitBypassed,
  rateLimitForKind,
  tooManyRequestsResponse,
} from "@/lib/rate-limit";
import { logError, logInfo, logWarn } from "@/lib/logger";
import { checkProfileAndCv } from "@/lib/profile-guard";
import { parseInterviewLocale, type InterviewLocale } from "@/lib/interview-locale";
import {
  buildEmployerQuestionsBlockEn,
  buildEmployerQuestionsBlockTr,
  buildInterviewerSystemPrompt,
} from "@/lib/mock-interview-prompt";
import { buildMockInterviewServerFlowHint, classifyContractStimulus } from "@/lib/mock-interview/flow-hints";
import { parseJsonBody } from "@/lib/api-validation";
import { interviewResponseSchema } from "@/types/schemas";
import {
  defaultMockInterviewEndScores,
  parseMockInterviewAssistantTurn,
  type NormalizedMockQuestionControl,
} from "@/lib/ai/structured-output";
import { GROQ_MOCK_INTERVIEW_MODEL } from "@/lib/mock-interview/versioning";
import { captureException, captureMessage } from "@/lib/monitoring";

/** Max user-side messages (each POST adds one user line) before hard stop. */
const MAX_INTERVIEW_USER_MESSAGES = 40;

function extractGroqRetryAfterSeconds(message: string): number | null {
  // Example: "Please try again in 13m53.76s."
  const match = message.match(/Please try again in\s+(\d+)m([0-9]+(?:\.[0-9]+)?)s/i);
  if (!match) return null;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  const total = Math.max(1, Math.ceil(minutes * 60 + seconds));
  return total;
}

function classifyGroqError(err: unknown): {
  status: number;
  retryAfterSeconds?: number;
  code?: string;
  message: string;
} {
  const fallback = {
    status: 503,
    code: "interview_provider_error",
    message: err instanceof Error ? err.message : "Interview error",
  };

  if (!err || typeof err !== "object") return fallback;

  const maybeErr = err as {
    status?: unknown;
    message?: unknown;
    error?: { code?: unknown; message?: unknown; type?: unknown };
  };

  const status = typeof maybeErr.status === "number" ? maybeErr.status : undefined;
  const code =
    typeof maybeErr.error?.code === "string"
      ? maybeErr.error.code
      : typeof maybeErr.error?.type === "string"
        ? maybeErr.error.type
        : undefined;
  const message =
    typeof maybeErr.error?.message === "string"
      ? maybeErr.error.message
      : typeof maybeErr.message === "string"
        ? maybeErr.message
        : fallback.message;

  if (status === 429 || code === "rate_limit_exceeded" || /rate limit/i.test(message)) {
    const retryAfterSeconds = extractGroqRetryAfterSeconds(message) ?? 60;
    return {
      status: 429,
      retryAfterSeconds,
      code: "interview_provider_rate_limited",
      message,
    };
  }

  return {
    status: 503,
    code: "interview_provider_error",
    message,
  };
}

function buildControlContextHint(
  locale: InterviewLocale,
  interviewControl: { questionId: string; attemptCount: number } | undefined
): string {
  if (!interviewControl) return "";
  const q = interviewControl.questionId;
  const a = Math.max(1, Math.min(2, interviewControl.attemptCount));
  return locale === "tr"
    ? `\nKONTROL BAĞLAMI: Aktif question_id=${q}, bildirilen attempt=${a}. attempt zaten 2 ise aynı soruda kalma; yeni question_id ve attempt=1 kullan.`
    : `\nCONTROL CONTEXT: Active question_id=${q}, reported attempt=${a}. If attempt is already 2, advance with a new question_id and attempt=1.`;
}

function buildJsonRepairAttemptSuffix(locale: InterviewLocale): string {
  return locale === "tr"
    ? `\n\nSON DENEME: Önceki iki yanıtta geçerli JSON yoktu. Adaya TEK cümle söyle; ardından mesajın EN SONUNDA yalnızca şu türden TEK JSON: devam {"type":"question_control","question_id":"...","attempt":1 veya 2,"is_followup":true veya false}; bitiş {"type":"interview_end","reason":"...","scores":{"technical":0-100,"communication":0-100,"problem_solving":0-100,"confidence":0-100,"consistency":0-100}}. Başka metin yok.`
    : `\n\nFINAL ATTEMPT: The last two replies had no valid JSON. Say ONE short sentence to the candidate, then end with exactly ONE JSON object only: while continuing {"type":"question_control","question_id":"...","attempt":1 or 2,"is_followup":true or false}; when closing {"type":"interview_end","reason":"...","scores":{"technical":0-100,"communication":0-100,"problem_solving":0-100,"confidence":0-100,"consistency":0-100}}. No other text after the JSON.`;
}

function buildInvalidJsonRetrySuffix(locale: InterviewLocale): string {
  return locale === "tr"
    ? `\n\nKRİTİK: Son yanıtın geçersizdi. Adaya yönelik metinden sonra mesajın EN SONUNDA yalnızca TEK bir JSON olmalı: devam için {"type":"question_control","question_id":"...","attempt":1 veya 2,"is_followup":true veya false}; bitiş için {"type":"interview_end","reason":"...","scores":{"technical":0-100,"communication":0-100,"problem_solving":0-100,"confidence":0-100,"consistency":0-100}}. Markdown veya düz metin işaret kullanma.`
    : `\n\nCRITICAL: Your last reply was invalid. After your spoken text, end with exactly ONE JSON object: while continuing {"type":"question_control","question_id":"...","attempt":1 or 2,"is_followup":true or false}; when closing {"type":"interview_end","reason":"...","scores":{"technical":0-100,"communication":0-100,"problem_solving":0-100,"confidence":0-100,"consistency":0-100}}. No markdown or plain-text markers.`;
}

function failsafeClosingText(locale: InterviewLocale, reason: "empty_model" | "parse_failure"): string {
  if (locale === "tr") {
    return reason === "empty_model"
      ? "Şu anda yanıt alınamadı; mülakatı güvenli biçimde sonlandırıyorum. Sonuçların hazırlanıyor."
      : "Yanıt biçimi beklenenle eşleşmedi; mülakatı güvenli biçimde sonlandırıyorum. Sonuçların hazırlanıyor.";
  }
  return reason === "empty_model"
    ? "I couldn't get a response right now — closing the interview safely. Preparing your results."
    : "The response format didn't match what we need — closing the interview safely. Preparing your results.";
}

function maxTurnsClosingText(locale: InterviewLocale): string {
  return locale === "tr"
    ? "Konuşma üst sınırına ulaşıldı; mülakatı burada sonlandırıyorum. Sonuçların hazırlanıyor."
    : "We've reached the conversation limit — wrapping the interview here. Preparing your results.";
}

function enforceServerQuestionControl(
  qc: NormalizedMockQuestionControl | null,
  clientPrev?: { questionId: string; attemptCount: number }
): NormalizedMockQuestionControl {
  const advance: NormalizedMockQuestionControl = {
    questionId: clientPrev ? `${clientPrev.questionId}__next` : "q_start",
    attempt: 1,
    isFollowup: false,
  };

  if (!qc) return advance;

  const questionId = qc.questionId.trim() || advance.questionId;
  const attempt = Math.min(2, Math.max(1, Math.round(qc.attempt)));
  let isFollowup = qc.isFollowup;

  if (clientPrev && clientPrev.questionId === questionId && clientPrev.attemptCount >= 2) {
    return {
      questionId: `${clientPrev.questionId}__next`,
      attempt: 1,
      isFollowup: false,
    };
  }

  if (attempt >= 2) {
    isFollowup = false;
  }

  return { questionId, attempt, isFollowup };
}

function lockControlForDelayWarning(
  clientPrev?: { questionId: string; attemptCount: number }
): NormalizedMockQuestionControl | null {
  if (!clientPrev) return null;
  return {
    questionId: clientPrev.questionId,
    attempt: clientPrev.attemptCount,
    isFollowup: false,
  };
}

export async function POST(request: NextRequest) {
  logInfo("mock-interview request received");
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const guard = await checkProfileAndCv(supabase, user.id);
    if (!guard.canApplyOrInterview) {
      const reasons: string[] = [];
      if (!guard.profileComplete) reasons.push("Complete required profile fields (name, email, location)");
      if (guard.profileComplete && !guard.hasCv) {
        reasons.push("Upload a CV in your profile or complete a CV analysis so we have your résumé on file");
      }
      return NextResponse.json(
        {
          error: "Complete your profile and add a CV (upload or CV analysis) before starting a mock interview.",
          details: reasons,
        },
        { status: 403 }
      );
    }

    const parsed = await parseJsonBody(request, interviewResponseSchema);
    if (!parsed.ok) {
      logWarn("mock-interview validation failed", { reason: "body schema" });
      return parsed.response;
    }
    const { messages, jobCategory, userName, jobId, interviewLanguage, interviewControl } = parsed.data;

    if (!isRateLimitBypassed(user)) {
      const rlId = getRateLimitIdentifier(request, user.id);
      const isStartRequest = messages.length === 1 && messages[0]?.role === "user";
      const limited = await rateLimitForKind(isStartRequest ? "mockInterviewStart" : "mockInterviewTurn", rlId);
      if (!limited.success) return tooManyRequestsResponse(limited);
    }

    const locale: InterviewLocale = parseInterviewLocale(interviewLanguage);

    const userTurnCount = messages.filter((m) => m.role === "user").length;
    if (userTurnCount > MAX_INTERVIEW_USER_MESSAGES) {
      logWarn("mock-interview max user messages exceeded", { userTurnCount });
      captureMessage("Mock interview: max user turns reached", {
        route: "/api/mock-interview",
        user_id: user.id,
        ...(jobId && typeof jobId === "string" && jobId.trim() ? { job_id: jobId.trim() } : {}),
        aiInterview: { stage: "generation", reason: "max_turns" },
      });
      const scores = defaultMockInterviewEndScores();
      return NextResponse.json({
        content: maxTurnsClosingText(locale),
        interviewEnded: true,
        interviewEnd: {
          reason: "max_turns",
          scores,
        },
        terminatedBy: "max_turns",
      });
    }

    let customQuestionsBlock = "";
    if (jobId && typeof jobId === "string") {
      const { data: job } = await supabase
        .from("job_listings")
        .select("ai_interview_config")
        .eq("id", jobId.trim())
        .maybeSingle();
      const config = (job?.ai_interview_config as { custom_questions?: string[] } | null) ?? {};
      const questions = config.custom_questions?.filter((q) => typeof q === "string" && q.trim()) ?? [];
      if (questions.length > 0) {
        customQuestionsBlock =
          locale === "tr" ? buildEmployerQuestionsBlockTr(questions) : buildEmployerQuestionsBlockEn(questions);
      }
    }

    const displayName = userName && typeof userName === "string" ? userName.trim() || "there" : "there";
    const clientPrev =
      interviewControl &&
      typeof interviewControl === "object" &&
      typeof (interviewControl as { questionId?: unknown }).questionId === "string" &&
      typeof (interviewControl as { attemptCount?: unknown }).attemptCount === "number"
        ? {
            questionId: (interviewControl as { questionId: string }).questionId.trim(),
            attemptCount: Math.max(1, Math.min(2, Math.round((interviewControl as { attemptCount: number }).attemptCount))),
          }
        : undefined;

    const userMsgs = messages.filter((m) => m.role === "user");
    const lastUserMessage =
      userMsgs.length > 0 ? String(userMsgs[userMsgs.length - 1]?.content ?? "").slice(0, 100_000) : "";
    const stimulus = classifyContractStimulus(lastUserMessage, locale);
    const serverFlowHint = buildMockInterviewServerFlowHint({
      locale,
      lastUserMessage,
      clientPrev,
    });

    const controlHint = buildControlContextHint(locale, clientPrev);
    const systemPrompt = buildInterviewerSystemPrompt(locale, {
      jobCategory,
      displayName,
      userName: userName && typeof userName === "string" ? userName : "",
      customQuestionsBlock,
      serverFlowHint,
      controlHint,
    });

    const groq = getGroq();

    let rawContent = "";
    let parseResult = null as ReturnType<typeof parseMockInterviewAssistantTurn> | null;

    for (let groqAttempt = 0; groqAttempt < 3; groqAttempt++) {
      const systemContent =
        groqAttempt === 0
          ? systemPrompt
          : groqAttempt === 1
            ? systemPrompt + buildInvalidJsonRetrySuffix(locale)
            : systemPrompt + buildJsonRepairAttemptSuffix(locale);
      const chatMessages = [{ role: "system" as const, content: systemContent }, ...messages];

      let completion;
      try {
        completion = await groq.chat.completions.create({
          model: GROQ_MOCK_INTERVIEW_MODEL,
          temperature: 0.5,
          messages: chatMessages,
        });
      } catch (groqError) {
        logError("mock-interview Groq request failed", groqError);
        captureException(groqError, {
          route: "/api/mock-interview",
          user_id: user.id,
          ...(jobId && typeof jobId === "string" && jobId.trim() ? { job_id: jobId.trim() } : {}),
          aiInterview: { stage: "generation", reason: "groq_error" },
        });
        const classified = classifyGroqError(groqError);
        return NextResponse.json(
          {
            error: classified.message,
            retryable: classified.status >= 500,
            code: classified.code,
          },
          {
            status: classified.status,
            headers:
              classified.status === 429 && classified.retryAfterSeconds
                ? { "Retry-After": String(classified.retryAfterSeconds) }
                : undefined,
          }
        );
      }

      rawContent = (completion.choices[0]?.message?.content ?? "").trim();
      if (!rawContent) {
        logWarn("mock-interview empty model content", { groqAttempt });
        break;
      }

      parseResult = parseMockInterviewAssistantTurn(rawContent);
      if (parseResult.interviewEnd || parseResult.questionControl) {
        break;
      }
      logWarn("mock-interview missing valid trailing JSON", { groqAttempt });
    }

    if (parseResult?.interviewEnd) {
      const visible =
        parseResult.visibleText.trim() ||
        (locale === "tr" ? "Mülakatı tamamlıyoruz; sonuçların hazırlanıyor." : "Wrapping up — preparing your results.");
      return NextResponse.json({
        content: visible,
        interviewEnded: true,
        interviewEnd: parseResult.interviewEnd,
        terminatedBy: null,
      });
    }

    if (parseResult?.questionControl) {
      let qc = enforceServerQuestionControl(parseResult.questionControl, clientPrev);
      if (stimulus === "timeout_warning") {
        const locked = lockControlForDelayWarning(clientPrev);
        if (locked) qc = locked;
      }
      const visible = parseResult.visibleText.trim() || rawContent;
      return NextResponse.json({
        content: visible,
        interviewEnded: false,
        questionControl: {
          questionId: qc.questionId,
          attempt: qc.attempt,
          isFollowup: qc.isFollowup,
        },
        terminatedBy: null,
      });
    }

    if (parseResult && !parseResult.interviewEnd && !parseResult.questionControl && rawContent.trim()) {
      logWarn("mock-interview: missing structured JSON — forcing controlled progression", { stimulus });
      let qc: NormalizedMockQuestionControl;
      if (stimulus === "timeout_warning") {
        qc = lockControlForDelayWarning(clientPrev) ?? enforceServerQuestionControl(null, clientPrev);
      } else {
        qc = enforceServerQuestionControl(null, clientPrev);
      }
      let visible = parseResult.visibleText.trim();
      if (stimulus === "timeout_warning") {
        visible =
          visible ||
          (locale === "tr"
            ? "Hâlâ buradayım — soruyu kısaca tekrarlıyorum."
            : "I'm still here — let me restate the question briefly.");
      } else if (!visible) {
        visible =
          locale === "tr" ? "Devam edelim — bir sonraki soruya geçiyorum." : "Let's continue — moving to the next question.";
      } else if (visible.length < 12) {
        const filler =
          locale === "tr" ? "Bir sonraki soruya geçiyorum." : "Moving on to the next question.";
        visible = `${visible} ${filler}`.trim();
      }
      return NextResponse.json({
        content: visible,
        interviewEnded: false,
        questionControl: {
          questionId: qc.questionId,
          attempt: qc.attempt,
          isFollowup: qc.isFollowup,
        },
        terminatedBy: null,
      });
    }

    const terminatedBy = !rawContent ? "empty_model" : "parse_failure";
    logWarn("mock-interview failsafe terminate", { terminatedBy });
    captureMessage(
      terminatedBy === "empty_model"
        ? "Mock interview: empty model output before failsafe"
        : "Mock interview: structured output parse failsafe",
      {
        route: "/api/mock-interview",
        user_id: user.id,
        ...(jobId && typeof jobId === "string" && jobId.trim() ? { job_id: jobId.trim() } : {}),
        aiInterview: {
          stage: "generation",
          reason: terminatedBy === "empty_model" ? "empty_model" : "parse_failure",
        },
      }
    );
    const scores = defaultMockInterviewEndScores();
    return NextResponse.json({
      content: failsafeClosingText(locale, terminatedBy === "empty_model" ? "empty_model" : "parse_failure"),
      interviewEnded: true,
      interviewEnd: {
        reason: terminatedBy === "empty_model" ? "empty_model_response" : "invalid_structured_output",
        scores,
      },
      terminatedBy,
    });
  } catch (e) {
    logError("mock-interview unexpected error", e);
    captureException(e, { route: "/api/mock-interview" });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Interview error" },
      { status: 500 }
    );
  }
}
