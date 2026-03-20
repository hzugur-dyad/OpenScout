import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { logError, logInfo, logWarn } from "@/lib/logger";
import { parseInterviewLocale } from "@/lib/interview-locale";
import { synthesizeInterviewSpeech } from "@/lib/tts";

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

export async function POST(request: NextRequest) {
  logInfo("tts request received");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const key = user
    ? `tts-user:${user.id}`
    : `tts-ip:${getClientIp(request)}`;
  if (!checkRateLimit(key, RATE_LIMITS.tts.limit, RATE_LIMITS.tts.windowMs)) {
    return NextResponse.json(
      { error: "Too many TTS requests. Please try again later." },
      { status: 429 }
    );
  }

  const apiKey = process.env.GOOGLE_CLOUD_TTS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_CLOUD_TTS_API_KEY is not configured. Add it to .env.local." },
      { status: 500 }
    );
  }

  let body: { text?: string; locale?: string };
  try {
    body = await request.json();
  } catch {
    logWarn("tts validation failed", { reason: "invalid JSON body" });
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    logWarn("tts validation failed", { reason: "text required" });
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const locale = parseInterviewLocale(typeof body.locale === "string" ? body.locale : undefined);

  let buffer: Buffer;
  try {
    const result = await synthesizeInterviewSpeech({ text, locale, apiKey });
    buffer = result.buffer;
  } catch (fetchError) {
    logError("tts Google TTS request failed", fetchError);
    return NextResponse.json(
      { error: fetchError instanceof Error ? fetchError.message : "TTS request failed" },
      { status: 502 }
    );
  }
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "audio/mpeg",
    },
  });
}
