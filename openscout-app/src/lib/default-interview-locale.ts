import type { InterviewLocale } from "./interview-locale";

/**
 * Default interview language from the browser (client only). On SSR, callers
 * should use a static initial value (e.g. "en") until this runs after mount.
 */
export function getDefaultInterviewLocale(): InterviewLocale {
  if (typeof window === "undefined") return "en";
  const raw = (navigator.languages?.[0] ?? navigator.language ?? "").toLowerCase();
  return raw.startsWith("tr") ? "tr" : "en";
}
