import { NextRequest, NextResponse } from "next/server";
import { getGroq } from "@/lib/groq";
import { buildInterviewerSystemPrompt } from "@/lib/mock-interview-prompt";
import { buildBilingualTechnicalLanguagePrompt } from "@/lib/mock-interview/technical-language";
import { parseMockInterviewAssistantTurn } from "@/lib/ai/structured-output";
import { GROQ_MOCK_INTERVIEW_MODEL } from "@/lib/mock-interview/versioning";
import { parseInterviewLocale, type InterviewLocale } from "@/lib/interview-locale";
import { extractInterviewQuestionPrompt } from "@/lib/mock-interview/question-guard";
import { enforceRateLimit } from "@/lib/rate-limit";
import { logError } from "@/lib/logger";

class BadRequestError extends Error {}

// Supported roles for debugging
const SUPPORTED_ROLES = [
  "Mobile Developer",
  "Android Developer", 
  "Frontend Developer",
  "Backend Developer",
  "Mechanical Engineer",
  "Electrical Engineer",
  "Electrical & Electronics Engineer",
] as const;

type SupportedRole = typeof SUPPORTED_ROLES[number];

interface DebugQuestion {
  index: number;
  question: string;
  questionId?: string;
  attempt?: number;
  isFollowup?: boolean;
}

interface DebugResponse {
  role: string;
  lang?: string;
  level?: string;
  questions: DebugQuestion[];
}

function validateRole(role: string): SupportedRole {
  if (!SUPPORTED_ROLES.includes(role as SupportedRole)) {
    throw new BadRequestError(`Unsupported role: ${role}. Supported roles: ${SUPPORTED_ROLES.join(", ")}`);
  }
  return role as SupportedRole;
}

function validateCount(count: string | null): number {
  const parsed = count ? parseInt(count, 10) : 10;
  if (isNaN(parsed) || parsed < 1 || parsed > 20) {
    throw new BadRequestError("Count must be between 1 and 20");
  }
  return parsed;
}

function validateLang(lang: string | null): InterviewLocale {
  if (!lang) return "en";
  const parsed = parseInterviewLocale(lang);
  if (!parsed) {
    throw new BadRequestError("Invalid lang. Must be 'en' or 'tr'");
  }
  return parsed;
}

function validateLevel(level: string | null): "junior" | "mid" | "senior" {
  if (!level) return "mid";
  const normalized = level.trim().toLowerCase();
  if (normalized === "junior" || normalized === "mid" || normalized === "senior") {
    return normalized;
  }
  throw new BadRequestError("Invalid level. Must be 'junior', 'mid', or 'senior'");
}

function buildDebugJobCategory(role: string, level: "junior" | "mid" | "senior"): string {
  const prefix = level === "mid" ? "Mid" : level === "junior" ? "Junior" : "Senior";
  return /^\s*(junior|mid|senior|staff|principal|lead)\b/i.test(role) ? role : `${prefix} ${role}`;
}

export async function GET(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production" && process.env.OPENSCOUT_ENABLE_DEBUG_API !== "true") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const limited = await enforceRateLimit(request, null, {
      namespace: "debug-interview-questions",
      limit: 5,
      window: "1 h",
    });
    if (limited) return limited;

    const { searchParams } = new URL(request.url);
    
    // Validate query parameters
    const role = validateRole(searchParams.get("role") || "Frontend Developer");
    const count = validateCount(searchParams.get("count"));
    const lang = validateLang(searchParams.get("lang"));
    const level = validateLevel(searchParams.get("level"));
    const jobCategory = buildDebugJobCategory(role, level);

    // Initialize Groq client
    const groq = getGroq();
    
    // Build system prompts
    const systemPrompt = [
      buildInterviewerSystemPrompt(lang, {
        jobCategory,
        displayName: "Debug User",
        userName: "Debug User", 
        customQuestionsBlock: "",
      }),
      buildBilingualTechnicalLanguagePrompt(lang),
    ].join("\n\n");

    const questions: DebugQuestion[] = [];
    let questionIndex = 1;
    
    // Simulate interview context for realistic progression
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Ask the first technical interview question only." }
    ];

    // Generate questions sequentially
    let modelTurnCount = 0;
    while (questionIndex <= count && modelTurnCount < count * 3) {
      modelTurnCount++;
      const completion = await groq.chat.completions.create({
        model: GROQ_MOCK_INTERVIEW_MODEL,
        temperature: 0.2,
        messages: messages,
      });

      const raw = (completion.choices[0]?.message?.content ?? "").trim();
      if (!raw) {
        break;
      }

      const parsed = parseMockInterviewAssistantTurn(raw);
      const technicalQuestion = extractInterviewQuestionPrompt(parsed.visibleText, lang);

      messages.push({ role: "assistant", content: raw });

      if (parsed.interviewEnd) {
        break;
      }

      if (technicalQuestion) {
        questions.push({
          index: questionIndex,
          question: technicalQuestion,
          questionId: parsed.questionControl?.questionId,
          attempt: parsed.questionControl?.attempt,
          isFollowup: parsed.questionControl?.isFollowup,
        });

        messages.push({ 
          role: "user", 
          content: questionIndex < count ? "Continue with the next technical question only." : "End the interview." 
        });

        questionIndex++;
      } else {
        messages.push({
          role: "user",
          content: questionIndex === 1 ? "Ask the first technical question only." : "Continue with the next technical question only.",
        });
      }
    }

    const response: DebugResponse = {
      role,
      lang,
      level,
      questions,
    };

    return NextResponse.json(response);
    
  } catch (error) {
    logError("debug interview questions error", error);

    if (error instanceof BadRequestError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
