/**
 * Single source of truth for synthetic user lines the client sends when the candidate
 * times out or speech fails. Must stay in sync with interviewer prompts (prompts.ts).
 */
import type { InterviewLocale } from "@/lib/interview-locale";

export const INTERVIEW_CONTRACT_USER_LINES = {
  en: {
    /** Sent after one repeat when the candidate still never starts answering */
    timeout:
      "[Candidate gave no response after one repeat. Mark this question as unanswered/no_response and move to the next question.]",
    /** Sent when STT ends with no text or no-speech / audio errors */
    silenceOrUnrecognized:
      "[User was silent or speech was not recognized. Ask them to repeat briefly.]",
    /** Legacy delay-warning contract line kept for compatibility with existing prompts */
    timeoutWarning:
      "[Candidate is taking longer than usual to respond. Briefly check in, restate the current question in one short sentence, and keep the same topic - do not advance yet.]",
    /** After repeated silence cues: must advance topic */
    silenceEscalate:
      "[User remained silent again after a repeat prompt. Do not re-ask the same wording. Acknowledge briefly and move to the next topic with a new question_id and attempt=1.]",
  },
  tr: {
    timeout:
      "[Aday ayni soru bir kez tekrar edildikten sonra da yanit vermedi. Bu soruyu unanswered/no_response olarak isaretle ve sonraki soruya gec.]",
    silenceOrUnrecognized:
      "[Kullanici sessiz kaldi veya konusma algilanamadi. Kisaca tekrar etmesini iste.]",
    timeoutWarning:
      "[Aday olandan uzun suredir yanit vermiyor. Kisa bir kontrol cumlesi kur, mevcut soruyu tek cumlede yeniden ifade et ve ayni konuda kal - henuz ilerleme.]",
    silenceEscalate:
      "[Kullanici tekrar istemine ragmen yine sessiz kaldi. Ayni ifadeyle sorma. Kisaca onayla ve yeni question_id ile attempt=1 ve yeni konuya gec.]",
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
