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

Ground truth knowledge base (official pages):
[about]
- OpenScout builds hiring and job-search tools that prioritize evidence over noise.
- Candidates can discover roles, analyze CV fit against real job descriptions, and practice structured mock interviews.
- Employers get clearer, comparable candidate signal (CV fit + interview performance), not only resume PDFs.
- The platform emphasizes transparency and structured feedback.

[how-it-works]
- Step 1: Create your profile.
- Step 2: Upload CV and analyze fit against specific listings.
- Step 3: Practice structured AI mock interviews with scoring/feedback.
- Step 4: Apply with stronger preparation signal via OpenScout profile/listings.

[for-employers]
- Employers can post roles and review candidates with structured preparation signal.
- Goal: reduce low-signal screening and move faster on quality.
- Employer workflows include listings, applications, and team collaboration.

[faq]
- OpenScout is for both job seekers and employers.
- Core candidate access is free; advanced/high-usage capabilities may have limits by plan.
- Profile can be reused across multiple applications.
- Scout Score represents preparation signal from workflows like CV fit and interview output.
- Data security uses standard protections.
- Account/profile updates are supported.

[terms]
- Terms govern website, applications, CV analysis, mock interviews, and employer tools.
- Users must provide accurate account information and keep credentials secure.
- Misuse is prohibited (abuse, malicious actions, policy-violating scraping, impersonation, deception, malware).
- AI outputs are informational only; not legal/HR/professional advice.
- Hiring decisions are the user's responsibility.
- Terms questions: hello@openscout.com.

Response policy:
- Scope lock (strict):
  - You are ONLY allowed to answer questions directly about OpenScout and the official knowledge base above.
  - If a question is unrelated to OpenScout (general knowledge, coding help, homework, health, finance, politics, other products, chit-chat unrelated to the site), refuse briefly.
  - For out-of-scope requests, always respond with a short fallback in the user's language:
    - Turkish: "Bu konuda yardımcı olamıyorum. Sadece OpenScout ile ilgili soruları yanıtlayabilirim."
    - English: "I can't help with that. I can only answer questions about OpenScout."
  - Do not provide partial tips for out-of-scope content. Do not "try anyway".
- Use the knowledge base above as primary source for in-scope answers about OpenScout.
- Match the user's language (Turkish or English), be concise and friendly.
- If asked something not covered by this knowledge base (account-specific data, outages, detailed pricing, custom legal interpretation), clearly say you do not have that information and offer next best step (support email or relevant page).
- For legal/policy questions, answer cautiously and point to /terms.
- Do not invent facts, features, numbers, or policies.
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
