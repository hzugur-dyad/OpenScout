/**
 * Structured logger for server-side monitoring. Outputs JSON to console.
 * Do not log sensitive data (passwords, tokens, full request bodies).
 */

type LogLevel = "info" | "warn" | "error";

function formatLog(level: LogLevel, message: string, data?: unknown): string {
  const payload: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };
  if (data !== undefined) {
    payload.data = data;
  }
  return JSON.stringify(payload);
}

export function logInfo(message: string, data?: unknown): void {
  console.log(formatLog("info", message, data));
}

export function logWarn(message: string, data?: unknown): void {
  console.warn(formatLog("warn", message, data));
}

export function logError(message: string, error?: unknown): void {
  const safeError =
    error instanceof Error
      ? { name: error.name, message: error.message }
      : error !== undefined
        ? String(error)
        : undefined;
  console.error(formatLog("error", message, safeError));
}
