import type { InterviewLocale } from "@/lib/interview-locale";
import { buildMockInterviewServerFlowHint } from "@/lib/mock-interview/flow-hints";
import { INTERVIEW_CONTRACT_USER_LINES } from "@/lib/mock-interview/interview-contract-messages";
import { resolveMockInterviewLiveModel } from "@/lib/mock-interview/versioning";

type RealtimePromptArgs = {
  jobCategory: string;
  displayName: string;
  userName: string;
  customQuestionsBlock: string;
};

type ResponseHintArgs = {
  locale: InterviewLocale;
  lastUserMessage?: string;
  clientPrev?: { questionId: string; attemptCount: number };
};

export type RealtimeInterviewControl = {
  questionId: string;
  attempt: number;
  isFollowup: boolean;
  shouldEnd: boolean;
  endReason: string | null;
};

export const MOCK_INTERVIEW_REALTIME_OUTPUT_MODALITIES = ["audio"] as const;

function buildRealtimeControlContextHint(
  locale: InterviewLocale,
  interviewControl: { questionId: string; attemptCount: number } | undefined
): string {
  if (!interviewControl) return "";
  const q = interviewControl.questionId.trim();
  const a = Math.max(1, Math.min(2, Math.round(interviewControl.attemptCount)));
  return locale === "tr"
    ? `KONTROL BAGLAMI: Aktif question_id=${q}, bildirilen attempt=${a}. attempt zaten 2 ise ayni konuda kalma; yeni question_id ve attempt=1 ile ilerle.`
    : `CONTROL CONTEXT: Active question_id=${q}, reported attempt=${a}. If attempt is already 2, do not stay on the same thread; advance with a new question_id and attempt=1.`;
}

export function buildMockInterviewRealtimeResponseInstructions(args: ResponseHintArgs): string {
  const { locale, lastUserMessage = "", clientPrev } = args;
  const hints = [
    locale === "tr"
      ? "SUNUCU ORKESTRASYONU: response.create icindeki ek sunucu bloklari soru, dil ve kontrol durumu icin birincil otoritedir; bunlari birebir uygula."
      : "SERVER ORCHESTRATION: any extra server block included in response.create is the primary source of truth for question wording, language, and control state; follow it exactly.",
    buildMockInterviewServerFlowHint({ locale, lastUserMessage, clientPrev }),
    buildRealtimeControlContextHint(locale, clientPrev),
    locale === "tr"
      ? "Bu yanitta adaya yalnizca dogal konusma ver. JSON, arac adi veya meta aciklama konusma metnine girmesin. Konusmayi bitirdikten sonra report_interview_state aracini tam bir kez cagir."
      : "In this response, give the candidate only natural spoken interview speech. Do not speak JSON, tool names, or meta commentary. After finishing the spoken reply, call report_interview_state exactly once.",
  ]
    .map((part) => part.trim())
    .filter(Boolean);

  return hints.join("\n\n");
}

export function normalizeMockInterviewRealtimeControl(raw: unknown): RealtimeInterviewControl | null {
  const parsed =
    typeof raw === "string"
      ? (() => {
          try {
            return JSON.parse(raw) as unknown;
          } catch {
            return null;
          }
        })()
      : raw;

  if (!parsed || typeof parsed !== "object") return null;

  const value = parsed as Record<string, unknown>;
  const questionIdRaw = typeof value.question_id === "string" ? value.question_id.trim() : "";
  const attemptRaw = typeof value.attempt === "number" ? value.attempt : Number(value.attempt);
  const shouldEnd = Boolean(value.should_end);

  const questionId = questionIdRaw || (shouldEnd ? "closing" : "");
  if (!questionId) return null;

  const attempt = Number.isFinite(attemptRaw) ? Math.min(2, Math.max(1, Math.round(attemptRaw))) : 1;
  const isFollowup = Boolean(value.is_followup);
  const endReason =
    typeof value.end_reason === "string" && value.end_reason.trim().length > 0
      ? value.end_reason.trim().slice(0, 200)
      : null;

  return {
    questionId,
    attempt,
    isFollowup,
    shouldEnd,
    endReason,
  };
}

export function getMockInterviewRealtimeSessionConfig(args: RealtimePromptArgs & { locale: InterviewLocale }) {
  const model = resolveMockInterviewLiveModel(process.env.OPENAI_MOCK_INTERVIEW_LIVE_MODEL);
  const voice = process.env.OPENAI_REALTIME_ASSISTANT_VOICE?.trim() || "marin";
  const inputTranscriptionModel =
    process.env.OPENAI_REALTIME_INPUT_TRANSCRIPTION_MODEL?.trim() || "gpt-4o-mini-transcribe";

  return {
    type: "realtime",
    model,
    output_modalities: [...MOCK_INTERVIEW_REALTIME_OUTPUT_MODALITIES],
    instructions: buildMockInterviewRealtimeInstructions(args.locale, args),
    max_output_tokens: 900,
    tool_choice: "auto",
    audio: {
      input: {
        noise_reduction: { type: "near_field" },
        transcription: {
          model: inputTranscriptionModel,
          language: args.locale,
        },
        turn_detection: null,
      },
      output: {
        voice,
      },
    },
    tools: [
      {
        type: "function",
        name: "report_interview_state",
        description:
          "Report the structured interview control state after each spoken assistant turn so the app can enforce question flow and cleanly end the interview.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            question_id: {
              type: "string",
              description:
                "Stable identifier for the active question thread. Use a new value when you advance to a new main question.",
            },
            attempt: {
              type: "integer",
              description:
                "1 for a new/main question, 2 for the single allowed follow-up on the same question thread.",
              minimum: 1,
              maximum: 2,
            },
            is_followup: {
              type: "boolean",
              description: "True only when this spoken turn is the one allowed follow-up on the current thread.",
            },
            should_end: {
              type: "boolean",
              description: "True only when you are delivering the final closing and the interview should now end.",
            },
            end_reason: {
              type: "string",
              description: "Short internal reason for ending the interview. Use an empty string while continuing.",
            },
          },
          required: ["question_id", "attempt", "is_followup", "should_end", "end_reason"],
        },
      },
    ],
  };
}

export function buildMockInterviewRealtimeInstructions(
  locale: InterviewLocale,
  args: RealtimePromptArgs
): string {
  const { jobCategory, userName, customQuestionsBlock } = args;

  if (locale === "tr") {
    return `Sen Nova'sin. ${jobCategory} rolu icin canli sesli mulakat yapan kidemli bir interviewer gibi konusursun. Karsindaki aday ${userName || "aday"}.

ORKESTRASYON:
- Bu oturumda ana interviewer muhakemesi harici bir thinking service tarafindan yonlendirilebilir.
- response.create icindeki sunucu bloklari, bu turda ne soyleyecegin ve report_interview_state icin hangi degerleri kullanacagin konusunda birincil otoritedir.
- Sunucu tam bir soru veya spoken text verirse improvize etme; dogal ama sadik kal.

KURALLAR:
- Yalnizca Turkce konus. Asla dil karistirma.
- Tonun sicak, ciddi ve kisa olsun. Gereksiz ovgu, dolgu veya chatbot dili kullanma.
- Adayin duyacagi metin yalnizca dogal konusma olsun; JSON, arac adi veya meta aciklama soyleme.
- "${INTERVIEW_CONTRACT_USER_LINES.tr.timeoutWarning}" icin kisa kontrol + ayni konuyu tek cumlede yeniden ifade et.
- "${INTERVIEW_CONTRACT_USER_LINES.tr.timeout}" icin yorum yapmadan yeni konuya gec.
- "${INTERVIEW_CONTRACT_USER_LINES.tr.silenceOrUnrecognized}" icin kisa tekrar iste.
- "${INTERVIEW_CONTRACT_USER_LINES.tr.silenceEscalate}" icin ayni ifadeyi tekrar etmeden yeni konuya gec.
- Isveren sorulari varsa once onlar tamamlanir.${customQuestionsBlock}

ARAC SOZLESMESI:
- Her spoken assistant turn sonunda report_interview_state aracini tam bir kez cagir.
- Mulakat suruyorsa should_end=false kullan.
- Yeni ana soruda yeni question_id ve attempt=1 kullan.
- Tek follow-up icin ayni question_id, attempt=2 ve is_followup=true kullan.
- Mulakati bitirirken once kisa kapanis konusmasi yap, sonra should_end=true ve kisa bir end_reason gonder.

FAILSAFE:
- Sunucudan exact spoken text gelirse yalnizca onu seslendir.
- Sunucu spoken text vermezse bile kendi akisini kurma; yalnizca role uygun, kisa ve teknik bir soru sor.`;
  }

  return `You are Nova. You conduct a live voice interview for the ${jobCategory} role. The candidate is ${userName || "the candidate"}.

ORCHESTRATION:
- In this session, primary interviewer reasoning may be supplied by an external thinking service.
- Any server orchestration block included in response.create is the source of truth for what you should say in this turn and which report_interview_state values you must send.
- If the server gives you exact spoken wording or an exact question, do not improvise beyond natural delivery.

RULES:
- Speak only English. Never mix languages.
- Keep the tone warm, serious, concise, and recruiter-like.
- The candidate should hear only natural interview speech. Never speak JSON, tool names, or meta commentary aloud.
- For "${INTERVIEW_CONTRACT_USER_LINES.en.timeoutWarning}", give one brief check-in and restate the current question.
- For "${INTERVIEW_CONTRACT_USER_LINES.en.timeout}", move to a new topic with no commentary.
- For "${INTERVIEW_CONTRACT_USER_LINES.en.silenceOrUnrecognized}", briefly ask them to repeat.
- For "${INTERVIEW_CONTRACT_USER_LINES.en.silenceEscalate}", do not repeat the same wording; advance to a new topic.
- If employer questions exist, ask them first and in order.${customQuestionsBlock}

TOOL CONTRACT:
- After every spoken assistant turn, call report_interview_state exactly once.
- While continuing the interview, use should_end=false.
- For a new main question, use a new question_id and attempt=1.
- For the one allowed follow-up on the same thread, keep the same question_id, set attempt=2, and set is_followup=true.
- When ending the interview, first deliver a short natural closing aloud, then call report_interview_state with should_end=true and a short end_reason.

FAILSAFE:
- If the server provides exact spoken text, speak only that text.
- If the server does not provide spoken text, do not invent a full interview plan; ask only one concise technical question relevant to the role.`;
}
