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
  /^(explain|describe|compare|walk me through|talk me through|outline|debug|design|implement|evaluate)\b/i,
  /^(nedir|neden|nas[ıi]l|hangi|ne zaman|nerede|kim)\b/i,
  /^(acikla|anlat|karsilastir|ornek ver|tasarla|degerlendir|debug et|nasil yaklasirdin)\b/i,
];

const QUESTION_CUE_PATTERNS = [
  /\b(walk me through|talk me through|explain|describe|compare|design|debug|how would you|what would you|could you|can you)\b/i,
  /\b(anlatir misiniz|anlatabilir misiniz|aciklar misiniz|ornek verir misiniz|nasil yaklasirdiniz)\b/i,
];

const QUESTION_END_PATTERNS = [/\b(misin|musun|misiniz|musunuz)\b/i];

const LEADING_SENTENCE_STRIP_PATTERNS = [
  /^(?:hi|hello|hey|merhaba|selam)\b[^.?!]*[.?!]\s*/i,
  /^(?:i'?m nova\b[^.?!]*[.?!]\s*)+/i,
  /^(?:ben nova(?:'yim)?\b[^.?!]*[.?!]\s*)+/i,
  /^(?:i'?ll be with you[^.?!]*[.?!]\s*)+/i,
  /^(?:bugun gorusmede[^.?!]*[.?!]\s*)+/i,
  /^(?:okay|ok|tamam|peki|all right)\b[.?!]\s*/i,
  /^(?:let'?s move on|moving on|next question|devam edelim|bir sonraki soruya geciyorum)\b[^.?!]*[.?!]\s*/i,
  /^(?:[^.?!]*tarafina gecelim)\b[.?!]\s*/i,
];

const LEADING_CLAUSE_STRIP_PATTERNS = [
  /^(?:hi|hello|hey|merhaba|selam)\b[^,;:]*[,;:]\s*/i,
  /^(?:okay|ok|tamam|peki|all right)\b[,;:]\s*/i,
];

const FORBIDDEN_LEAD_PATTERNS = [
  /^(?:let'?s dive(?: into)?|let'?s consider|assume\b|imagine\b|consider a scenario where\b|suppose\b|you'?re working on\b)/i,
  /^(?:diyelim ki|varsay|hayal et|bir senaryo dusun|senaryo olarak|simdi soyle)\b/i,
  /^(?:thanks|thank you|tesekkurler|sag ol)\b/i,
  /^(?:i'?m nova|ben nova)\b/i,
  /^(?:hi|hello|hey|merhaba|selam)\b/i,
  /^(?:let'?s move on|moving on|next question|devam edelim|bir sonraki soru)\b/i,
];

const NON_TECHNICAL_PROMPT_PATTERNS = [
  /\b(tell me about yourself|introduce yourself|why do you want|biggest strength|biggest weakness|leadership style|team conflict|stakeholder management)\b/i,
  /\b(kendinden bahset|kendinizi tanitin|neden bu rol|en buyuk guclu yon|en buyuk zayif yon|ekip catismasi)\b/i,
];

function normalizePrompt(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function topicDisplayPhrases(locale: InterviewLocale): string[] {
  return INTERNAL_TOPIC_LABELS.map((entry) => (locale === "tr" ? entry.tr : entry.en));
}

function stripLeadingInterviewIntro(text: string): string {
  let stripped = normalizePrompt(text);
  let changed = true;

  while (changed) {
    changed = false;

    for (const pattern of LEADING_SENTENCE_STRIP_PATTERNS) {
      const next = stripped.replace(pattern, "").trim();
      if (next !== stripped) {
        stripped = next;
        changed = true;
      }
    }

    for (const pattern of LEADING_CLAUSE_STRIP_PATTERNS) {
      const next = stripped.replace(pattern, "").trim();
      if (next !== stripped) {
        stripped = next;
        changed = true;
      }
    }
  }

  return stripped;
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
      sanitized = sanitized.replace(new RegExp(`\\b(${phraseAlternation})\\s+(?:topic|lane|axis)\\b`, "gi"), "$1");
    }
  }

  return normalizePrompt(sanitized);
}

function splitPromptSegments(text: string): string[] {
  const normalized = normalizePrompt(text);
  if (!normalized) return [];

  const segments = new Set<string>([normalized]);

  for (const sentence of normalized.split(/(?<=[.?!])\s+/)) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;
    segments.add(trimmedSentence);

    for (const clause of trimmedSentence.split(/[,;:]\s+/)) {
      const trimmedClause = clause.trim();
      if (trimmedClause) {
        segments.add(trimmedClause);
      }
    }
  }

  return [...segments];
}

function isQuestionLikeSegment(segment: string): boolean {
  const normalized = normalizePrompt(segment);
  if (!normalized) return false;
  if (normalized.includes("?")) return true;

  if (QUESTION_SEGMENT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }
  if (QUESTION_CUE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }
  return QUESTION_END_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isForbiddenQuestionLead(segment: string): boolean {
  const normalized = normalizePrompt(segment);
  if (!normalized) return false;
  if (NON_TECHNICAL_PROMPT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }
  return FORBIDDEN_LEAD_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isQuestionLikeInterviewPrompt(text: string): boolean {
  return splitPromptSegments(text).some((segment) => isQuestionLikeSegment(segment) && !isForbiddenQuestionLead(segment));
}

export function extractInterviewQuestionPrompt(text: string, locale: InterviewLocale): string | null {
  const sanitized = sanitizeInterviewVisibleText(text, locale);
  if (!sanitized) return null;

  const stripped = stripLeadingInterviewIntro(sanitized);
  const candidates = splitPromptSegments(stripped).sort((a, b) => a.length - b.length);

  for (const candidate of candidates) {
    const normalizedCandidate = normalizePrompt(candidate.replace(/^[\-\u2014]\s*/, ""));
    if (!normalizedCandidate) continue;
    if (isForbiddenQuestionLead(normalizedCandidate)) continue;
    if (isQuestionLikeSegment(normalizedCandidate)) {
      return normalizedCandidate;
    }
  }

  return null;
}

export function buildInterviewQuestionFallback(locale: InterviewLocale, jobCategory: string): string {
  const roleLabel = jobCategory.trim();
  if (locale === "tr") {
    return roleLabel
      ? `${roleLabel} rolunde yakin zamanda verdiginiz somut bir teknik karari ve neden o yaklasimi sectiginizi anlatir misiniz?`
      : "Bu rolde yakin zamanda verdiginiz somut bir teknik karari ve neden o yaklasimi sectiginizi anlatir misiniz?";
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
  const primary = extractInterviewQuestionPrompt(params.text, params.locale);
  if (primary) {
    return primary;
  }

  const fallback = extractInterviewQuestionPrompt(params.fallbackText ?? "", params.locale);
  if (fallback) {
    return fallback;
  }

  return buildInterviewQuestionFallback(params.locale, params.jobCategory);
}
