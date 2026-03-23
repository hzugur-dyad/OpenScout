import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getGroq } from "@/lib/groq";
import { getRateLimitIdentifier, rateLimitForKind, tooManyRequestsResponse } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { logError, logWarn } from "@/lib/logger";
import { captureException } from "@/lib/monitoring";

const SUPPORT_CHAT_MODEL = "llama-3.3-70b-versatile";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(4000),
});

const bodySchema = z
  .object({
    messages: z.array(messageSchema).min(1).max(24),
  })
  .refine((b) => b.messages.every((m) => m.content.trim().length > 0), {
    message: "Messages must be non-empty",
  });

const SUPPORT_SYSTEM_PROMPT = `You are the on-site customer support assistant for OpenScout, an AI-powered hiring platform.

What OpenScout offers (high level):
- **Scout Score** — Candidates complete a structured AI mock interview and receive a shareable score and report to stand out to employers.
- **Job listings** — Role discovery for job seekers.
- **CV analysis** — Analyze a CV against real job descriptions for fit signals.
- **Employers** — Tools to review candidates and hiring workflows (as described on the product).

Behavior:
- Be concise, friendly, and accurate. Match the user's language (e.g. Turkish or English).
- If you do not know account-specific details, pricing, bugs, or legal matters, say you cannot see their account and suggest they use official contact or in-app flows if available — do not invent facts.
- Never ask for passwords, API keys, or payment card numbers.
- Do not claim to run code or access private user data.`;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const rlId = getRateLimitIdentifier(request, user?.id);
    const limited = await rateLimitForKind("supportChat", rlId);
    if (!limited.success) return tooManyRequestsResponse(limited);

    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      logWarn("support-chat validation failed", { issues: parsed.error.flatten() });
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { messages } = parsed.data;
    const last = messages[messages.length - 1];
    if (last.role !== "user") {
      return NextResponse.json({ error: "Last message must be from the user" }, { status: 400 });
    }

    const groqMessages = [
      { role: "system" as const, content: SUPPORT_SYSTEM_PROMPT },
      ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content.trim() })),
    ];

    const groq = getGroq();
    let completion;
    try {
      completion = await groq.chat.completions.create({
        model: SUPPORT_CHAT_MODEL,
        messages: groqMessages,
        max_tokens: 768,
        temperature: 0.5,
      });
    } catch (groqError) {
      logError("support-chat Groq request failed", groqError);
      captureException(groqError, { route: "/api/support-chat" });
      return NextResponse.json(
        { error: groqError instanceof Error ? groqError.message : "Assistant unavailable" },
        { status: 502 }
      );
    }

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      logWarn("support-chat empty model content", {});
      return NextResponse.json({ error: "Empty response" }, { status: 502 });
    }

    return NextResponse.json({ message: text });
  } catch (e) {
    if (e instanceof Error && e.message.includes("GROQ_API_KEY")) {
      return NextResponse.json({ error: "Support chat is not configured" }, { status: 503 });
    }
    captureException(e, { route: "/api/support-chat" });
    return NextResponse.json({ error: "Support chat error" }, { status: 500 });
  }
}
