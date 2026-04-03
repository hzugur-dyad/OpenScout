import type { InterviewLocale } from "@/lib/interview-locale";

const MAX_SPEAKABLE_TEXT_LENGTH = 4500;
const MAX_SPEECH_CHUNKS = 3;
const SHORT_SPEECH_THRESHOLD = 120;
const MEDIUM_SPEECH_THRESHOLD = 260;
const TARGET_CHUNK_SIZE = 170;
const MAX_CHUNK_SIZE = 240;

function stripTrailingInterviewControlJson(text: string): string {
  const trimmed = text.trim();
  const jsonStart = trimmed.lastIndexOf("{");
  if (jsonStart < 0) return trimmed;

  const candidate = trimmed.slice(jsonStart);
  try {
    const parsed = JSON.parse(candidate) as { type?: unknown };
    if (parsed?.type === "question_control" || parsed?.type === "interview_end") {
      return trimmed.slice(0, jsonStart).trim();
    }
  } catch {
    // Ignore non-JSON suffixes.
  }

  return trimmed;
}

function normalizeSpeechWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ");
}

function cleanFormattingForSpeech(text: string): string {
  return text
    .replace(/<technical_normalization>[\s\S]*?<\/technical_normalization>/gi, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[ \t]*\n[ \t]*(?:[-*]|\u2022|\d+[.)])\s+/g, ". ")
    .replace(/\s*([,;:!?])\s*/g, "$1 ")
    .replace(/\s*\.\s*/g, ". ")
    .replace(/\.{4,}/g, "...")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function formatTurkishTextForSpeech(rawText: string): string {
  return stripTrailingInterviewControlJson(rawText);
}

function capitalizeSentence(text: string, locale: InterviewLocale): string {
  if (!text) return text;
  return text.charAt(0).toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-US") + text.slice(1);
}

const TR_DIRECT_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bYapilandirmayi dusunmelisin\b/gi, replacement: "Sunu deneyebilirsin" },
  { pattern: /\bDusunmelisin\b/gi, replacement: "Bakmak iyi olur" },
  { pattern: /^\s*Senin de soyledigin gibi,\s*/i, replacement: "" },
  { pattern: /^\s*Senin dedigin gibi,\s*/i, replacement: "" },
  { pattern: /^\s*Az once soyledigin gibi,\s*/i, replacement: "" },
  { pattern: /^\s*Soz ettigin noktada,\s*/i, replacement: "Bu noktada, " },
];

const EN_DIRECT_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bYou should consider implementing\b/gi, replacement: "You could try" },
  { pattern: /\bYou should consider\b/gi, replacement: "You could" },
  { pattern: /^\s*You mentioned that\s+/i, replacement: "" },
  { pattern: /^\s*You mentioned\s+/i, replacement: "" },
  { pattern: /^\s*As you said,\s*/i, replacement: "" },
  { pattern: /^\s*As you mentioned,\s*/i, replacement: "" },
  { pattern: /^\s*Like you said,\s*/i, replacement: "" },
];

function humanizeSpeechSentence(text: string, locale: InterviewLocale): string {
  const directReplacements = locale === "tr" ? TR_DIRECT_REPLACEMENTS : EN_DIRECT_REPLACEMENTS;

  if (locale === "tr") {
    return text;
  }

  let sentence = text.trim();

  for (const { pattern, replacement } of directReplacements) {
    sentence = sentence.replace(pattern, replacement);
  }

  sentence = sentence.replace(/\s{2,}/g, " ").trim();
  return capitalizeSentence(sentence, locale);
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((part) => part.replace(/\n+/g, " ").replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);
}

function splitIntoSentences(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function splitLongSentence(sentence: string): string[] {
  if (sentence.length <= MAX_CHUNK_SIZE) return [sentence];

  const coarseParts = sentence
    .split(/(?<=[,;:])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (coarseParts.length <= 1) return [sentence];

  const chunks: string[] = [];
  let current = "";

  for (const part of coarseParts) {
    const candidate = current ? `${current} ${part}` : part;
    if (candidate.length <= MAX_CHUNK_SIZE) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current.trim());
    }
    current = part;
  }

  if (current) {
    chunks.push(current.trim());
  }

  return chunks.length > 0 ? chunks : [sentence];
}

function mergeChunksToLimit(chunks: string[], maxChunks: number): string[] {
  const next = [...chunks];
  while (next.length > maxChunks) {
    let mergeIndex = 0;
    let smallestCombinedLength = Number.POSITIVE_INFINITY;

    for (let i = 0; i < next.length - 1; i += 1) {
      const combinedLength = `${next[i]} ${next[i + 1]}`.length;
      if (combinedLength < smallestCombinedLength) {
        smallestCombinedLength = combinedLength;
        mergeIndex = i;
      }
    }

    next.splice(mergeIndex, 2, `${next[mergeIndex]} ${next[mergeIndex + 1]}`.trim());
  }

  return next;
}

function targetChunkCount(text: string, sentences: string[]): number {
  if (sentences.length <= 1 && text.length <= SHORT_SPEECH_THRESHOLD) {
    return 1;
  }
  if (text.length <= MEDIUM_SPEECH_THRESHOLD && sentences.length <= 3) {
    return 2;
  }
  return 3;
}

function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function formatTextForSpeech(rawText: string, _locale: InterviewLocale): string {
  if (_locale === "tr") {
    return formatTurkishTextForSpeech(rawText);
  }

  const withoutControlPayload = stripTrailingInterviewControlJson(rawText);
  const normalizedWhitespace = normalizeSpeechWhitespace(withoutControlPayload);
  const speakableText = cleanFormattingForSpeech(normalizedWhitespace);
  return speakableText.length > MAX_SPEAKABLE_TEXT_LENGTH
    ? speakableText.slice(0, MAX_SPEAKABLE_TEXT_LENGTH).trim()
    : speakableText;
}

export function splitTextIntoSpeechChunks(rawText: string, locale: InterviewLocale): string[] {
  const formatted = formatTextForSpeech(rawText, locale);
  if (!formatted) return [];

  if (locale === "tr") {
    return [formatted];
  }

  const sentences = splitIntoParagraphs(formatted)
    .flatMap(splitIntoSentences)
    .flatMap(splitLongSentence)
    .map((sentence) => humanizeSpeechSentence(sentence, locale))
    .filter(Boolean);

  if (sentences.length === 0) return [];
  if (sentences.length === 1 && sentences[0]!.length <= MAX_CHUNK_SIZE) {
    return sentences;
  }

  const desiredChunks = Math.min(MAX_SPEECH_CHUNKS, targetChunkCount(formatted, sentences));
  const chunks: string[] = [];
  let current = "";

  for (let i = 0; i < sentences.length; i += 1) {
    const sentence = sentences[i]!;
    const remainingSentences = sentences.length - i;
    const remainingChunkSlots = Math.max(1, desiredChunks - chunks.length);
    const candidate = current ? `${current} ${sentence}` : sentence;
    const shouldBreak =
      current.length > 0 &&
      (candidate.length > TARGET_CHUNK_SIZE ||
        candidate.length > MAX_CHUNK_SIZE ||
        remainingSentences < remainingChunkSlots);

    if (shouldBreak) {
      chunks.push(current.trim());
      current = sentence;
      continue;
    }

    current = candidate;
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return mergeChunksToLimit(chunks, MAX_SPEECH_CHUNKS);
}

export function getSpeechChunkPauseMs(chunk: string): number {
  const trimmed = chunk.trim();
  if (!trimmed) return 120;
  if (trimmed.endsWith("?")) return 230;
  if (trimmed.endsWith("!")) return 210;
  return 180;
}

export function buildSsmlForSpeech(rawText: string, locale: InterviewLocale): string {
  if (locale === "tr") {
    const exactText = formatTextForSpeech(rawText, locale);
    return exactText ? `<speak>${escapeXml(exactText)}</speak>` : "<speak></speak>";
  }

  const chunks = splitTextIntoSpeechChunks(rawText, locale);
  if (chunks.length === 0) return "<speak></speak>";

  const paragraphs = chunks;
  const paragraphSsml = paragraphs
    .map((paragraph) => {
      const sentenceSsml = splitIntoSentences(paragraph)
        .map((sentence) => `<s>${escapeXml(sentence)}</s>`)
        .join("");
      return sentenceSsml ? `<p>${sentenceSsml}</p>` : "";
    })
    .join("");

  if (!paragraphSsml) {
    return `<speak>${escapeXml(chunks.join(" "))}</speak>`;
  }

  return `<speak>${paragraphSsml}</speak>`;
}
