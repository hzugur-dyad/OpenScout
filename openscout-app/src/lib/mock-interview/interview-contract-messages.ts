/**
 * Single source of truth for synthetic user lines the client sends when the candidate
 * times out or speech fails. Must stay in sync with interviewer prompts (prompts.ts).
 */
import type { InterviewLocale } from "@/lib/interview-locale";

export const INTERVIEW_CONTRACT_USER_LINES = {
  en: {
    /** Sent when the response timer fires without a user answer */
    timeout: "[Candidate did not respond within the time limit.]",
    /** Sent when STT ends with no text or no-speech / audio errors */
    silenceOrUnrecognized:
      "[User was silent or speech was not recognized. Ask them to repeat briefly.]",
  },
  tr: {
    timeout: "[Aday belirlenen süre içinde yanıt vermedi.]",
    silenceOrUnrecognized:
      "[Kullanıcı sessiz kaldı veya konuşma algılanamadı. Kısaca tekrar etmesini iste.]",
  },
} as const;

export function getInterviewTimeoutUserLine(locale: InterviewLocale): string {
  return locale === "tr" ? INTERVIEW_CONTRACT_USER_LINES.tr.timeout : INTERVIEW_CONTRACT_USER_LINES.en.timeout;
}

export function getInterviewSilenceUserLine(locale: InterviewLocale): string {
  return locale === "tr"
    ? INTERVIEW_CONTRACT_USER_LINES.tr.silenceOrUnrecognized
    : INTERVIEW_CONTRACT_USER_LINES.en.silenceOrUnrecognized;
}
