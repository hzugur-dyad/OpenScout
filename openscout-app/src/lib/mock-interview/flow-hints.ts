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

const MOCK_INTERVIEW_TOPICS = [
  { key: "architecture", preferredQuestionId: "architecture" },
  { key: "core_logic", preferredQuestionId: "core_logic" },
  { key: "consistency_correctness", preferredQuestionId: "consistency" },
  { key: "scaling", preferredQuestionId: "scaling" },
  { key: "failure_handling", preferredQuestionId: "failure" },
  { key: "security", preferredQuestionId: "security" },
  { key: "tradeoffs_decision", preferredQuestionId: "tradeoffs" },
  { key: "final_pressure", preferredQuestionId: "final_pressure" },
] as const;

type InterviewMessageLike = {
  role: string;
  content: string;
};

export type MockInterviewStage = "opening" | "topic_flow" | "final_pressure";

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
  "arastir",
  "gec",
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

function countAssistantTurns(messages: InterviewMessageLike[]): number {
  return messages.filter((message) => message.role === "assistant" && message.content.trim()).length;
}

function countCandidateAnswers(messages: InterviewMessageLike[]): number {
  let hasSeenAssistant = false;
  let count = 0;

  for (const message of messages) {
    if (message.role === "assistant" && message.content.trim()) {
      hasSeenAssistant = true;
      continue;
    }
    if (!hasSeenAssistant) continue;
    if (message.role !== "user") continue;
    if (!message.content.trim()) continue;
    if (isInterviewContractLine(message.content)) continue;
    count += 1;
  }

  return count;
}

function extractTopicIndexFromQuestionId(questionId: string | undefined): number | null {
  if (!questionId) return null;
  const normalized = questionId.trim().toLowerCase();
  if (!normalized) return null;

  if (normalized.includes("final_pressure") || normalized === "final" || normalized.startsWith("final_")) {
    return 7;
  }
  if (normalized.includes("tradeoff") || normalized.includes("tradeoffs") || normalized.includes("decision")) {
    return 6;
  }
  if (normalized.includes("security")) {
    return 5;
  }
  if (
    normalized.includes("failure") ||
    normalized.includes("resilien") ||
    normalized.includes("incident") ||
    normalized.includes("rollback")
  ) {
    return 4;
  }
  if (normalized.includes("scaling") || normalized.includes("scale")) {
    return 3;
  }
  if (normalized.includes("consistency") || normalized.includes("correctness")) {
    return 2;
  }
  if (normalized.includes("core_logic") || normalized.startsWith("core")) {
    return 1;
  }
  if (normalized.includes("architecture") || normalized.includes("design")) {
    return 0;
  }
  return null;
}

function getTopicByIndex(index: number) {
  return MOCK_INTERVIEW_TOPICS[Math.max(0, Math.min(MOCK_INTERVIEW_TOPICS.length - 1, index))];
}

function deriveTopicPlan(args: {
  messages: InterviewMessageLike[];
  clientPrev?: { questionId: string; attemptCount: number };
}): {
  stage: MockInterviewStage;
  assistantTurns: number;
  candidateAnswers: number;
  targetTopic: (typeof MOCK_INTERVIEW_TOPICS)[number];
  nextTopic: (typeof MOCK_INTERVIEW_TOPICS)[number] | null;
  turnInTopic: 1 | 2;
} {
  const { messages, clientPrev } = args;
  const assistantTurns = countAssistantTurns(messages);
  const candidateAnswers = countCandidateAnswers(messages);

  if (assistantTurns === 0) {
    return {
      stage: "opening",
      assistantTurns,
      candidateAnswers,
      targetTopic: MOCK_INTERVIEW_TOPICS[0],
      nextTopic: MOCK_INTERVIEW_TOPICS[1],
      turnInTopic: 1,
    };
  }

  const fallbackIndex = Math.min(
    Math.floor(assistantTurns / 2),
    MOCK_INTERVIEW_TOPICS.length - 1
  );
  const currentTopicIndex = extractTopicIndexFromQuestionId(clientPrev?.questionId) ?? fallbackIndex;
  const targetIndex =
    clientPrev && clientPrev.attemptCount >= 2
      ? Math.min(currentTopicIndex + 1, MOCK_INTERVIEW_TOPICS.length - 1)
      : currentTopicIndex;
  const targetTopic = getTopicByIndex(targetIndex);
  const nextTopic =
    targetIndex >= MOCK_INTERVIEW_TOPICS.length - 1 ? null : getTopicByIndex(targetIndex + 1);
  const turnInTopic = clientPrev && clientPrev.attemptCount >= 2 ? 1 : assistantTurns % 2 === 0 ? 1 : 2;
  const stage: MockInterviewStage = targetTopic.key === "final_pressure" ? "final_pressure" : "topic_flow";

  return {
    stage,
    assistantTurns,
    candidateAnswers,
    targetTopic,
    nextTopic,
    turnInTopic,
  };
}

export function deriveMockInterviewStage(messages: InterviewMessageLike[]): {
  stage: MockInterviewStage;
  assistantTurns: number;
  candidateAnswers: number;
} {
  const plan = deriveTopicPlan({ messages });
  return {
    stage: plan.stage,
    assistantTurns: plan.assistantTurns,
    candidateAnswers: plan.candidateAnswers,
  };
}

export function buildMockInterviewProgressHint(args: {
  locale: InterviewLocale;
  messages: InterviewMessageLike[];
  clientPrev?: { questionId: string; attemptCount: number };
}): string {
  const { locale, messages, clientPrev } = args;
  const progress = deriveTopicPlan({ messages, clientPrev });
  const counts =
    locale === "tr"
      ? `assistant_turns=${progress.assistantTurns}, candidate_answers=${progress.candidateAnswers}, target_topic=${progress.targetTopic.key}, preferred_question_id=${progress.targetTopic.preferredQuestionId}, topic_turn=${progress.turnInTopic}/2${progress.nextTopic ? `, next_topic=${progress.nextTopic.key}` : ""}.`
      : `assistant_turns=${progress.assistantTurns}, candidate_answers=${progress.candidateAnswers}, target_topic=${progress.targetTopic.key}, preferred_question_id=${progress.targetTopic.preferredQuestionId}, topic_turn=${progress.turnInTopic}/2${progress.nextTopic ? `, next_topic=${progress.nextTopic.key}` : ""}.`;

  if (progress.stage === "opening") {
    return locale === "tr"
      ? `\nMULAKAT ASAMASI (sunucu): opening. ${counts} Ilk teknik soruyu dogrudan sor. Selam, intro veya scenario filler kullanma. Architecture'a saplanmak zorunda degilsin; curated topic pack'ten role-native, kolay/fundamental ama teknik bir lane sec. Soru 1 cumle tercihli, tek konsepte odakli ve role-specific olsun.`
      : `\nINTERVIEW STAGE (server): opening. ${counts} Ask the first technical question directly. Do not use greeting, intro, or scenario filler. You do not have to force architecture first; choose a role-native lane from the curated topic pack that is foundational but still technical. Prefer 1 sentence, one concept, and sharp role specificity.`;
  }

  if (progress.stage === "topic_flow") {
    const phaseGuidance =
      progress.assistantTurns <= 3
        ? locale === "tr"
          ? " Erken fazdasin: onceki sorudan farkli bir role-core domain sec, ayni dar alt konuya saplanma, easy->medium zorluk akisini koru."
          : " You are still in the early phase: use a different role-core domain than the prior question, avoid narrow tunneling, and keep the difficulty moving from easy toward medium."
        : locale === "tr"
          ? " Orta/gec fazdasin: implementasyon, debugging, performance, failure veya trade-off derinligini artir; wording'i uzatma."
          : " You are in the middle/later phase: raise the depth on implementation, debugging, performance, failure, or trade-offs without making the wording longer.";

    return locale === "tr"
      ? `\nMULAKAT ASAMASI (sunucu): topic_flow. ${counts} Gerekmiyorsa scenario referansi verme; dogrudan role-native teknik soruyla sinyal topla. Simdi ${progress.targetTopic.key} topiginden sinyal topla. Her topic icin en fazla 2 interviewer turn kullan; bu turden sonra ${progress.nextTopic?.key ?? "final_pressure"} topigine gec. Gerekirse yalnizca bir net, kisa follow-up sor; yeterli sinyal varsa follow-up'i atla ve ilerle.${phaseGuidance}`
      : `\nINTERVIEW STAGE (server): topic_flow. ${counts} Unless it sharpens the question, skip scenario references and ask the role-native technical question directly. Collect signal on ${progress.targetTopic.key} now. Use at most 2 interviewer turns per topic; after this slot, move to ${progress.nextTopic?.key ?? "final_pressure"}. Ask only one short follow-up if a key detail is missing; if the answer already has enough signal, skip the follow-up and advance.${phaseGuidance}`;
  }

  return locale === "tr"
    ? `\nMULAKAT ASAMASI (sunucu): final_pressure. ${counts} AYNI scenarioda TEK kisa final pressure question sor. Soru karar vermeye zorlasin, onceliklendirme istesin ve hafif rahatsiz edici olsun. Multi-part sorma; bunun ardindan dogal kapanisa hazir ol.`
    : `\nINTERVIEW STAGE (server): final_pressure. ${counts} Stay in the SAME scenario and ask ONE short final pressure question. Make it decision-based, force prioritization, and keep it slightly uncomfortable. No multi-part wording; be ready to close right after.`;
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
  const currentTopicIndex = extractTopicIndexFromQuestionId(clientPrev?.questionId);
  const currentTopic = currentTopicIndex === null ? null : getTopicByIndex(currentTopicIndex);
  const nextTopic =
    currentTopicIndex === null || currentTopicIndex >= MOCK_INTERVIEW_TOPICS.length - 1
      ? getTopicByIndex(MOCK_INTERVIEW_TOPICS.length - 1)
      : getTopicByIndex(currentTopicIndex + 1);

  if (stimulus === "timeout") {
    return locale === "tr"
      ? "\nAKIS SINYALI (sunucu): Aday tekrar edilen soruya da hic yanit vermedi. Bu soru unanswered/no_response sayilir. Yorum yapma; yeni question_id ile attempt=1 ve yeni ana soruya gec. Onceki soruyu tekrar etme."
      : "\nFLOW SIGNAL (server): The candidate still gave no response after the one allowed repeat. Count that question as unanswered/no_response. Do not comment on the miss; advance with a NEW question_id, attempt=1, and a new main question.";
  }

  if (stimulus === "timeout_warning") {
    return locale === "tr"
      ? "\nAKIS SINYALI (sunucu): Gecikme uyarisi - hala ayni konu. Ayni question_id ve mevcut attempt degerini koru; tek cumle kontrol + soruyu kisaca yeniden ifade et; JSON'da is_followup=false ve attempt'i degistirme."
      : "\nFLOW SIGNAL (server): Delay warning - same topic. Keep the SAME question_id and the SAME attempt as your last control; one brief check-in + restate the question; in JSON use is_followup=false and do not change attempt.";
  }

  if (stimulus === "silence_escalate") {
    return locale === "tr"
      ? "\nAKIS SINYALI (sunucu): Art arda sessizlik - ayni soruyu aynen tekrarlama. Yeni question_id, attempt=1, is_followup=false ile ilerle."
      : "\nFLOW SIGNAL (server): Repeated silence - do NOT repeat the same question verbatim. Advance with a new question_id, attempt=1, is_followup=false.";
  }

  if (stimulus === "silence") {
    return locale === "tr"
      ? "\nAKIS SINYALI (sunucu): Sessizlik/algilanamadi - kisa, dogal tekrar iste; ayni question_id uzerinde tek netlestirme turu (attempt=2, is_followup=true) yalnizca onceki attempt=1 ise; aksi halde ilerle."
      : "\nFLOW SIGNAL (server): Silence / not recognized - short natural repeat request; same question_id with ONE clarify turn (attempt=2, is_followup=true) ONLY if the prior attempt was 1; otherwise advance with a new question_id, attempt=1.";
  }

  if (isInterviewContractLine(lastUserMessage)) {
    return "";
  }

  if (clientPrev && clientPrev.attemptCount >= 2) {
    return locale === "tr"
      ? `\nAKIS SINYALI (sunucu): Bu topic icin izin verilen follow-up kullanildi. Ayni question_id'yi tekrar kullanma ve AYNI topicte kalma. Yeni question_id ile ${nextTopic.key} topigine gec; tercih edilen question_id ${nextTopic.preferredQuestionId}, attempt=1, is_followup=false. __deep turetme, ucuncu katman acma.`
      : `\nFLOW SIGNAL (server): This topic has already used its one allowed follow-up. Do NOT reuse the same question_id and do NOT stay on the same topic. Move to the NEXT topic ${nextTopic.key} with a new question_id; prefer ${nextTopic.preferredQuestionId}, attempt=1, is_followup=false. No __deep ids and no third layer.`;
  }

  const sig = assessAnswerSignal(lastUserMessage, locale);

  if (sig === "empty") {
    return locale === "tr"
      ? `\nAKIS SINYALI (sunucu): Adayin son mesaji bos sayilir. attempt=${attempt}, question_id=${q}${currentTopic ? `, current_topic=${currentTopic.key}` : ""}. Gorunur yanit en fazla 1-2 kisa cumle olsun. Ogretme, dogru cevabi anlatma, uzun aciklama yapma. attempt=1 ise: daha derine inme; ayni question_id uzerinde TEK netlestirme sorusu sor, attempt=2, is_followup=true. Bir somut strateji, bir kural ya da bir gercek ornek iste. attempt=2 ise: kisa bir kabul satiri ile ${nextTopic.key} topigine yeni question_id ile ilerle.`
      : `\nFLOW SIGNAL (server): The last candidate message is effectively empty. attempt=${attempt}, question_id=${q}${currentTopic ? `, current_topic=${currentTopic.key}` : ""}. The visible reply must stay within 1-2 short sentences. Do not teach, explain the correct answer, or produce a long explanation. If attempt=1: do not go deeper yet; use the ONE clarify turn on the SAME question_id, attempt=2, is_followup=true. Ask for one concrete strategy, one rule, or one real example. If attempt=2: use a brief acknowledgment and advance to ${nextTopic.key} with a new question_id.`;
  }

  if (sig === "very_short" || sig === "low_signal") {
    return locale === "tr"
      ? `\nAKIS SINYALI (sunucu): Son yanit cok kisa veya dusuk sinyal. attempt=${attempt}, question_id=${q}${currentTopic ? `, current_topic=${currentTopic.key}` : ""}. Gorunur yanit en fazla 1-2 kisa cumle olsun; paragraf yazma. Ogretme, teori anlatma, mini ders verme. attempt=1 ise: daha derine inme. Ayni question_id uzerinde tek, kisa bir netlestirme sorusu sor; attempt=2, is_followup=true. Adaydan bir kural, bir strateji veya bir gercek ornek iste. Aday acikca "bilmiyorum" diyorsa genelde kisaca kabul edip ilerle; nadiren hizli bir tahmin iste. attempt=2 ise: bu topigi kisa bir kapanisla kapat ve ${nextTopic.key} topigine gec.`
      : `\nFLOW SIGNAL (server): The last answer is very short or low-signal. attempt=${attempt}, question_id=${q}${currentTopic ? `, current_topic=${currentTopic.key}` : ""}. The visible reply must stay within 1-2 short sentences; never a paragraph. Do not teach, explain theory, or give the full correct answer. If attempt=1: do not go deeper yet. Ask one short clarify turn on the SAME question_id; attempt=2, is_followup=true. Force one rule, one strategy, or one real example. If the candidate explicitly says "I don't know", usually acknowledge it briefly and move on; only rarely ask for a quick guess. If attempt=2: close this topic with a short acknowledgment and move to ${nextTopic.key}.`;
  }

  if (clientPrev && clientPrev.attemptCount === 1) {
    return locale === "tr"
      ? `\nAKIS SINYALI (sunucu): Aday anlamli bir ilk yanit verdi. Once icten weak | medium | strong diye degerlendir. weak ise ayni question_id uzerinde TEK netlestirme sorusu sor; attempt=2, is_followup=true. Bu durumda gorunur yanit yine en fazla 1-2 kisa cumle olsun; ogretici aciklama verme. medium ise yalnizca kritik bir mekanizma ya da karar boslugu varsa tek follow-up kullan. strong ise follow-up'a mecbur degilsin; ${nextTopic.key} topigine yeni question_id ile gec. Yanit acikca yanlissa bunu kisaca belirt, dogru cevabi anlatma. Takip sorusu soracaksan clarification, constraint, decision veya trade-off stillerinden birini sec; ayni template'i tekrar etme.`
      : `\nFLOW SIGNAL (server): The candidate gave a meaningful first answer. First rate it internally as weak | medium | strong. If it is weak, use the ONE clarify turn on the SAME question_id; attempt=2, is_followup=true. In that case the visible reply must still stay within 1-2 short sentences and must not become a teaching block. If it is medium, use that follow-up only when one critical mechanism or decision is still missing. If it is already strong and specific, skip the follow-up and move to ${nextTopic.key} with a new question_id. If the answer is clearly wrong, signal that briefly and do not explain the full answer. When you do ask a follow-up, vary the style: clarification, constraint, decision, or trade-off.`;
  }

  return "";
}
