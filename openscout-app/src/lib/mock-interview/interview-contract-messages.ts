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
    /** First-phase delay: still waiting, nudge without burning a topic attempt */
    timeoutWarning:
      "[Candidate is taking longer than usual to respond. Briefly check in, restate the current question in one short sentence, and keep the same topic — do not advance yet.]",
    /** After repeated silence cues: must advance topic */
    silenceEscalate:
      "[User remained silent again after a repeat prompt. Do not re-ask the same wording. Acknowledge briefly and move to the next topic with a new question_id and attempt=1.]",
  },
  tr: {
    timeout: "[Aday belirlenen süre içinde yanıt vermedi.]",
    silenceOrUnrecognized:
      "[Kullanıcı sessiz kaldı veya konuşma algılanamadı. Kısaca tekrar etmesini iste.]",
    timeoutWarning:
      "[Aday olağandan uzun süredir yanıt vermiyor. Kısa bir kontrol cümlesi kur, mevcut soruyu tek cümlede yeniden ifade et ve aynı konuda kal — henüz ilerleme.]",
    silenceEscalate:
      "[Kullanıcı tekrar istemine rağmen yine sessiz kaldı. Aynı ifadeyle sorma. Kısaca onayla ve yeni question_id ile attempt=1 ve yeni konuya geç.]",
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

/** All bracket contract lines (any locale) for server-side detection */
export const ALL_INTERVIEW_CONTRACT_LINES: readonly string[] = [
  ...Object.values(INTERVIEW_CONTRACT_USER_LINES.en),
  ...Object.values(INTERVIEW_CONTRACT_USER_LINES.tr),
];
