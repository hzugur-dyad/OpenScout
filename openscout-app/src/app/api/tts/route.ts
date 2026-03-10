import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { logError, logInfo, logWarn } from "@/lib/logger";

const GOOGLE_TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

// Google TTS: reasonable limit for a single request (5000 chars)
const MAX_TEXT_LENGTH = 5000;

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

  let body: { text?: string };
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

  const textToSend = text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;

  let res: Response;
  try {
    res = await fetch(`${GOOGLE_TTS_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text: textToSend },
      voice: {
        languageCode: "en-US",
        name: "en-US-Neural2-F",
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 1,
        pitch: 0,
      },
    }),
  });
  } catch (fetchError) {
    logError("tts Google TTS request failed", fetchError);
    return NextResponse.json(
      { error: fetchError instanceof Error ? fetchError.message : "TTS request failed" },
      { status: 502 }
    );
  }

  if (!res.ok) {
    const errText = await res.text();
    let message = errText || `Google TTS error: ${res.status}`;
    try {
      const errJson = JSON.parse(errText) as { error?: { message?: string } };
      if (errJson?.error?.message) message = errJson.error.message;
    } catch {
      // use raw message
    }
    logError("tts Google TTS error response", { status: res.status, message });
    const status = res.status >= 500 ? 502 : res.status;
    return NextResponse.json({ error: message }, { status });
  }

  const data = (await res.json()) as { audioContent?: string };
  const b64 = data?.audioContent;
  if (!b64 || typeof b64 !== "string") {
    logError("tts Google TTS did not return audio", undefined);
    return NextResponse.json(
      { error: "Google TTS did not return audio" },
      { status: 502 }
    );
  }

  const buffer = Buffer.from(b64, "base64");
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "audio/mpeg",
    },
  });
}
