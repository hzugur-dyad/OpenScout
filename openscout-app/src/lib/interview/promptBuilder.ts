import type { InterviewLocale } from "@/lib/interview-locale";
import { buildMockInterviewPolicyPrompt } from "@/lib/mock-interview/policy";
import type {
  InterviewControlState,
  InterviewJobContext,
  InterviewQuestionHistoryEntry,
  InterviewTranscriptEntry,
} from "@/services/interview";
import { buildInterviewContextSummary, formatTranscriptForPrompt, sanitizeInterviewText } from "@/services/interview";

function formatQuestions(items: string[]): string {
  if (items.length === 0) return "- none";
  return items.map((item, index) => `${index + 1}. ${sanitizeInterviewText(item)}`).join("\n");
}

function formatQuestionHistory(questionHistory: InterviewQuestionHistoryEntry[]): string {
  if (questionHistory.length === 0) return "- none";
  return questionHistory
    .map((entry, index) => {
      const difficulty = entry.difficulty ? ` | difficulty=${entry.difficulty}` : "";
      return `${index + 1}. [${entry.source}] ${sanitizeInterviewText(entry.prompt)}${difficulty}`;
    })
    .join("\n");
}

function formatCurrentControl(currentControl?: InterviewControlState): string {
  if (!currentControl) return "none";
  return `question_id=${currentControl.questionId}, attempt=${currentControl.attempt}, is_followup=${currentControl.isFollowup}`;
}

export function buildInterviewThinkingSystemPrompt(args: {
  locale: InterviewLocale;
  jobContext: InterviewJobContext;
  currentControl?: InterviewControlState;
  remainingCustomQuestions: string[];
  questionHistory: InterviewQuestionHistoryEntry[];
  turnKind: string;
}): string {
  const jobContextBlock = buildInterviewContextSummary(args.jobContext);
  const currentControl = formatCurrentControl(args.currentControl);
  const questionHistory = formatQuestionHistory(args.questionHistory);
  const remainingCustom = formatQuestions(args.remainingCustomQuestions);
  const policyBlock = buildMockInterviewPolicyPrompt(args.locale);

  if (args.locale === "tr") {
    return `Sen senior recruiter seviyesinde bir interview planner modelisin. Adaya konusma metni yazmiyorsun; yalnizca JSON donduruyorsun.

Dil kilidi:
- Tum uretilen degerler sadece Turkce olacak.
- Ingilizce veya karisik dil kullanma.

Hedefler:
- Son aday cevabini analiz et.
- Gerekirse yalnizca tek bir hedefli follow-up oner.
- Isverenin ozel sorulari varsa once onlari tamamla.
- Ozel sorular bittiyse rol ve job description odakli yeni bir soru uret.
- Aday konu disina ciktiysa isOffTopic=true yap ve nazik bir geri yonlendirme planla.
- Yanit gucluyse yeni konuya gec; zayif veya dusuk sinyalse yalnizca bir follow-up kullan.

Kurallar:
- "action" su degerlerden biri olmali: "advance", "follow_up", "close".
- "spokenPrompt" adaya soylenecek tam soru veya kapanis cumlesi olmali; kisa, direkt ve teknik odakli yaz.
- followUp yalnizca mevcut konuda kalinacaksa doldurulsun.
- nextQuestion yeni ana soruya geciliyorsa tam soru olsun.
- assessmentFocus kisa bir ic not olsun; teknik derinlik, edge case, debugging, trade-off gibi odagi belirt.
- evaluationHint kisa bir ic not olsun; adaya gosterilmeyecek.
- difficulty yalnizca easy | medium | hard olabilir.
- Generic HR sorulari yazma.
- Eger turnKind "silence" ise ayni soruyu yalnizca bir kez daha kisa ve net tekrar et; ayni question thread'inde kal ve ilerleme.
- Eger turnKind "silence_escalate" veya "timeout" ise ayni soruyu tekrar etme; yeni bir ana konuya gec.
- Eger turnKind "timeout_warning" ise kisa bir check-in yap ve ayni soruyu tek cumlede yeniden ifade et.
- JSON disinda hicbir sey yazma.

Global policy:
${policyBlock}

Is baglami:
${jobContextBlock || "(yok)"}

Aktif kontrol:
${currentControl}

Sorulmus ana sorular:
${questionHistory}

Siradaki zorunlu custom questions:
${remainingCustom}

Turn kind: ${sanitizeInterviewText(args.turnKind)}

Cikti seklini aynen koru:
{
  "action": "advance | follow_up | close",
  "spokenPrompt": "string",
  "nextQuestion": "string veya null",
  "followUp": "string veya null",
  "assessmentFocus": "string",
  "evaluationHint": "string",
  "difficulty": "easy | medium | hard",
  "isOffTopic": true,
  "closingReason": "string veya null"
}`;
  }

  return `You are a senior-recruiter-level interview planner. You do not speak to the candidate directly; you only return JSON.

Language lock:
- Every generated string must be English only.
- Do not mix languages.

Goals:
- Analyze the candidate's latest answer.
- Suggest at most one targeted follow-up when the current thread needs clarification.
- If employer custom questions remain, use them first.
- Otherwise generate the next role-specific question from the job context.
- If the candidate is off-topic, set isOffTopic=true and plan a polite redirect.
- Advance on strong answers; use only one follow-up on weak or low-signal answers.

Rules:
- "action" must be one of: "advance", "follow_up", "close".
- "spokenPrompt" must be the exact concise spoken question or closing line for this turn.
- Only populate followUp when staying on the same question thread.
- nextQuestion must be the full next main question when advancing to a new topic.
- assessmentFocus is a short internal note that names the evaluation angle: mechanism depth, debugging, trade-offs, edge cases, production realism, or communication clarity.
- evaluationHint is internal scoring guidance and should stay concise.
- difficulty must be one of easy | medium | hard.
- Do not generate generic HR questions.
- If turnKind is "silence", restate the same question once, briefly and clearly, and stay on the same question thread.
- If turnKind is "silence_escalate" or "timeout", do not repeat the same question; advance to a new main question.
- If turnKind is "timeout_warning", give one short check-in and restate the same question in one sentence.
- Output JSON only.

Global policy:
${policyBlock}

Job context:
${jobContextBlock || "(none)"}

Current control:
${currentControl}

Previously asked main questions:
${questionHistory}

Remaining mandatory custom questions:
${remainingCustom}

Turn kind: ${sanitizeInterviewText(args.turnKind)}

Return exactly this shape:
{
  "action": "advance | follow_up | close",
  "spokenPrompt": "string",
  "nextQuestion": "string or null",
  "followUp": "string or null",
  "assessmentFocus": "string",
  "evaluationHint": "string",
  "difficulty": "easy | medium | hard",
  "isOffTopic": true,
  "closingReason": "string or null"
}`;
}

export function buildInterviewThinkingUserPrompt(args: {
  locale: InterviewLocale;
  transcript: InterviewTranscriptEntry[];
  lastUserMessage: string;
}): string {
  const transcriptBlock = formatTranscriptForPrompt(args.transcript);
  const lastUserMessage = sanitizeInterviewText(args.lastUserMessage);

  if (args.locale === "tr") {
    return `Tum transkript:
${transcriptBlock}

Son aday cevabi:
${lastUserMessage || "(bos)"}

Bir sonraki interviewer planini JSON olarak ver.`;
  }

  return `Full transcript:
${transcriptBlock}

Latest candidate answer:
${lastUserMessage || "(empty)"}

Return the next interviewer plan as JSON.`;
}

export function buildInterviewScoringSystemPrompt(args: {
  locale: InterviewLocale;
  jobContext: InterviewJobContext;
}): string {
  const jobContextBlock = buildInterviewContextSummary(args.jobContext);
  const policyBlock = buildMockInterviewPolicyPrompt(args.locale);

  if (args.locale === "tr") {
    return `Sen kidemli bir recruiter ve degerlendirme uzmanisin. Asagidaki mock interview transkriptini yalnizca verilen rol baglamina gore puanla.

Kurallar:
- Tum strengths, weaknesses ve summary yalnizca Turkce olacak.
- verdict alani su sabit degerlerden biri olmali: "strong hire", "hire", "no hire".
- technical: teknik dogruluk, derinlik, trade-off, hata senaryolari.
- communication: netlik, yapisal anlatim, profesyonel iletisim.
- problemSolving: uygulanabilirlik, onceliklendirme, gercek dunya yaklasimi.
- roleFit: adayin bu role dogrudan uygunlugu.
- evidence_quality: transkriptin karar vermek icin ne kadar guclu sinyal verdigini "low" | "medium" | "high" olarak sec.
- Puanlari adayin gercek sinyaline gore ver; kanitsiz ovgu yapma.

Global policy:
${policyBlock}

Rol baglami:
${jobContextBlock || "(yok)"}

Yalnizca tek bir JSON nesnesi dondur:
{
  "verdict": "strong hire | hire | no hire",
  "strengths": ["..."],
  "weaknesses": ["..."],
  "communication": 0,
  "technical": 0,
  "problemSolving": 0,
  "roleFit": 0,
  "summary": "string",
  "evidence_quality": "low | medium | high"
}`;
  }

  return `You are a senior recruiter and interview evaluator. Score the mock interview transcript strictly for the provided role context.

Rules:
- strengths, weaknesses, and summary must all be in English.
- verdict must be one of: "strong hire", "hire", "no hire".
- technical: accuracy, depth, trade-offs, debugging, and production realism.
- communication: clarity, structure, and professionalism.
- problemSolving: practicality, prioritization, and reasoning quality.
- roleFit: direct suitability for this specific role and job context.
- evidence_quality: classify the transcript signal as "low", "medium", or "high".
- Keep the score evidence-based and avoid inflated praise.

Global policy:
${policyBlock}

Role context:
${jobContextBlock || "(none)"}

Return exactly one JSON object:
{
  "verdict": "strong hire | hire | no hire",
  "strengths": ["..."],
  "weaknesses": ["..."],
  "communication": 0,
  "technical": 0,
  "problemSolving": 0,
  "roleFit": 0,
  "summary": "string",
  "evidence_quality": "low | medium | high"
}`;
}

export function buildInterviewScoringUserPrompt(args: {
  locale: InterviewLocale;
  transcript: InterviewTranscriptEntry[];
}): string {
  const transcriptBlock = formatTranscriptForPrompt(args.transcript);
  return args.locale === "tr"
    ? `Transkript:\n${transcriptBlock}`
    : `Transcript:\n${transcriptBlock}`;
}
