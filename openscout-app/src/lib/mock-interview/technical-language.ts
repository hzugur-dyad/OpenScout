import type { InterviewLocale } from "@/lib/interview-locale";
import { ALL_INTERVIEW_CONTRACT_LINES } from "@/lib/mock-interview/interview-contract-messages";

type ChatMessageLike = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type TechnicalTermReplacement = {
  original: string;
  normalized: string;
};

const UNIVERSAL_TECHNICAL_TERMS = [
  "API",
  "backend / frontend",
  "async / await",
  "database / query",
  "React / Next.js",
  "authentication / authorization",
  "REST / GraphQL",
] as const;

const TECHNICAL_TERM_VARIANTS: ReadonlyArray<{ pattern: RegExp; normalized: string }> = [
  { pattern: /(?<![\p{L}\p{N}_])apı(?![\p{L}\p{N}_])/giu, normalized: "api" },
  { pattern: /(?<![\p{L}\p{N}_])bekend(?![\p{L}\p{N}_])/giu, normalized: "backend" },
  { pattern: /(?<![\p{L}\p{N}_])back[\s-]+end(?![\p{L}\p{N}_])/giu, normalized: "backend" },
  { pattern: /(?<![\p{L}\p{N}_])frondend(?![\p{L}\p{N}_])/giu, normalized: "frontend" },
  { pattern: /(?<![\p{L}\p{N}_])frontent(?![\p{L}\p{N}_])/giu, normalized: "frontend" },
  { pattern: /(?<![\p{L}\p{N}_])front[\s-]+end(?![\p{L}\p{N}_])/giu, normalized: "frontend" },
  { pattern: /(?<![\p{L}\p{N}_])databeyz(?![\p{L}\p{N}_])/giu, normalized: "database" },
  { pattern: /(?<![\p{L}\p{N}_])kveri(?![\p{L}\p{N}_])/giu, normalized: "query" },
] as const;

function isContractLine(content: string): boolean {
  return ALL_INTERVIEW_CONTRACT_LINES.includes(content.trim());
}

export function buildBilingualTechnicalLanguagePrompt(locale: InterviewLocale): string {
  const responseLanguageLock =
    locale === "tr"
      ? 'interview_language="tr" -> respond ONLY in Turkish.'
      : 'interview_language="en" -> respond ONLY in English.';

  const localeSpecificRule =
    locale === "tr"
      ? "- In Turkish interviews, respond only in Turkish, but keep widely-used technical terms in English when natural. Do not translate every technical term awkwardly.\n- Preserve Turkish characters exactly in visible output. Never transliterate ç, ğ, ı, İ, ö, ş, ü to ASCII."
      : "- In English interviews, respond only in English.";

  return `LANGUAGE AND TERMINOLOGY:
- RESPONSE LANGUAGE LOCK: ${responseLanguageLock}
- Internal understanding must stay bilingual across Turkish + English technical language.
- You are fluent in bilingual (Turkish + English) technical communication.
- Users may mix languages in the same sentence. You must correctly interpret all technical concepts regardless of language mixing and continue without asking for clarification.
- Treat English technical terms as universal and always understand them naturally: ${UNIVERSAL_TECHNICAL_TERMS.join(", ")}.
${localeSpecificRule}
- Visible output must sound spoken and human, not stiff written prose.
- Preserve technical depth. Do not shorten the response just to make it sound concise.
- Do not correct the candidate's language mid-interview.
- Do not ask "did you mean X?" unless absolutely necessary to resolve real ambiguity.
- If a user message includes <technical_normalization>...</technical_normalization>, use it silently for understanding only and never mention the tag or the normalization process.
- You must NEVER fail or get confused because the candidate mixes Turkish and English technical terminology.`;
}

export function normalizeTechnicalTerms(text: string): {
  standardizedText: string;
  replacements: TechnicalTermReplacement[];
} {
  let standardizedText = text;
  const replacements = new Map<string, TechnicalTermReplacement>();

  for (const { pattern, normalized } of TECHNICAL_TERM_VARIANTS) {
    standardizedText = standardizedText.replace(pattern, (match) => {
      const original = match.toLocaleLowerCase("tr");
      const key = `${original}:${normalized}`;
      if (!replacements.has(key)) {
        replacements.set(key, { original, normalized });
      }
      return normalized;
    });
  }

  return {
    standardizedText,
    replacements: [...replacements.values()],
  };
}

function buildTechnicalNormalizationHint(content: string): string | null {
  const { standardizedText, replacements } = normalizeTechnicalTerms(content);
  if (replacements.length === 0) return null;

  const normalizedTerms = replacements.map(({ original, normalized }) => `${original}=${normalized}`).join("; ");
  return `<technical_normalization>terms: ${normalizedTerms} | standardized: ${standardizedText}</technical_normalization>`;
}

export function enrichInterviewMessagesForModel<T extends ChatMessageLike>(messages: readonly T[]): T[] {
  return messages.map((message) => {
    if (message.role !== "user") return message;
    if (!message.content.trim() || isContractLine(message.content)) return message;

    const hint = buildTechnicalNormalizationHint(message.content);
    if (!hint) return message;

    return {
      ...message,
      content: `${message.content}\n${hint}`,
    };
  });
}
