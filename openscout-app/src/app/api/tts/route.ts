import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRateLimitIdentifier, rateLimitForKind, tooManyRequestsResponse } from "@/lib/rate-limit";
import { logError, logInfo, logWarn } from "@/lib/logger";
import { parseInterviewLocale } from "@/lib/interview-locale";
import { hasGoogleCloudTtsApiKeysConfigured, synthesizeInterviewSpeech } from "@/lib/tts";
import { captureException } from "@/lib/monitoring";

export async function POST(request: NextRequest) {
  logInfo("tts request received");
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const rlId = getRateLimitIdentifier(request, user?.id);
    const limited = await rateLimitForKind("tts", rlId);
    if (!limited.success) return tooManyRequestsResponse(limited);

    if (!hasGoogleCloudTtsApiKeysConfigured()) {
      return NextResponse.json(
        {
          error:
            "Google Cloud TTS API keys are not configured. Add GOOGLE_CLOUD_TTS_API_KEY, GOOGLE_CLOUD_TTS_API_KEYS, or indexed GOOGLE_CLOUD_TTS_API_KEY_1 variables.",
        },
        { status: 500 }
      );
    }

    let body: { text?: string; locale?: string; chunks?: string[] };
    try {
      body = await request.json();
    } catch {
      logWarn("tts validation failed", { reason: "invalid JSON body" });
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const locale = parseInterviewLocale(typeof body.locale === "string" ? body.locale : undefined);
    const preserveExactText = locale === "tr";

    const text = typeof body.text === "string" ? (preserveExactText ? body.text : body.text.trim()) : "";
    const textHasContent = typeof body.text === "string" && body.text.trim().length > 0;
    const chunks = Array.isArray(body.chunks)
      ? body.chunks
          .filter((chunk): chunk is string => typeof chunk === "string")
          .filter((chunk) => chunk.trim().length > 0)
          .slice(0, 3)
          .map((chunk) => (preserveExactText ? chunk : chunk.trim()))
      : [];
    if (!textHasContent && chunks.length === 0) {
      logWarn("tts validation failed", { reason: "text or chunks required" });
      return NextResponse.json({ error: "text or chunks is required" }, { status: 400 });
    }

    const textsToSynthesize = chunks.length > 0 ? chunks : [text];
    try {
      const results = await Promise.all(
        textsToSynthesize.map((chunkText) => synthesizeInterviewSpeech({ text: chunkText, locale }))
      );

      if (chunks.length > 0) {
        return NextResponse.json({
          audioChunks: results.map((result) => result.buffer.toString("base64")),
        });
      }

      const buffer = results[0]?.buffer;
      if (!buffer) {
        return NextResponse.json({ error: "TTS request failed" }, { status: 502 });
      }

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "audio/mpeg",
        },
      });
    } catch (fetchError) {
      logError("tts Google TTS request failed", fetchError);
      captureException(fetchError, {
        route: "/api/tts",
        ...(user?.id ? { user_id: user.id } : {}),
        aiInterview: { stage: "generation", reason: "tts_error" },
      });
      return NextResponse.json(
        { error: fetchError instanceof Error ? fetchError.message : "TTS request failed" },
        { status: 502 }
      );
    }
  } catch (e) {
    captureException(e, { route: "/api/tts" });
    return NextResponse.json({ error: "TTS error" }, { status: 500 });
  }
}
