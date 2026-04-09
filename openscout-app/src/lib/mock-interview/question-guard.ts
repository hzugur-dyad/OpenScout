import type { InterviewLocale } from "@/lib/interview-locale";

const INTERNAL_TOPIC_LABELS = [
  {
    label: "architecture",
    en: "architecture",
    tr: "mimari",
  },
  {
    label: "core_logic",
    en: "core logic",
    tr: "ana uygulama mantigi",
  },
  {
    label: "consistency_correctness",
    en: "consistency and correctness",
    tr: "tutarlilik ve dogruluk",
  },
  {
    label: "scaling",
    en: "performance and scaling",
    tr: "performans ve olceklenebilirlik",
  },
  {
    label: "failure_handling",
    en: "failure handling",
    tr: "hata yonetimi",
  },
  {
    label: "security",
    en: "security",
    tr: "guvenlik",
  },
  {
    label: "tradeoffs_decision",
    en: "trade-offs and decisions",
    tr: "trade-off ve kararlar",
  },
  {
    label: "final_pressure",
    en: "final production pressure",
    tr: "son baski senaryosu",
  },
] as const;

const QUESTION_SEGMENT_PATTERNS = [
  /^(what|why|how|when|where|which|who)\b/i,
  /^(can|could|would|will|do|does|did|is|are|have|has)\s+you\b/i,
  /^(explain|describe|compare|walk me through|talk me through|tell me about|outline|share|give me|design|debug|suppose|imagine|let's say|consider|evaluate|implement)\b/i,
  /^(nedir|neden|nasıl|hangi|ne zaman|nerede|kim)\b/i,
  /^(açıkla|anlat|karşılaştır|örnek ver|tasarla|değerlendir|varsay|düşün|uygularsın|çözerdin|ele al)\b/i,
];

const QUESTION_CUE_PATTERNS = [
  /\b(tell me about|tell me a bit about|walk me through|talk me through|explain|describe|compare|design|debug|how would you|what would you|could you|can you)\b/i,
  /\b(anlatır mısınız|anlatabilir misiniz|açıklar mısınız|örnek verir misiniz|nasıl yaklaşırdınız)\b/i,
];

const QUESTION_END_PATTERNS = [/\b(mısın|misin|musun|müsün|mısınız|misiniz|musunuz|müsünüz)\b/i];

function normalizePrompt(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function topicDisplayPhrases(locale: InterviewLocale): string[] {
  return INTERNAL_TOPIC_LABELS.map((entry) => (locale === "tr" ? entry.tr : entry.en));
}

export function sanitizeInterviewVisibleText(text: string, locale: InterviewLocale): string {
  let sanitized = normalizePrompt(text);

  for (const topic of INTERNAL_TOPIC_LABELS) {
    const replacement = locale === "tr" ? topic.tr : topic.en;
    sanitized = sanitized.replace(new RegExp(`\\b${escapeRegex(topic.label)}\\b`, "gi"), replacement);
  }

  const phraseAlternation = topicDisplayPhrases(locale)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join("|");

  if (phraseAlternation) {
    if (locale === "tr") {
      sanitized = sanitized.replace(
        new RegExp(
          `\\b(${phraseAlternation})\\s+(?:topi(?:g|\\u011f)ine|konusuna|kismina)\\s+ge(?:c|\\u00e7)elim\\b`,
          "giu"
        ),
        "$1 tarafina gecelim"
      );
      sanitized = sanitized.replace(
        new RegExp(`\\b(${phraseAlternation})\\s+(?:topi(?:g|\\u011f)i|konusu|basligi)\\b`, "giu"),
        "$1"
      );
    } else {
      sanitized = sanitized.replace(
        new RegExp(`\\b(${phraseAlternation})\\s+(?:topic|lane|axis)\\b`, "gi"),
        "$1"
      );
    }
  }

  return normalizePrompt(sanitized);
}

function splitPromptSegments(text: string): string[] {
  return normalizePrompt(text)
    .split(/[.!]\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function isQuestionLikeInterviewPrompt(text: string): boolean {
  const normalized = normalizePrompt(text);
  if (!normalized) return false;
  if (normalized.includes("?")) return true;

  const segments = splitPromptSegments(normalized);
  return segments.some((segment) => {
    if (QUESTION_SEGMENT_PATTERNS.some((pattern) => pattern.test(segment))) {
      return true;
    }
    if (QUESTION_CUE_PATTERNS.some((pattern) => pattern.test(segment))) {
      return true;
    }
    return QUESTION_END_PATTERNS.some((pattern) => pattern.test(segment));
  });
}

export function buildInterviewQuestionFallback(locale: InterviewLocale, jobCategory: string): string {
  const roleLabel = jobCategory.trim();
  if (locale === "tr") {
    return roleLabel
      ? `${roleLabel} rolünde yakın zamanda verdiğiniz somut bir teknik kararı ve neden o yaklaşımı seçtiğinizi anlatır mısınız?`
      : "Bu rolde yakın zamanda verdiğiniz somut bir teknik kararı ve neden o yaklaşımı seçtiğinizi anlatır mısınız?";
  }
  return roleLabel
    ? `Walk me through a concrete technical decision you made recently in your work as ${roleLabel} and why you chose that approach.`
    : "Walk me through a concrete technical decision you made recently and why you chose that approach.";
}

export function coerceInterviewQuestionPrompt(params: {
  text: string;
  locale: InterviewLocale;
  jobCategory: string;
  fallbackText?: string | null;
}): string {
  const primary = sanitizeInterviewVisibleText(params.text, params.locale);
  if (isQuestionLikeInterviewPrompt(primary)) {
    return primary;
  }

  const fallback = sanitizeInterviewVisibleText(params.fallbackText ?? "", params.locale);
  if (isQuestionLikeInterviewPrompt(fallback)) {
    return fallback;
  }

  return buildInterviewQuestionFallback(params.locale, params.jobCategory);
}
