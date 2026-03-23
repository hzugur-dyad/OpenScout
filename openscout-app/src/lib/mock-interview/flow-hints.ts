import type { InterviewLocale } from "@/lib/interview-locale";
import {
  ALL_INTERVIEW_CONTRACT_LINES,
  INTERVIEW_CONTRACT_USER_LINES,
} from "@/lib/mock-interview/interview-contract-messages";

export type ContractStimulus =
  | "timeout"
  | "timeout_warning"
  | "silence"
  | "silence_escalate"
  | null;

export function isInterviewContractLine(message: string): boolean {
  const t = message.trim();
  return ALL_INTERVIEW_CONTRACT_LINES.some((line) => t === line);
}

export function classifyContractStimulus(message: string, locale: InterviewLocale): ContractStimulus {
  const t = message.trim();
  const L = locale === "tr" ? INTERVIEW_CONTRACT_USER_LINES.tr : INTERVIEW_CONTRACT_USER_LINES.en;
  if (t === L.timeout) return "timeout";
  if (t === L.timeoutWarning) return "timeout_warning";
  if (t === L.silenceOrUnrecognized) return "silence";
  if (t === L.silenceEscalate) return "silence_escalate";
  const Lother = locale === "tr" ? INTERVIEW_CONTRACT_USER_LINES.en : INTERVIEW_CONTRACT_USER_LINES.tr;
  if (t === Lother.timeout) return "timeout";
  if (t === Lother.timeoutWarning) return "timeout_warning";
  if (t === Lother.silenceOrUnrecognized) return "silence";
  if (t === Lother.silenceEscalate) return "silence_escalate";
  return null;
}

export type AnswerSignal = "empty" | "very_short" | "low_signal" | "ok";

const LOW_SIGNAL_SNIPPETS_EN = [
  "idk",
  "i don't know",
  "dunno",
  "no idea",
  "chatgpt",
  "google it",
  "google",
  "chat gpt",
  "pass",
  "skip",
  "next question",
  "look it up",
];

const LOW_SIGNAL_SNIPPETS_TR = [
  "bilmiyorum",
  "google",
  "araştır",
  "geç",
  "pas",
  "atla",
  "chatgpt",
];

export function assessAnswerSignal(raw: string, locale: InterviewLocale): AnswerSignal {
  const t = raw.trim();
  if (!t) return "empty";
  const collapsed = t.replace(/\s+/g, " ");
  const wordCount = collapsed.split(" ").filter(Boolean).length;
  if (collapsed.length <= 6 || wordCount <= 1) return "very_short";
  if (collapsed.length <= 18 && wordCount <= 3) return "very_short";

  const lower = collapsed.toLowerCase();
  const snippets = locale === "tr" ? [...LOW_SIGNAL_SNIPPETS_TR, ...LOW_SIGNAL_SNIPPETS_EN] : LOW_SIGNAL_SNIPPETS_EN;
  if (snippets.some((s) => lower === s || lower.includes(s))) return "low_signal";

  return "ok";
}

export function buildMockInterviewServerFlowHint(args: {
  locale: InterviewLocale;
  lastUserMessage: string;
  clientPrev?: { questionId: string; attemptCount: number };
}): string {
  const { locale, lastUserMessage, clientPrev } = args;
  const stimulus = classifyContractStimulus(lastUserMessage, locale);
  const attempt = clientPrev?.attemptCount ?? 1;
  const q = clientPrev?.questionId ?? "(none)";

  if (stimulus === "timeout") {
    return locale === "tr"
      ? `\nAKIŞ SİNYALİ (sunucu): Zaman aşımı — aday yanıt vermedi. Yorum yapma; yeni question_id ile attempt=1 ve yeni ana soruya geç. Önceki soruyu tekrarlama.`
      : `\nFLOW SIGNAL (server): Timeout — candidate did not answer. No commentary; advance with a NEW question_id, attempt=1, new main question. Do not repeat the prior question.`;
  }

  if (stimulus === "timeout_warning") {
    return locale === "tr"
      ? `\nAKIŞ SİNYALİ (sunucu): Gecikme uyarısı — hâlâ aynı konu. Aynı question_id ve mevcut attempt değerini koru; tek cümle kontrol + soruyu kısaca yeniden ifade et; JSON'da is_followup=false ve attempt'i değiştirme (mümkünse önceki attempt ile aynı).`
      : `\nFLOW SIGNAL (server): Delay warning — same topic. Keep the SAME question_id and the SAME attempt as your last control; one brief check-in + restate the question; in JSON use is_followup=false and do not change attempt (match prior attempt when possible).`;
  }

  if (stimulus === "silence_escalate") {
    return locale === "tr"
      ? `\nAKIŞ SİNYALİ (sunucu): Art arda sessizlik — aynı soruyu aynen tekrarlama. Yeni question_id, attempt=1, is_followup=false ile ilerle.`
      : `\nFLOW SIGNAL (server): Repeated silence — do NOT repeat the same question verbatim. Advance: new question_id, attempt=1, is_followup=false.`;
  }

  if (stimulus === "silence") {
    return locale === "tr"
      ? `\nAKIŞ SİNYALİ (sunucu): Sessizlik/algılanamadı — kısa, doğal tekrar iste; aynı question_id üzerinde tek netleştirme turu (attempt=2, is_followup=true) yalnızca önceki attempt=1 ise; aksi halde ilerle.`
      : `\nFLOW SIGNAL (server): Silence / not recognized — short natural repeat request; same question_id with ONE clarify turn (attempt=2, is_followup=true) ONLY if prior attempt was 1; otherwise advance with new question_id, attempt=1.`;
  }

  if (isInterviewContractLine(lastUserMessage)) {
    return "";
  }

  if (clientPrev && clientPrev.attemptCount >= 2) {
    return locale === "tr"
      ? `\nAKIŞ SİNYALİ (sunucu): Bu konuda 2 deneme tamamlandı — mutlaka yeni question_id ve attempt=1 ile ilerle; aynı soruya veya aynı question_id'ye dönme.`
      : `\nFLOW SIGNAL (server): Max attempts on this topic are exhausted — you MUST use a new question_id with attempt=1; do not return to the same question_id.`;
  }

  const sig = assessAnswerSignal(lastUserMessage, locale);

  if (sig === "empty") {
    return locale === "tr"
      ? `\nAKIŞ SİNYALİ (sunucu): Adayın son mesajı boş sayılır. attempt=${attempt}, question_id=${q}. attempt=1 ise: tek, spesifik netleştirme (genel "daha fazla anlat" yok; önceki sorudan bir terim seçip onu sor), attempt=2, is_followup=true. attempt=2 ise: yeni question_id, attempt=1, is_followup=false ile ilerle — takılı kalma.`
      : `\nFLOW SIGNAL (server): Last candidate message is effectively empty. attempt=${attempt}, question_id=${q}. If attempt=1: ONE specific clarify tied to your last question (no generic "explain more"; name one term or assumption from the question), attempt=2, is_followup=true. If attempt=2: MUST advance with new question_id, attempt=1, is_followup=false — do not stall.`;
  }

  if (sig === "very_short" || sig === "low_signal") {
    return locale === "tr"
      ? `\nAKIŞ SİNYALİ (sunucu): Son yanıt çok kısa veya düşük sinyal. attempt=${attempt}, question_id=${q}. attempt=1 ise: tek teknik netleştirme (mekanizma, sınır durumu veya ölçüm) — genel ifade yok. attempt=2 ise: bu konuyu kapat; yeni question_id, attempt=1.`
      : `\nFLOW SIGNAL (server): Last answer is very short or low-signal. attempt=${attempt}, question_id=${q}. If attempt=1: ONE targeted technical clarify (mechanism, edge case, or metric) — not generic. If attempt=2: close this thread; new question_id, attempt=1.`;
  }

  return "";
}
