import * as Sentry from "@sentry/nextjs";

export type AiInterviewMonitoringReason =
  | "parse_failure"
  | "empty_model"
  | "max_turns"
  | "fallback_scoring_used"
  | "groq_error"
  | "tts_error";

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

/** Report an error to Sentry when configured; always logs a short line locally. */
export function captureException(error: unknown, context?: MonitoringContext): void {
  const normalized =
    error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown error");
  console.error("[monitoring]", context?.route ?? "error", normalized.message);

  Sentry.withScope((scope) => {
    applyMonitoringContext(scope, context);
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
