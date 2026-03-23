/**
 * Maps provider / API error strings to safe, human-readable copy for the UI.
 * Avoids exposing raw stack traces, JSON, or internal messages.
 */

export function mapSupabaseAuthError(raw: string): string {
  const m = raw.trim();
  const lower = m.toLowerCase();
  if (!m) return "Something went wrong. Please try again.";

  if (
    lower.includes("invalid login credentials") ||
    lower.includes("invalid credentials") ||
    lower.includes("invalid email or password")
  ) {
    return "Invalid email or password. Check your details and try again.";
  }
  if (lower.includes("email not confirmed")) {
    return "Confirm your email before signing in. Check your inbox for the confirmation link.";
  }
  if (lower.includes("user already registered") || lower.includes("already registered")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (lower.includes("signup_disabled") || lower.includes("signups not allowed")) {
    return "New sign-ups are not available right now. Please try again later.";
  }
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return "Connection problem. Check your network and try again.";
  }
  if (m.length > 180 || m.includes("{") || m.includes("JWT") || m.includes("sql")) {
    return "Something went wrong. Please try again.";
  }
  return m;
}

export function mapSignupAuthError(raw: string): string {
  const m = raw.trim();
  const lower = m.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("rate_limit")) {
    return "Too many sign-up attempts. Please wait a few minutes and try again.";
  }
  if (lower.includes("user already registered") || lower.includes("already registered")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  return mapSupabaseAuthError(m);
}

/** Parses JSON error body and returns a safe message for display. */
export function messageFromApiErrorBody(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "error" in data) {
    const err = (data as { error?: unknown }).error;
    if (typeof err === "string" && err.trim()) {
      return mapGenericUserMessage(err.trim(), fallback);
    }
  }
  return fallback;
}

export function mapGenericUserMessage(raw: string, fallback: string): string {
  const m = raw.trim();
  if (!m) return fallback;
  const lower = m.toLowerCase();
  if (lower === "unauthorized") return "Your session expired. Sign in again and retry.";
  if (lower.includes("limit reached") || lower.includes("weekly")) return m;
  if (m.length > 220 || m.includes("{") || m.includes("[") || m.includes("stack")) {
    return fallback;
  }
  return m;
}

export function mapCvAnalysisClientError(raw: string): string {
  return mapGenericUserMessage(
    raw,
    "We could not analyze your CV right now. Check your file and connection, then try again."
  );
}

export function mapMicrophoneError(err: DOMException | Error, deniedMessage: string): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      return deniedMessage;
    }
    if (err.name === "NotFoundError") {
      return "No microphone was found. Connect a microphone and try again.";
    }
    if (err.name === "NotReadableError" || err.name === "AbortError") {
      return "Your microphone is in use or unavailable. Close other apps using it and try again.";
    }
  }
  const m = err.message?.trim() ?? "";
  if (m.length > 0 && m.length < 120 && !m.includes("DOMException")) return m;
  return deniedMessage;
}

export function mapTtsUserError(_raw: string): string {
  return "Voice playback is unavailable right now. You can still read Nova's replies on screen.";
}
