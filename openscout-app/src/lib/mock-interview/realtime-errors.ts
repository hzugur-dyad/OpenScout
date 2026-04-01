export type RealtimeErrorDiagnostics = {
  operation: string;
  status?: number | null;
  statusText?: string | null;
  contentType?: string | null;
  bodyPreview?: string;
  durationMs?: number;
  retryAttempt?: number;
  requestId?: string | null;
  code?: string;
  kind?: string;
  retryAfter?: string | null;
  userMessage?: string;
  lastError?: unknown;
};

export type RealtimeErrorDebug = RealtimeErrorDiagnostics & {
  name?: string;
  message?: string;
  stack?: string;
  cause?: unknown;
};

type RealtimeErrorOptions = {
  cause?: unknown;
};

export class OpenAIRealtimeError extends Error {
  readonly diagnostics: RealtimeErrorDiagnostics;
  readonly cause?: unknown;

  constructor(message: string, diagnostics: RealtimeErrorDiagnostics, options?: RealtimeErrorOptions) {
    super(message);
    this.name = "OpenAIRealtimeError";
    this.diagnostics = diagnostics;
    Object.assign(this, diagnostics);
    if (options && "cause" in options) {
      this.cause = options.cause;
    }
  }

  toJSON(): RealtimeErrorDebug {
    return this.toDebugObject();
  }

  toDebugObject(): RealtimeErrorDebug {
    return {
      name: this.name,
      message: this.message,
      stack: this.stack,
      ...this.diagnostics,
      ...(this.cause !== undefined ? { cause: serializeUnknownCause(this.cause) } : {}),
    };
  }
}

export function isOpenAIRealtimeError(error: unknown): error is OpenAIRealtimeError {
  return error instanceof OpenAIRealtimeError;
}

export function getRealtimeErrorUserMessage(error: unknown, fallback: string): string {
  if (isOpenAIRealtimeError(error)) {
    return error.diagnostics.userMessage?.trim() || fallback;
  }

  if (
    error &&
    typeof error === "object" &&
    "userMessage" in error &&
    typeof (error as { userMessage?: unknown }).userMessage === "string"
  ) {
    return ((error as { userMessage: string }).userMessage || fallback).trim() || fallback;
  }

  return fallback;
}

function serializeUnknownCause(value: unknown, depth = 0): unknown {
  if (depth >= 5) return { message: "[cause truncated]" };

  if (value && typeof value === "object" && typeof (value as { toJSON?: unknown }).toJSON === "function") {
    try {
      return serializeUnknownCause((value as { toJSON: () => unknown }).toJSON(), depth + 1);
    } catch {
      // fall through to property-based serialization
    }
  }

  if (value instanceof OpenAIRealtimeError) {
    return value.toDebugObject();
  }

  if (value instanceof Error) {
    const ownEntries = Object.fromEntries(
      Object.getOwnPropertyNames(value).map((key) => [key, (value as unknown as Record<string, unknown>)[key]])
    );
    const maybeDiagnostics =
      "diagnostics" in ownEntries && typeof ownEntries.diagnostics === "object"
        ? ((ownEntries.diagnostics as Record<string, unknown>) ?? {})
        : {};

    return {
      name: typeof ownEntries.name === "string" ? ownEntries.name : value.name,
      message: typeof ownEntries.message === "string" ? ownEntries.message : value.message,
      stack: typeof ownEntries.stack === "string" ? ownEntries.stack : value.stack,
      ...maybeDiagnostics,
      ...("cause" in ownEntries && ownEntries.cause !== undefined
        ? { cause: serializeUnknownCause(ownEntries.cause, depth + 1) }
        : {}),
    };
  }

  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    const keys = new Set([
      ...Object.keys(value),
      ...Object.getOwnPropertyNames(value),
    ]);
    for (const key of keys) {
      const entry = (value as Record<string, unknown>)[key];
      if (entry == null || ["string", "number", "boolean"].includes(typeof entry)) {
        result[key] = entry;
        continue;
      }
      if (typeof entry === "object") {
        result[key] = serializeUnknownCause(entry, depth + 1);
        continue;
      }
      if (typeof entry !== "function") result[key] = String(entry);
    }
    return result;
  }

  return value;
}
