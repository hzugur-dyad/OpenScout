import type { InterviewLocale } from "@/lib/interview-locale";

export type InterviewEvidenceQuality = "low" | "medium" | "high";

export const MOCK_INTERVIEW_POLICY_VERSION = "2026-04-01-v1.1";

export const MOCK_INTERVIEW_TARGET_MAIN_QUESTIONS = 8;
export const MOCK_INTERVIEW_MAX_MAIN_QUESTIONS = 10;
export const MOCK_INTERVIEW_MAX_FOLLOWUPS_PER_THREAD = 1;

export const MOCK_INTERVIEW_SCORING_WEIGHTS = {
  technical: 0.45,
  problemSolving: 0.25,
  communication: 0.15,
  roleFit: 0.15,
} as const;

export const MOCK_INTERVIEW_BANNED_HR_TOPICS = [
  "biggest weakness",
  "biggest strength",
  "where do you see yourself in five years",
  "why should we hire you",
  "tell me about yourself",
] as const;

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function computeDeterministicInterviewOverallScore(args: {
  technical: number;
  problemSolving: number;
  communication: number;
  roleFit: number;
}): number {
  const weighted =
    args.technical * MOCK_INTERVIEW_SCORING_WEIGHTS.technical +
    args.problemSolving * MOCK_INTERVIEW_SCORING_WEIGHTS.problemSolving +
    args.communication * MOCK_INTERVIEW_SCORING_WEIGHTS.communication +
    args.roleFit * MOCK_INTERVIEW_SCORING_WEIGHTS.roleFit;

  return clampScore(weighted);
}

export function buildMockInterviewPolicyPrompt(locale: InterviewLocale): string {
  if (locale === "tr") {
    return [
      `GLOBAL POLICY v${MOCK_INTERVIEW_POLICY_VERSION}:`,
      "- Acilisi aday adiyla yap ve Nova olarak kendini tanit.",
      "- Varsayilan mod teknik agirlikli; soru seciminde teknik dogruluk, mekanizma, edge case, production trade-off ve hata ayiklama once gelir.",
      "- Her turda tek bir ana soru sor; soru kisa, net ve direkt olsun.",
      `- Ayni soru thread'i icin en fazla ${MOCK_INTERVIEW_MAX_FOLLOWUPS_PER_THREAD} hedefli follow-up kullan; sonra mutlaka yeni konuya gec.`,
      "- Isverenin custom sorulari varsa once ve eksiksiz sor.",
      `- Mulakati yaklasik ${MOCK_INTERVIEW_TARGET_MAIN_QUESTIONS} ana soruda bitirmeyi hedefle; en gec ${MOCK_INTERVIEW_MAX_MAIN_QUESTIONS} ana soruda kapat.`,
      "- Guclu cevapta hemen yeni konuya gec; dusuk sinyal cevapta tek hedefli teknik follow-up sor.",
      "- Generic HR sorulari default akista yasak: en buyuk zayifligin, en buyuk gucun, bes yil sonra kendini nerede goruyorsun, neden seni ise alalim, kendinden bahset.",
      "- Timeout ve silence akisini server sinyalleri belirler; bunlara kesinlikle uy.",
    ].join("\n");
  }

  return [
    `GLOBAL POLICY v${MOCK_INTERVIEW_POLICY_VERSION}:`,
    "- Open with the candidate's name and introduce yourself as Nova.",
    "- Default mode is technical-heavy: prioritize mechanism depth, edge cases, production trade-offs, debugging, and practical constraints.",
    "- Ask one main question at a time; keep it concise, direct, and role-relevant.",
    `- Allow at most ${MOCK_INTERVIEW_MAX_FOLLOWUPS_PER_THREAD} targeted follow-up per question thread, then you must advance.`,
    "- If employer custom questions exist, ask them first and in order without skipping.",
    `- Aim to finish around ${MOCK_INTERVIEW_TARGET_MAIN_QUESTIONS} main questions and hard-stop by ${MOCK_INTERVIEW_MAX_MAIN_QUESTIONS} main questions.`,
    "- Advance immediately after a strong answer; use one targeted technical follow-up after a weak or low-signal answer.",
    "- Generic HR questions are banned in the default flow: biggest weakness, biggest strength, where do you see yourself in five years, why should we hire you, tell me about yourself.",
    "- Timeout and silence handling are dictated by server flow signals and must override model preference.",
  ].join("\n");
}
