import { NextResponse } from "next/server";
import { captureMessage } from "@/lib/monitoring";
import { logWarn } from "@/lib/logger";
import { MOCK_INTERVIEW_LIVE_PROVIDER } from "@/lib/mock-interview/versioning";

const DEPRECATED_REALTIME_PROXY_MESSAGE =
  "Realtime SDP proxy is deprecated. Use /api/mock-interview/realtime/client-secret and connect to OpenAI Realtime directly from the browser.";

export async function POST() {
  logWarn("mock-interview realtime SDP proxy deprecated endpoint called", {
    operation: "realtime_proxy_deprecated",
  });

  captureMessage("Mock interview realtime SDP proxy endpoint called after deprecation", {
    route: "/api/mock-interview/realtime",
    tags: {
      feature: "ai_interview",
      operation: "realtime_proxy_deprecated",
      provider_path: MOCK_INTERVIEW_LIVE_PROVIDER,
    },
    aiInterview: { stage: "generation", reason: "realtime_error" },
  });

  return NextResponse.json(
    {
      error: DEPRECATED_REALTIME_PROXY_MESSAGE,
      code: "realtime_sdp_proxy_deprecated",
      operation: "realtime_proxy_deprecated",
      provider: MOCK_INTERVIEW_LIVE_PROVIDER,
    },
    { status: 410 }
  );
}
