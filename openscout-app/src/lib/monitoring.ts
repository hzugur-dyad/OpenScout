import * as Sentry from "@sentry/nextjs";
import { isOpenAIRealtimeError } from "@/lib/mock-interview/realtime-errors";

export type AiInterviewMonitoringReason =
  | "parse_failure"
  | "empty_model"
  | "max_turns"
  | "fallback_scoring_used"
  | "groq_error"
  | "tts_error"
  | "realtime_error"
  | "realtime_duplicate_turn"
  | "realtime_stuck_turn";

export type MonitoringContext = {
  route?: string;
  user_id?: string;
  session_id?: string;
  job_id?: string;
  tags?: Record<string, string>;
  extra?: Record<string, string | number | boolean | null | undefined>;
  aiInterview?: {
    stage: "generation" | "evaluation";
    reason: AiInterviewMonitoringReason;
  };
};

type CaptureMessageContext = MonitoringContext & {
  level?: "fatal" | "error" | "warning" | "log" | "info" | "debug";
};

type SerializedError = {
  name?: string;
  message: string;
  stack?: string;
  operation?: string;
  status?: number | null;
  statusText?: string | null;
  contentType?: string | null;
  bodyPreview?: string;
  durationMs?: number;
  retryAttempt?: number;
  requestId?: string | null;
  code?: string;
  kind?: string;
  cause?: SerializedError | Record<string, unknown> | string | null;
};

function applyMonitoringContext(scope: Sentry.Scope, context?: MonitoringContext): void {
  if (!context) return;
  if (context.route) {
    scope.setTag("route", context.route);
    scope.setContext("openscout", { route: context.route });
  }
  if (context.user_id) scope.setUser({ id: context.user_id });
  if (context.session_id) scope.setTag("session_id", context.session_id);
  if (context.job_id) scope.setTag("job_id", context.job_id);
  if (context.tags) {
    for (const [k, v] of Object.entries(context.tags)) {
      scope.setTag(k, v);
    }
  }
  if (context.extra) {
    scope.setExtras(context.extra as Record<string, unknown>);
  }
  if (context.aiInterview) {
    scope.setTag("feature", "ai_interview");
    scope.setTag("stage", context.aiInterview.stage);
    scope.setTag("reason", context.aiInterview.reason);
  }
}

function serializeUnknownError(error: unknown, depth = 0): SerializedError | Record<string, unknown> {
  if (depth >= 5) {
    return { message: "[error chain truncated]" };
  }

  if (error && typeof error === "object" && typeof (error as { toJSON?: unknown }).toJSON === "function") {
    try {
      return serializeUnknownError((error as { toJSON: () => unknown }).toJSON(), depth + 1);
    } catch {
      // fall through to property-based serialization
    }
  }

  if (isOpenAIRealtimeError(error)) {
    return error.toDebugObject();
  }

  if (error instanceof Error) {
    const ownEntries = Object.fromEntries(
      Object.getOwnPropertyNames(error).map((key) => [key, (error as unknown as Record<string, unknown>)[key]])
    );
    const diagnostics =
      typeof ownEntries.diagnostics === "object" && ownEntries.diagnostics
        ? (ownEntries.diagnostics as Record<string, unknown>)
        : {};

    return {
      name: typeof ownEntries.name === "string" ? ownEntries.name : error.name,
      message: typeof ownEntries.message === "string" ? ownEntries.message : error.message,
      stack: typeof ownEntries.stack === "string" ? ownEntries.stack : error.stack,
      ...(typeof ownEntries.operation === "string" ? { operation: ownEntries.operation } : {}),
      ...("status" in ownEntries ? { status: (ownEntries.status as number | null | undefined) ?? null } : {}),
      ...(typeof ownEntries.statusText === "string" ? { statusText: ownEntries.statusText } : {}),
      ...(typeof ownEntries.contentType === "string" ? { contentType: ownEntries.contentType } : {}),
      ...(typeof ownEntries.bodyPreview === "string" ? { bodyPreview: ownEntries.bodyPreview } : {}),
      ...(typeof ownEntries.durationMs === "number" ? { durationMs: ownEntries.durationMs } : {}),
      ...(typeof ownEntries.retryAttempt === "number" ? { retryAttempt: ownEntries.retryAttempt } : {}),
      ...(typeof ownEntries.requestId === "string" ? { requestId: ownEntries.requestId } : {}),
      ...(typeof ownEntries.code === "string" ? { code: ownEntries.code } : {}),
      ...(typeof ownEntries.kind === "string" ? { kind: ownEntries.kind } : {}),
      ...diagnostics,
      ...(ownEntries.cause !== undefined ? { cause: serializeUnknownError(ownEntries.cause, depth + 1) } : {}),
    };
  }

  if (error && typeof error === "object") {
    const serialized: Record<string, unknown> = {};
    const keys = new Set([
      ...Object.keys(error),
      ...Object.getOwnPropertyNames(error),
    ]);
    for (const key of keys) {
      const value = (error as Record<string, unknown>)[key];
      if (value == null || ["string", "number", "boolean"].includes(typeof value)) {
        serialized[key] = value;
        continue;
      }
      if (typeof value === "object") {
        serialized[key] = serializeUnknownError(value, depth + 1);
        continue;
      }
      if (typeof value !== "function") serialized[key] = String(value);
    }
    return serialized;
  }

  return { message: typeof error === "string" ? error : "Unknown error" };
}

/** Report an error to Sentry when configured; always logs a short line locally. */
export function captureException(error: unknown, context?: MonitoringContext): void {
  const normalized =
    error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown error");
  const serialized = serializeUnknownError(error);
  console.error("[monitoring]", context?.route ?? "error", serialized);

  Sentry.withScope((scope) => {
    applyMonitoringContext(scope, context);
    scope.setContext("error_chain", serialized as Record<string, unknown>);
    Sentry.captureException(normalized);
  });
}

/** Structured signal (non-throwing paths). Uses warning by default for AI degradation signals. */
export function captureMessage(message: string, context?: CaptureMessageContext): void {
  const { level = "warning", ...ctx } = context ?? {};
  if (process.env.NODE_ENV !== "production") {
    console.warn("[monitoring]", ctx.route ?? "", message);
  }

  Sentry.withScope((scope) => {
    applyMonitoringContext(scope, ctx);
    Sentry.captureMessage(message, level);
  });
}
