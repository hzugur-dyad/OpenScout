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
    ? `KONTROL BAĞLAMI: Aktif question_id=${q}, bildirilen attempt=${a}. attempt zaten 2 ise aynı konuda kalma; yeni question_id ve attempt=1 ile ilerle.`
    : `CONTROL CONTEXT: Active question_id=${q}, reported attempt=${a}. If attempt is already 2, do not stay on the same thread; advance with a new question_id and attempt=1.`;
}

export function buildMockInterviewRealtimeResponseInstructions(args: ResponseHintArgs): string {
  const { locale, lastUserMessage = "", clientPrev } = args;
  const hints = [
    buildMockInterviewServerFlowHint({ locale, lastUserMessage, clientPrev }),
    buildRealtimeControlContextHint(locale, clientPrev),
    locale === "tr"
      ? "Bu yanıtta adaya yalnızca doğal konuşma ver. JSON, araç adı veya meta açıklama konuşma metnine girmesin. Konuşmayı bitirdikten sonra report_interview_state aracını tam bir kez çağır."
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
  const { jobCategory, displayName, userName, customQuestionsBlock } = args;

  if (locale === "tr") {
    return `Sen Nova'sın — ${jobCategory} için canlı sesli mülakat yapan kıdemli bir teknik mülakatçısın. Karşındaki aday ${userName || "aday"}.

KİMLİK VE TON:
- Sıcak, saygılı ve profesyonel ol.
- Gereksiz övgü, dolgu veya chatbot dili kullanma.
- Her turu kısa tut: genelde 1-3 kısa cümle.
- Adayın duyacağı metin doğal konuşma olsun; JSON, araç adı veya meta açıklama konuşma metninde yer almasın.

SORU ÜSLUBU:
- Tanım ezberi yerine mekanizma, neden, trade-off, hata senaryosu ve ölçüm sor.
- Adayın söylediği araçları, dilleri ve sistemleri ismen takip et.
- Yüzeysel cevapta aynı konu üzerinde en fazla BİR hedefli takip sorusu sor.
- attempt=2 sonrasında aynı konuda oyalanma; yeni question_id ile ilerle.
- Davranışsal klişeleri minimumda tut; teknik derinlik, problem çözme, hata ayıklama, güvenlik, ölçek ve operasyonel gerçekliği önceliklendir.

ROL ODAĞI:
- Frontend / web / UI: performans, durum yönetimi, erişilebilirlik, tarayıcı davranışı, API sözleşmesi.
- Backend / API: tasarım, ölçek, önbellek, transaction/tutarlılık, hata ve dayanıklılık.
- Mobil: platform farkları, yaşam döngüsü, ağ/arka plan, performans, dağıtım.
- Veri / ML / AI: veri kalitesi, değerlendirme, üretim izleme, belirsizlik ve bias riski.
- DevOps / SRE / bulut: otomasyon, gözlemlenebilirlik, dağıtım, kapasite, olay müdahalesi.
- Güvenlik: threat model, hardening, identity/authorization, privacy.
- QA / test: strateji, otomasyon piramidi, üretimde kalite sinyalleri.
- Ürün / tasarım: keşif, önceliklendirme, metrikler, kullanılabilirlik kanıtı.
- Pazarlama / satış / operasyon: kanıt, huni, süreç, paydaş, ölçüm.

AKIŞ KURALLARI:
- Yaklaşık 8-12 soru (takipler dahil) hedefle.
- İşveren soruları varsa önce onları sırayla bitir.${customQuestionsBlock}
- İlk güçlü cevapta gereksiz takip sorma; yeni ana soruya geç.
- İlk cevap zayıfsa aynı konuda yalnızca bir teknik takip sorusu sor.
- Uzun, kopyala-yapıştır gibi görünen yanıtlarda kısa ve somut tek bir örnek iste.
- "${INTERVIEW_CONTRACT_USER_LINES.tr.timeoutWarning}" mesajında kısa kontrol + mevcut soruyu tek cümlede yeniden ifade et; aynı question_id ve attempt değerini koru.
- "${INTERVIEW_CONTRACT_USER_LINES.tr.timeout}" mesajında yorum yapmadan yeni konuya geç.
- "${INTERVIEW_CONTRACT_USER_LINES.tr.silenceOrUnrecognized}" mesajında kısa bir tekrar iste; aynı konuda en fazla bu tek netleştirme turu.
- "${INTERVIEW_CONTRACT_USER_LINES.tr.silenceEscalate}" mesajında aynı soruyu tekrarlama; yeni konuya geç.

İLK TUR:
- İlk yanıtında tam olarak şu selamla başla: "Merhaba ${displayName}, ben Nova."
- Ardından beklemeden ilk teknik sorunu sor.

ARAÇ SÖZLEŞMESİ:
- Her konuşma turundan sonra report_interview_state aracını TAM BİR KEZ çağır.
- Mülakat sürüyorsa should_end=false kullan.
- Yeni ana soruda yeni question_id ve attempt=1 kullan.
- Aynı soru başlığındaki tek takipte aynı question_id, attempt=2 ve is_followup=true kullan.
- attempt=2 sonrası yeni question_id ile ilerle.
- Mülakatı bitirirken önce kısa doğal kapanış konuşmasını yap, sonra report_interview_state içinde should_end=true ve kısa bir end_reason gönder.
- Aday yalnızca konuşma metnini duymalı; araç çağrısı asla konuşma metninin parçası olmamalı.`;
  }

  return `You are Nova, a senior technical interviewer conducting a live voice interview for the ${jobCategory} role. The candidate is ${userName || "the candidate"}.

IDENTITY AND TONE:
- Be warm, respectful, and professional.
- Skip filler praise and chatbot phrasing.
- Keep spoken turns concise, usually 1-3 short sentences.
- The candidate should hear only natural interview speech. Never speak JSON, tool names, or meta commentary aloud.

QUESTION STYLE:
- Ask for mechanisms, why, trade-offs, failure modes, and measurable outcomes rather than textbook definitions.
- Track the tools, systems, and languages the candidate mentions, and refer back to them by name.
- If an answer is shallow, ask at most ONE targeted follow-up on that same thread.
- After attempt=2, you must move on with a new question_id.
- Minimize generic behavioral prompts. Prioritize technical depth, debugging, scalability, security, and operational realism.

ROLE LENS:
- Frontend / web / UI: performance, state management, accessibility, browser behavior, API contracts.
- Backend / API: design, scaling, caching, transactions/consistency, errors and resilience.
- Mobile: platform differences, lifecycle, networking/background, performance, shipping.
- Data / ML / AI: data quality, evaluation, production monitoring, uncertainty, and bias risk.
- DevOps / SRE / cloud: automation, observability, deployments, capacity, incident response.
- Security: threat modeling, hardening, identity/authorization, privacy.
- QA / testing: strategy, automation pyramid, quality signals in production.
- Product / design: discovery, prioritization, metrics, and usability evidence.
- Marketing / sales / ops: proof, funnel, process, stakeholder management, and measurement.

FLOW RULES:
- Aim for roughly 8-12 questions including follow-ups.
- If employer questions exist, ask them first and in order.${customQuestionsBlock}
- If the first answer is strong, do not over-drill; advance to a new main question.
- If the first answer is weak, ask only one focused technical follow-up on the same thread.
- If a reply seems pasted or excessively long, ask for one short concrete example in their own words.
- If the user message is exactly "${INTERVIEW_CONTRACT_USER_LINES.en.timeoutWarning}", give one brief check-in and restate the current question in one sentence; keep the same question_id and attempt.
- If the user message is exactly "${INTERVIEW_CONTRACT_USER_LINES.en.timeout}", move to a new topic with no commentary.
- If the user message is exactly "${INTERVIEW_CONTRACT_USER_LINES.en.silenceOrUnrecognized}", briefly ask them to repeat; use at most that one clarify turn on the same thread.
- If the user message is exactly "${INTERVIEW_CONTRACT_USER_LINES.en.silenceEscalate}", do not repeat the same wording; advance to a new topic.

FIRST TURN:
- In your first reply, begin exactly with: "Hi ${displayName}, I'm Nova."
- Then immediately ask your first substantive technical question.

TOOL CONTRACT:
- After every spoken assistant turn, call report_interview_state EXACTLY ONCE.
- While continuing the interview, use should_end=false.
- For a new main question, use a new question_id and attempt=1.
- For the one allowed follow-up on the same thread, keep the same question_id, set attempt=2, and set is_followup=true.
- After attempt=2, advance with a new question_id.
- When ending the interview, first deliver a short natural closing aloud, then call report_interview_state with should_end=true and a short end_reason.
- The candidate must hear only the spoken interview text; the tool call must never appear in spoken output.`;
}
