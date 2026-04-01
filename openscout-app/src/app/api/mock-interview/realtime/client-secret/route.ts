import { NextRequest, NextResponse } from "next/server";
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
import { buildEmployerQuestionsBlockEn, buildEmployerQuestionsBlockTr } from "@/lib/mock-interview-prompt";
import { parseJsonBody } from "@/lib/api-validation";
import { mockInterviewRealtimeClientSecretSchema } from "@/types/schemas";
import { captureException, captureMessage } from "@/lib/monitoring";
import {
  getRealtimeErrorUserMessage,
  isOpenAIRealtimeError,
  OpenAIRealtimeError,
} from "@/lib/mock-interview/realtime-errors";
import { getMockInterviewRealtimeSessionConfig } from "@/lib/mock-interview/realtime";
import { MOCK_INTERVIEW_LIVE_PROVIDER } from "@/lib/mock-interview/versioning";

const OPENAI_REALTIME_CLIENT_SECRET_URL = "https://api.openai.com/v1/realtime/client_secrets";
const OPENAI_REALTIME_CLIENT_SECRET_TIMEOUT_MS = 10_000;
const VOICE_SERVICE_UNAVAILABLE_MESSAGE = "Voice service temporarily unavailable. Please try again.";

type ClientSecretResponseBody = {
  expires_at?: number;
  session?: Record<string, unknown>;
  value?: string;
};

type MintRealtimeClientSecretSuccess = {
  clientSecret: string;
  contentType: string | null;
  durationMs: number;
  expiresAt: number | null;
  requestId: string | null;
  session: Record<string, unknown> | null;
};

function extractOpenAiErrorMessage(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    if (typeof parsed.error?.message === "string" && parsed.error.message.trim()) {
      return parsed.error.message.trim();
    }
  } catch {
    // ignore non-JSON upstream body
  }
  return null;
}

function sanitizeUpstreamBodyPreview(raw: string, contentType: string | null): string {
  const normalized = contentType?.includes("text/html") ? raw.replace(/<[^>]*>/g, " ") : raw;
  return normalized.replace(/\s+/g, " ").trim().slice(0, 500);
}

function getUpstreamRequestId(headers: Headers): string | null {
  return headers.get("x-request-id") ?? headers.get("openai-request-id") ?? headers.get("cf-ray");
}

function isGatewayTimeoutResponse(status: number, statusText: string | null, preview: string): boolean {
  return (
    status === 504 ||
    /gateway time-?out/i.test(statusText ?? "") ||
    /gateway time-?out/i.test(preview)
  );
}

async function mintRealtimeClientSecret(args: {
  apiKey: string;
  sessionConfig: Record<string, unknown>;
  sessionId: string;
  jobId?: string;
}): Promise<MintRealtimeClientSecretSuccess> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort("openai_realtime_client_secret_timeout"),
    OPENAI_REALTIME_CLIENT_SECRET_TIMEOUT_MS
  );

  logInfo("mock-interview realtime client secret request start", {
    operation: "client_secret_mint",
    timeout_ms: OPENAI_REALTIME_CLIENT_SECRET_TIMEOUT_MS,
    model: typeof args.sessionConfig.model === "string" ? args.sessionConfig.model : null,
    session_id: args.sessionId,
    ...(args.jobId ? { job_id: args.jobId } : {}),
  });

  try {
    const response = await fetch(OPENAI_REALTIME_CLIENT_SECRET_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: args.sessionConfig,
      }),
      signal: controller.signal,
    });

    const responseText = await response.text();
    const durationMs = Date.now() - startedAt;
    const contentType = response.headers.get("content-type");
    const upstreamMessage = extractOpenAiErrorMessage(responseText);
    const bodyPreview = upstreamMessage || sanitizeUpstreamBodyPreview(responseText, contentType);
    const requestId = getUpstreamRequestId(response.headers);

    logInfo("mock-interview realtime client secret response status", {
      operation: "client_secret_mint",
      status: response.status,
      status_text: response.statusText,
      duration_ms: durationMs,
      response_content_type: contentType,
      request_id: requestId,
      model: typeof args.sessionConfig.model === "string" ? args.sessionConfig.model : null,
      session_id: args.sessionId,
      ...(args.jobId ? { job_id: args.jobId } : {}),
    });

    if (!response.ok) {
      const kind = isGatewayTimeoutResponse(response.status, response.statusText, bodyPreview)
        ? "upstream_gateway_timeout"
        : "upstream_http_error";

      throw new OpenAIRealtimeError(
        kind === "upstream_gateway_timeout"
          ? "OpenAI client secret mint returned a gateway timeout"
          : `OpenAI client secret mint failed with HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`,
        {
          operation: "client_secret_mint",
          status: response.status,
          statusText: response.statusText,
          contentType,
          bodyPreview,
          durationMs,
          requestId,
          code: kind === "upstream_gateway_timeout" ? "upstream_gateway_timeout" : "client_secret_failed",
          kind,
          retryAfter: response.headers.get("Retry-After"),
          userMessage: VOICE_SERVICE_UNAVAILABLE_MESSAGE,
        },
        {
          cause: new Error(
            extractOpenAiErrorMessage(responseText) ||
              upstreamMessage ||
              bodyPreview ||
              `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`
          ),
        }
      );
    }

    let parsed: ClientSecretResponseBody;
    try {
      parsed = (JSON.parse(responseText) as ClientSecretResponseBody) ?? {};
    } catch (error) {
      throw new OpenAIRealtimeError(
        "OpenAI client secret mint returned invalid JSON",
        {
          operation: "client_secret_mint",
          status: response.status,
          statusText: response.statusText,
          contentType,
          bodyPreview,
          durationMs,
          requestId,
          code: "client_secret_invalid_response",
          kind: "upstream_http_error",
          userMessage: VOICE_SERVICE_UNAVAILABLE_MESSAGE,
        },
        { cause: error }
      );
    }

    const clientSecret = parsed.value?.trim();
    if (!clientSecret) {
      throw new OpenAIRealtimeError(
        "OpenAI client secret mint response did not include a client secret value",
        {
          operation: "client_secret_mint",
          status: response.status,
          statusText: response.statusText,
          contentType,
          bodyPreview,
          durationMs,
          requestId,
          code: "client_secret_missing_value",
          kind: "upstream_http_error",
          userMessage: VOICE_SERVICE_UNAVAILABLE_MESSAGE,
        }
      );
    }

    return {
      clientSecret,
      contentType,
      durationMs,
      expiresAt: Number.isFinite(parsed.expires_at) ? Number(parsed.expires_at) : null,
      requestId,
      session: parsed.session ?? null,
    };
  } catch (error) {
    if (isOpenAIRealtimeError(error)) {
      throw error;
    }

    const isAbort = error instanceof Error && error.name === "AbortError";
    throw new OpenAIRealtimeError(
      isAbort ? "OpenAI client secret mint timed out" : "OpenAI client secret mint failed before receiving a response",
      {
        operation: "client_secret_mint",
        status: null,
        statusText: null,
        contentType: null,
        bodyPreview: "",
        durationMs: Date.now() - startedAt,
        requestId: null,
        code: isAbort ? "client_secret_timeout" : "client_secret_network_failure",
        kind: isAbort ? "upstream_timeout" : "upstream_network_error",
        userMessage: VOICE_SERVICE_UNAVAILABLE_MESSAGE,
      },
      { cause: error }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request: NextRequest) {
  logInfo("mock-interview realtime client secret bootstrap received", {
    operation: "client_secret_mint",
  });

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
        reasons.push("Upload a CV in your profile or complete a CV analysis so we have your resume on file");
      }
      return NextResponse.json(
        {
          error: "Complete your profile and add a CV (upload or CV analysis) before starting a mock interview.",
          details: reasons,
        },
        { status: 403 }
      );
    }

    const parsed = await parseJsonBody(request, mockInterviewRealtimeClientSecretSchema);
    if (!parsed.ok) {
      const validationBody = await parsed.response.clone().text();
      logWarn("mock-interview realtime client secret validation failed", {
        reason: "body schema",
        validation_body: validationBody,
      });
      return parsed.response;
    }

    const { sessionId, jobCategory, userName, jobId, interviewLanguage } = parsed.data;

    if (!isRateLimitBypassed(user)) {
      const rlId = getRateLimitIdentifier(request, user.id);
      const limited = await rateLimitForKind("mockInterviewStart", rlId);
      if (!limited.success) return tooManyRequestsResponse(limited);
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      logWarn("mock-interview realtime client secret missing OPENAI_API_KEY", {
        user_id: user.id,
        session_id: sessionId,
        ...(jobId ? { job_id: jobId } : {}),
      });
      captureMessage("Mock interview realtime client secret missing OPENAI_API_KEY", {
        route: "/api/mock-interview/realtime/client-secret",
        user_id: user.id,
        session_id: sessionId,
        ...(jobId ? { job_id: jobId } : {}),
        tags: {
          feature: "ai_interview",
          provider_path: MOCK_INTERVIEW_LIVE_PROVIDER,
        },
        aiInterview: { stage: "generation", reason: "realtime_error" },
      });
      return NextResponse.json(
        { error: "OPENAI_API_KEY is required for the live mock interview session." },
        { status: 500 }
      );
    }

    const locale: InterviewLocale = parseInterviewLocale(interviewLanguage);

    let customQuestionsBlock = "";
    if (jobId) {
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

    const displayName = userName?.trim() || "there";
    const sessionConfig = getMockInterviewRealtimeSessionConfig({
      locale,
      jobCategory,
      displayName,
      userName: userName?.trim() || "",
      customQuestionsBlock,
    });

    try {
      const minted = await mintRealtimeClientSecret({
        apiKey,
        sessionConfig,
        sessionId,
        ...(jobId ? { jobId } : {}),
      });

      return NextResponse.json({
        client_secret: minted.clientSecret,
        expires_at: minted.expiresAt,
        session: minted.session ?? sessionConfig,
        operation: "client_secret_mint",
        provider: MOCK_INTERVIEW_LIVE_PROVIDER,
        model: sessionConfig.model,
      });
    } catch (error) {
      if (!isOpenAIRealtimeError(error)) {
        throw error;
      }

      const debug = error.toDebugObject();
      logWarn("mock-interview realtime client secret upstream error", {
        operation: error.diagnostics.operation,
        duration_ms: error.diagnostics.durationMs,
        status: error.diagnostics.status,
        status_text: error.diagnostics.statusText,
        response_content_type: error.diagnostics.contentType,
        request_id: error.diagnostics.requestId,
        upstream_kind: error.diagnostics.kind,
        body_preview: error.diagnostics.bodyPreview,
        session_id: sessionId,
        ...(jobId ? { job_id: jobId } : {}),
      });

      captureException(error, {
        route: "/api/mock-interview/realtime/client-secret",
        user_id: user.id,
        session_id: sessionId,
        ...(jobId ? { job_id: jobId } : {}),
        tags: {
          feature: "ai_interview",
          provider_path: MOCK_INTERVIEW_LIVE_PROVIDER,
          operation: error.diagnostics.operation,
          upstream_status: String(error.diagnostics.status ?? "network_error"),
          upstream_kind: error.diagnostics.kind ?? "unknown",
        },
        extra: {
          duration_ms: error.diagnostics.durationMs,
          request_id: error.diagnostics.requestId,
        },
        aiInterview: { stage: "generation", reason: "realtime_error" },
      });

      const headers = new Headers();
      const retryAfter = error.diagnostics.retryAfter;
      if (retryAfter) headers.set("Retry-After", retryAfter);

      return NextResponse.json(
        {
          error: getRealtimeErrorUserMessage(error, VOICE_SERVICE_UNAVAILABLE_MESSAGE),
          code: error.diagnostics.code ?? "client_secret_failed",
          operation: "client_secret_mint",
          provider: MOCK_INTERVIEW_LIVE_PROVIDER,
          debug,
        },
        { status: error.diagnostics.status === 429 ? 429 : 503, headers }
      );
    }
  } catch (error) {
    logError("mock-interview realtime client secret unexpected error", error);
    captureException(error, {
      route: "/api/mock-interview/realtime/client-secret",
      aiInterview: { stage: "generation", reason: "realtime_error" },
    });
    return NextResponse.json({ error: "Failed to start live interview session." }, { status: 500 });
  }
}
