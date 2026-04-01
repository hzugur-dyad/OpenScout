"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Microphone, MicrophoneSlash, PhoneDisconnect } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Orb, type AgentState } from "@/components/ui/orb";
import { MockInterviewProcessingSkeleton } from "@/components/ui/Skeleton";
import { ANALYTICS_EVENTS, trackClient } from "@/lib/analytics";
import { interviewCopy, interviewUi, parseInterviewLocale, type InterviewLocale } from "@/lib/interview-locale";
import { captureException, captureMessage } from "@/lib/monitoring";
import {
  getRealtimeErrorUserMessage,
  OpenAIRealtimeError,
  type RealtimeErrorDebug,
} from "@/lib/mock-interview/realtime-errors";
import {
  buildMockInterviewRealtimeResponseInstructions,
  MOCK_INTERVIEW_REALTIME_OUTPUT_MODALITIES,
  normalizeMockInterviewRealtimeControl,
} from "@/lib/mock-interview/realtime";
import {
  extractRealtimeAnswerSdp,
  isLikelyRealtimeOfferSdp,
  isLikelyRealtimeSessionSdp,
  normalizeRealtimeSdp,
  summarizeRealtimeSdp,
} from "@/lib/mock-interview/realtime-sdp";
import { MOCK_INTERVIEW_LIVE_PROVIDER } from "@/lib/mock-interview/versioning";
import { mapMicrophoneError } from "@/lib/user-facing-errors";

type TranscriptEntry = { role: "user" | "assistant"; content: string };
type InterviewControl = { questionId: string; attempt: number; isFollowup: boolean };
type VoiceConnectionState = "idle" | "connecting" | "retrying" | "ready" | "degraded" | "failed";
type RealtimeClientSecretResponse = {
  client_secret?: string;
  code?: string;
  debug?: RealtimeErrorDebug;
  error?: string;
  expires_at?: number;
  model?: string;
  operation?: string;
  provider?: string;
  session?: Record<string, unknown> | null;
};
type RealtimeResponseOutput = { type?: string; name?: string; call_id?: string; arguments?: string };

const RESPONSE_WARNING_MS = 18_000;
const RESPONSE_LIMIT_MS = 42_000;
const STUCK_TURN_MS = 15_000;
const MIN_INTERVIEW_MS = 5 * 60 * 1000;
const ICE_GATHERING_TIMEOUT_MS = 8_000;
const LIVE_SPEECH_LEVEL_THRESHOLD = 4;
const VOICE_BOOTSTRAP_RETRY_HINT_DELAY_MS = 4_500;
const LOCAL_SPEECH_END_COMMIT_DELAY_MS = 1_200;
const LOCAL_LISTENING_IDLE_TIMEOUT_MS = 7_000;
const LOCAL_FORCE_COMMIT_AFTER_MS = 900;

function waitForIceGatheringCompletion(pc: RTCPeerConnection, timeoutMs = ICE_GATHERING_TIMEOUT_MS): Promise<boolean> {
  if (pc.iceGatheringState === "complete") return Promise.resolve(true);

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);

    const onStateChange = () => {
      if (pc.iceGatheringState !== "complete") return;
      cleanup();
      resolve(true);
    };

    const cleanup = () => {
      window.clearTimeout(timeout);
      pc.removeEventListener("icegatheringstatechange", onStateChange);
    };

    pc.addEventListener("icegatheringstatechange", onStateChange);
  });
}

function buildClientRealtimeError(args: {
  message: string;
  userMessage: string;
  operation: string;
  status?: number | null;
  statusText?: string | null;
  contentType?: string | null;
  bodyPreview?: string;
  durationMs?: number;
  retryAttempt?: number;
  requestId?: string | null;
  code?: string;
  kind?: string;
  cause?: unknown;
}) {
  return new OpenAIRealtimeError(
    args.message,
    {
      operation: args.operation,
      status: args.status,
      statusText: args.statusText,
      contentType: args.contentType,
      bodyPreview: args.bodyPreview,
      durationMs: args.durationMs,
      retryAttempt: args.retryAttempt,
      requestId: args.requestId,
      code: args.code,
      kind: args.kind,
      userMessage: args.userMessage,
    },
    { cause: args.cause }
  );
}

function getRealtimeResponsePreview(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 400);
}

function getRealtimeRequestId(headers: Headers): string | null {
  return headers.get("x-request-id") ?? headers.get("openai-request-id") ?? headers.get("cf-ray");
}

export default function MockInterviewSessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const jobCategory = searchParams.get("category") || "Frontend Developer";
  const jobId = searchParams.get("jobId") || "";
  const cvScoreParam = searchParams.get("cvScore");
  const cvScoreForApplication = cvScoreParam ? Number(cvScoreParam) : null;
  const locale: InterviewLocale = parseInterviewLocale(searchParams.get("lang"));
  const ui = interviewUi[locale];
  const copy = interviewCopy[locale];
  const supabase = useMemo(() => createClient(), []);
  const reduceMotion = useReducedMotion();
  const voiceConnectingLabel = locale === "tr" ? "Ses baglantisi kuruluyor..." : "Connecting voice...";
  const voiceRetryingLabel =
    locale === "tr"
      ? "Ses baglantisi upstream zaman asimina ugradi. Yeniden deneniyor..."
      : "Voice connection timed out upstream. Retrying...";
  const voiceServiceUnavailableLabel =
    locale === "tr"
      ? "Ses servisi gecici olarak kullanilamiyor. Lutfen tekrar deneyin."
      : "Voice service temporarily unavailable. Please try again.";
  const voicePlaybackIssueLabel =
    locale === "tr"
      ? "Ses cikisi su anda kullanilamiyor. Transkript guncellenmeye devam edecek."
      : "Voice audio is unavailable right now. Transcript will keep updating.";

  const [step, setStep] = useState<"mic-test" | "interview" | "goodbye" | "processing">("mic-test");
  const [micError, setMicError] = useState<string | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [voiceConnectionState, setVoiceConnectionState] = useState<VoiceConnectionState>("idle");
  const [voiceConnectionIssue, setVoiceConnectionIssue] = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [aiMessage, setAiMessage] = useState("");
  const [userName, setUserName] = useState("Candidate");
  const [isListening, setIsListening] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [isConnectingSession, setIsConnectingSession] = useState(false);
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioStreamRef = useRef<MediaStream | null>(null);
  const pendingRemoteAudioPlaybackRef = useRef(false);
  const liveMicStreamRef = useRef<MediaStream | null>(null);
  const interviewStartTimeRef = useRef<number | null>(null);
  const micAnalyserRef = useRef<{ analyser: AnalyserNode; ctx: AudioContext } | null>(null);
  const micAnimationRef = useRef<number | null>(null);
  const responseWarningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const responseLimitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stuckTurnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endDialogContinueRef = useRef<HTMLButtonElement>(null);
  const controlStateRef = useRef<InterviewControl | null>(null);
  const retryAfterUntilRef = useRef(0);
  const endedRef = useRef(false);
  const endingRef = useRef(false);
  const providerPathRef = useRef(MOCK_INTERVIEW_LIVE_PROVIDER);
  const heardSpeechThisTurnRef = useRef(false);
  const lastLocalSpeechAtRef = useRef<number | null>(null);
  const listeningStartedAtRef = useRef<number | null>(null);
  const silenceStrikeRef = useRef(0);
  const speechStoppedAtRef = useRef<number | null>(null);
  const turnCommittedAtRef = useRef<number | null>(null);
  const currentResponseIdRef = useRef<string | null>(null);
  const currentResponseKindRef = useRef("idle");
  const currentAssistantTranscriptRef = useRef("");
  const firstAssistantOutputAtRef = useRef<number | null>(null);
  const firstAssistantAudioAtRef = useRef<number | null>(null);
  const subtitleReadyRef = useRef(false);
  const pendingInterviewEndRef = useRef<string | null>(null);
  const processedUserItemIdsRef = useRef(new Set<string>());
  const processedAssistantItemIdsRef = useRef(new Set<string>());
  const processedFunctionCallIdsRef = useRef(new Set<string>());

  const replaceTranscript = useCallback((next: TranscriptEntry[]) => {
    transcriptRef.current = next;
    setTranscript(next);
  }, []);

  const appendTranscript = useCallback(
    (entry: TranscriptEntry) => replaceTranscript([...transcriptRef.current, entry]),
    [replaceTranscript]
  );

  const getInterviewErrorMessage = useCallback(
    (status: number) => (status === 429 ? ui.interviewRateLimitError : ui.interviewProviderError),
    [ui.interviewProviderError, ui.interviewRateLimitError]
  );

  const parseRetryAfterMs = useCallback((value: string | null) => {
    if (!value) return 0;
    const sec = Number(value);
    if (Number.isFinite(sec) && sec > 0) return Math.floor(sec * 1000);
    const dateMs = Date.parse(value);
    return Number.isFinite(dateMs) ? Math.max(0, dateMs - Date.now()) : 0;
  }, []);

  const clearResponseTimers = useCallback(() => {
    if (responseWarningTimerRef.current) clearTimeout(responseWarningTimerRef.current);
    if (responseLimitTimerRef.current) clearTimeout(responseLimitTimerRef.current);
    responseWarningTimerRef.current = null;
    responseLimitTimerRef.current = null;
  }, []);

  const clearStuckTurnTimer = useCallback(() => {
    if (stuckTurnTimerRef.current) clearTimeout(stuckTurnTimerRef.current);
    stuckTurnTimerRef.current = null;
  }, []);

  const sendRealtimeEvent = useCallback((event: Record<string, unknown>) => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== "open") return false;
    dc.send(JSON.stringify(event));
    return true;
  }, []);

  const playRemoteAudio = useCallback(async (reason: string) => {
    const audioEl = audioRef.current;
    if (!audioEl) {
      console.info("Mock interview remote audio element missing", { reason });
      return false;
    }
    if (!audioEl.srcObject) {
      console.info("Mock interview remote audio source missing", {
        reason,
        paused: audioEl.paused,
        readyState: audioEl.readyState,
      });
      return false;
    }
    try {
      await audioEl.play();
      pendingRemoteAudioPlaybackRef.current = false;
      setVoiceConnectionState("ready");
      setVoiceConnectionIssue(null);
      console.info("audio_play_ok", {
        reason,
        paused: audioEl.paused,
        readyState: audioEl.readyState,
        hasSrcObject: Boolean(audioEl.srcObject),
      });
      return true;
    } catch (error) {
      pendingRemoteAudioPlaybackRef.current = true;
      setVoiceConnectionState((current) =>
        current === "connecting" || current === "retrying" || current === "failed" ? current : "degraded"
      );
      setVoiceConnectionIssue(voicePlaybackIssueLabel);
      const message = error instanceof Error ? error.message : String(error);
      console.error("audio_play_failed", {
        reason,
        message,
        paused: audioEl.paused,
        readyState: audioEl.readyState,
        hasSrcObject: Boolean(audioEl.srcObject),
      });
      return false;
    }
  }, [voicePlaybackIssueLabel]);

  const attachRemoteAudioStream = useCallback(
    (stream: MediaStream, reason: string) => {
      remoteAudioStreamRef.current = stream;
      console.info("Mock interview remote audio stream attached", {
        reason,
        streamId: stream.id,
        audioTrackCount: stream.getAudioTracks().length,
        trackKinds: stream.getTracks().map((track) => track.kind),
      });
      const audioEl = audioRef.current;
      if (!audioEl) {
        console.info("Mock interview audio element not yet mounted", { reason, streamId: stream.id });
        return;
      }
      audioEl.autoplay = true;
      audioEl.muted = false;
      audioEl.volume = 1;
      audioEl.setAttribute("playsinline", "true");
      if (audioEl.srcObject !== stream) {
        audioEl.srcObject = stream;
      }
      console.info("Mock interview remote audio source bound", {
        reason,
        hasSrcObject: Boolean(audioEl.srcObject),
        paused: audioEl.paused,
        readyState: audioEl.readyState,
      });
      void playRemoteAudio(reason);
    },
    [playRemoteAudio]
  );

  const releaseRealtimeResources = useCallback(() => {
    clearResponseTimers();
    clearStuckTurnTimer();
    dcRef.current?.close();
    pcRef.current?.close();
    if (micAnimationRef.current) cancelAnimationFrame(micAnimationRef.current);
    if (micAnalyserRef.current) micAnalyserRef.current.ctx.close().catch(() => {});
    micAnimationRef.current = null;
    micAnalyserRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
    }
    remoteAudioStreamRef.current = null;
    pendingRemoteAudioPlaybackRef.current = false;
    liveMicStreamRef.current?.getTracks().forEach((track) => track.stop());
    dcRef.current = null;
    pcRef.current = null;
    liveMicStreamRef.current = null;
    lastLocalSpeechAtRef.current = null;
    setIsSessionReady(false);
    setIsListening(false);
    setIsAiResponding(false);
    setIsAiSpeaking(false);
    setMicLevel(0);
    setVoiceConnectionState("idle");
    setVoiceConnectionIssue(null);
  }, [clearResponseTimers, clearStuckTurnTimer]);

  const resetAssistantTurn = useCallback(
    (kind: string) => {
      currentResponseKindRef.current = kind;
      currentResponseIdRef.current = null;
      currentAssistantTranscriptRef.current = "";
      firstAssistantOutputAtRef.current = null;
      firstAssistantAudioAtRef.current = null;
      subtitleReadyRef.current = false;
      pendingInterviewEndRef.current = null;
      setAiMessage(copy.preparing);
      setIsAiResponding(true);
      setIsAiSpeaking(false);
      clearStuckTurnTimer();
      stuckTurnTimerRef.current = setTimeout(() => {
        captureMessage("Mock interview realtime turn appears stuck", {
          route: "/mock-interview/[sessionId]",
          session_id: sessionId,
          ...(jobId ? { job_id: jobId } : {}),
          tags: { feature: "ai_interview", provider_path: providerPathRef.current, turn_kind: kind },
          aiInterview: { stage: "generation", reason: "realtime_stuck_turn" },
        });
        setProviderError(ui.interviewProviderError);
        setIsAiResponding(false);
        setIsAiSpeaking(false);
      }, STUCK_TURN_MS);
    },
    [clearStuckTurnTimer, copy.preparing, jobId, sessionId, ui.interviewProviderError]
  );

  const requestAssistantResponse = useCallback(
    (kind: string, lastUserMessage = "", extraInstructions = "") => {
      const clientPrev = controlStateRef.current
        ? { questionId: controlStateRef.current.questionId, attemptCount: controlStateRef.current.attempt }
        : undefined;
      const instructions = [
        buildMockInterviewRealtimeResponseInstructions({ locale, lastUserMessage, clientPrev }),
        extraInstructions.trim(),
      ]
        .filter(Boolean)
        .join("\n\n");
      const sent = sendRealtimeEvent({
        type: "response.create",
        response: {
          output_modalities: [...MOCK_INTERVIEW_REALTIME_OUTPUT_MODALITIES],
          metadata: { kind, provider_path: providerPathRef.current },
          ...(instructions ? { instructions } : {}),
        },
      });
      console.info("Mock interview response.create dispatched", {
        operation: "response_create",
        kind,
        output_modalities: [...MOCK_INTERVIEW_REALTIME_OUTPUT_MODALITIES],
        sent,
      });
      if (!sent) {
        setProviderError(ui.interviewProviderError);
        return false;
      }
      resetAssistantTurn(kind);
      return true;
    },
    [locale, resetAssistantTurn, sendRealtimeEvent, ui.interviewProviderError]
  );

  const injectSyntheticTurn = useCallback(
    (message: string, kind: string) => {
      if (step !== "interview" || endedRef.current) return;
      clearResponseTimers();
      const created = sendRealtimeEvent({
        type: "conversation.item.create",
        item: { type: "message", role: "user", content: [{ type: "input_text", text: message }] },
      });
      if (!created) {
        setProviderError(ui.interviewProviderError);
        return;
      }
      appendTranscript({ role: "user", content: message });
      requestAssistantResponse(kind, message);
    },
    [appendTranscript, clearResponseTimers, requestAssistantResponse, sendRealtimeEvent, step, ui.interviewProviderError]
  );

  const scheduleResponseTimers = useCallback(() => {
    clearResponseTimers();
    if (step !== "interview" || endedRef.current || !isSessionReady || isListening || isAiResponding || isAiSpeaking) return;
    responseWarningTimerRef.current = setTimeout(() => injectSyntheticTurn(copy.responseDelayWarningCue, "timeout_warning"), RESPONSE_WARNING_MS);
    responseLimitTimerRef.current = setTimeout(() => injectSyntheticTurn(copy.noResponseCue, "timeout"), RESPONSE_LIMIT_MS);
  }, [
    clearResponseTimers,
    copy.noResponseCue,
    copy.responseDelayWarningCue,
    injectSyntheticTurn,
    isAiResponding,
    isAiSpeaking,
    isListening,
    isSessionReady,
    step,
  ]);

  const enqueueSilenceCue = useCallback(() => {
    const shouldEscalate = silenceStrikeRef.current >= 1;
    silenceStrikeRef.current = shouldEscalate ? 0 : 1;
    injectSyntheticTurn(
      shouldEscalate ? copy.silenceEscalateCue : copy.notHeardCue,
      shouldEscalate ? "silence_escalate" : "silence"
    );
  }, [copy.notHeardCue, copy.silenceEscalateCue, injectSyntheticTurn]);

  const appendUserTranscript = useCallback(
    (itemId: string | null, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (itemId) {
        if (processedUserItemIdsRef.current.has(itemId)) {
          captureMessage("Mock interview duplicate user transcript item", {
            route: "/mock-interview/[sessionId]",
            session_id: sessionId,
            ...(jobId ? { job_id: jobId } : {}),
            tags: { feature: "ai_interview", provider_path: providerPathRef.current },
            aiInterview: { stage: "generation", reason: "realtime_duplicate_turn" },
          });
          return;
        }
        processedUserItemIdsRef.current.add(itemId);
      }
      silenceStrikeRef.current = 0;
      appendTranscript({ role: "user", content: trimmed });
    },
    [appendTranscript, jobId, sessionId]
  );

  const appendAssistantTranscript = useCallback(
    (itemId: string | null, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (itemId) {
        if (processedAssistantItemIdsRef.current.has(itemId)) {
          captureMessage("Mock interview duplicate assistant transcript item", {
            route: "/mock-interview/[sessionId]",
            session_id: sessionId,
            ...(jobId ? { job_id: jobId } : {}),
            tags: { feature: "ai_interview", provider_path: providerPathRef.current },
            aiInterview: { stage: "generation", reason: "realtime_duplicate_turn" },
          });
          return;
        }
        processedAssistantItemIdsRef.current.add(itemId);
      }
      const last = transcriptRef.current[transcriptRef.current.length - 1];
      if (last?.role === "assistant" && last.content.trim() === trimmed) return;
      appendTranscript({ role: "assistant", content: trimmed });
    },
    [appendTranscript, jobId, sessionId]
  );

  const doEvaluateAndRedirect = useCallback(async () => {
    setStep("processing");
    const durationMs = interviewStartTimeRef.current ? Date.now() - interviewStartTimeRef.current : 0;
    if (durationMs < MIN_INTERVIEW_MS) {
      trackClient(ANALYTICS_EVENTS.interview_too_short, {
        job_category: jobCategory,
        session_id: sessionId,
        duration_ms: durationMs,
        ...(jobId ? { job_id: jobId } : {}),
      });
      const q = new URLSearchParams({ tooShort: "1", score: "0", strengths: "[]", improvements: "[]", category: jobCategory, lang: locale });
      if (cvScoreForApplication != null) q.set("cvScore", String(cvScoreForApplication));
      router.push(`/mock-interview/${sessionId}/result?${q.toString()}`);
      return;
    }
    try {
      const transcriptText = transcriptRef.current.map((m) => `${m.role}: ${m.content}`).join("\n") || "No conversation recorded.";
      const resultRes = await fetch("/api/mock-interview/result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, transcript: transcriptText, jobCategory, interviewLanguage: locale, durationMs, ...(jobId && { jobId }) }),
      });
      if (!resultRes.ok) {
        router.push(`/mock-interview/${sessionId}/result?error=1&lang=${encodeURIComponent(locale)}`);
        return;
      }
      let applicationSaved = false;
      if (jobId) {
        const appRes = await fetch("/api/job-applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        });
        applicationSaved = appRes.ok;
      }
      const q = new URLSearchParams({ lang: locale });
      if (applicationSaved) q.set("applicationSaved", "1");
      router.push(`/mock-interview/${sessionId}/result?${q.toString()}`);
    } catch (error) {
      captureException(error, { route: "/api/mock-interview/result", session_id: sessionId, ...(jobId ? { job_id: jobId } : {}) });
      router.push(`/mock-interview/${sessionId}/result?error=1&lang=${encodeURIComponent(locale)}`);
    }
  }, [cvScoreForApplication, jobCategory, jobId, locale, router, sessionId]);

  const finishInterviewFromRealtime = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    endedRef.current = true;
    releaseRealtimeResources();
    await doEvaluateAndRedirect();
  }, [doEvaluateAndRedirect, releaseRealtimeResources]);

  const handleRealtimeMessage = useCallback(
    async (event: MessageEvent<string>) => {
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(event.data) as Record<string, unknown>;
      } catch {
        return;
      }
      const type = typeof payload.type === "string" ? payload.type : "";
      if (!type || type === "session.created" || type === "session.updated") return;
      if (type === "input_audio_buffer.speech_started") {
        heardSpeechThisTurnRef.current = true;
        speechStoppedAtRef.current = null;
        return;
      }
      if (type === "input_audio_buffer.speech_stopped") {
        speechStoppedAtRef.current = Date.now();
        captureMessage("Mock interview user stop speaking", {
          route: "/mock-interview/[sessionId]",
          session_id: sessionId,
          ...(jobId ? { job_id: jobId } : {}),
          tags: { feature: "ai_interview", provider_path: providerPathRef.current },
        });
        return;
      }
      if (type === "conversation.item.input_audio_transcription.completed") {
        appendUserTranscript(typeof payload.item_id === "string" ? payload.item_id : null, typeof payload.transcript === "string" ? payload.transcript : "");
        return;
      }
      if (type === "response.created") {
        const response = payload.response as { id?: string } | undefined;
        currentResponseIdRef.current = typeof response?.id === "string" ? response.id : null;
        return;
      }
      if (type === "response.output_audio.delta") {
        if (!firstAssistantAudioAtRef.current) {
          firstAssistantAudioAtRef.current = Date.now();
          captureMessage("Mock interview first assistant audio packet", {
            route: "/mock-interview/[sessionId]",
            session_id: sessionId,
            ...(jobId ? { job_id: jobId } : {}),
            tags: { feature: "ai_interview", provider_path: providerPathRef.current, turn_kind: currentResponseKindRef.current },
            extra: { latency_ms: turnCommittedAtRef.current ? Date.now() - turnCommittedAtRef.current : null, response_id: currentResponseIdRef.current },
          });
          if (firstAssistantOutputAtRef.current) {
            captureMessage("Mock interview subtitle/audio drift measured", {
              route: "/mock-interview/[sessionId]",
              session_id: sessionId,
              ...(jobId ? { job_id: jobId } : {}),
              tags: { feature: "ai_interview", provider_path: providerPathRef.current },
              extra: { drift_ms: firstAssistantOutputAtRef.current - firstAssistantAudioAtRef.current, response_id: currentResponseIdRef.current },
            });
          }
        }
        subtitleReadyRef.current = true;
        setIsAiResponding(false);
        setIsAiSpeaking(true);
        if (currentAssistantTranscriptRef.current.trim()) setAiMessage(currentAssistantTranscriptRef.current.trim());
        clearStuckTurnTimer();
        return;
      }
      if (type === "response.output_audio_transcript.delta") {
        const delta = typeof payload.delta === "string" ? payload.delta : "";
        if (!delta) return;
        if (!firstAssistantOutputAtRef.current) {
          firstAssistantOutputAtRef.current = Date.now();
          captureMessage("Mock interview first assistant transcript output", {
            route: "/mock-interview/[sessionId]",
            session_id: sessionId,
            ...(jobId ? { job_id: jobId } : {}),
            tags: { feature: "ai_interview", provider_path: providerPathRef.current, turn_kind: currentResponseKindRef.current },
          });
        }
        currentAssistantTranscriptRef.current += delta;
        if (subtitleReadyRef.current) setAiMessage(currentAssistantTranscriptRef.current.trim());
        clearStuckTurnTimer();
        return;
      }
      if (type === "response.output_audio_transcript.done") {
        const text = typeof payload.transcript === "string" ? payload.transcript.trim() : currentAssistantTranscriptRef.current.trim();
        currentAssistantTranscriptRef.current = text;
        if (text) {
          setAiMessage(text);
          appendAssistantTranscript(typeof payload.item_id === "string" ? payload.item_id : null, text);
        }
        return;
      }
      if (type === "response.output_audio.done") {
        setIsAiSpeaking(false);
        setIsAiResponding(false);
        return;
      }
      if (type === "response.done") {
        clearStuckTurnTimer();
        setIsAiSpeaking(false);
        setIsAiResponding(false);
        const response = payload.response as { output?: RealtimeResponseOutput[] } | undefined;
        const outputs = Array.isArray(response?.output) ? response.output : [];
        let handledControl = false;
        for (const output of outputs) {
          if (output?.type !== "function_call" || output.name !== "report_interview_state" || typeof output.call_id !== "string") continue;
          if (processedFunctionCallIdsRef.current.has(output.call_id)) continue;
          processedFunctionCallIdsRef.current.add(output.call_id);
          handledControl = true;
          const normalized = normalizeMockInterviewRealtimeControl(output.arguments);
          if (normalized?.shouldEnd) {
            controlStateRef.current = null;
            pendingInterviewEndRef.current = normalized.endReason ?? "model_end";
          } else if (normalized) {
            controlStateRef.current = { questionId: normalized.questionId, attempt: normalized.attempt, isFollowup: normalized.isFollowup };
          }
          sendRealtimeEvent({ type: "conversation.item.create", item: { type: "function_call_output", call_id: output.call_id, output: JSON.stringify({ acknowledged: true }) } });
        }
        if (!handledControl) {
          captureMessage("Mock interview response ended without control tool call", {
            route: "/mock-interview/[sessionId]",
            session_id: sessionId,
            ...(jobId ? { job_id: jobId } : {}),
            tags: { feature: "ai_interview", provider_path: providerPathRef.current, turn_kind: currentResponseKindRef.current },
            aiInterview: { stage: "generation", reason: "realtime_error" },
          });
        }
        if (pendingInterviewEndRef.current && !endedRef.current && step === "interview") {
          await finishInterviewFromRealtime();
          return;
        }
        scheduleResponseTimers();
        return;
      }
      if (type === "error") {
        console.error("realtime_event_error", {
          operation: "realtime_event",
          responseId: currentResponseIdRef.current,
          payload,
        });
        setProviderError(typeof payload.message === "string" && payload.message.trim() ? payload.message : ui.interviewProviderError);
        setVoiceConnectionState((current) =>
          current === "connecting" || current === "retrying" || current === "failed" ? current : "degraded"
        );
        setVoiceConnectionIssue(voiceServiceUnavailableLabel);
        clearStuckTurnTimer();
        setIsAiResponding(false);
        setIsAiSpeaking(false);
      }
    },
    [appendAssistantTranscript, appendUserTranscript, clearStuckTurnTimer, finishInterviewFromRealtime, jobId, scheduleResponseTimers, sendRealtimeEvent, sessionId, step, ui.interviewProviderError, voiceServiceUnavailableLabel]
  );

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    const onLoadedMetadata = () => {
      console.info("Mock interview remote audio metadata loaded", {
        readyState: audioEl.readyState,
        hasSrcObject: Boolean(audioEl.srcObject),
      });
      void playRemoteAudio("loadedmetadata");
    };
    const onCanPlay = () => {
      console.info("Mock interview remote audio canplay", {
        readyState: audioEl.readyState,
        hasSrcObject: Boolean(audioEl.srcObject),
      });
      if (pendingRemoteAudioPlaybackRef.current) {
        void playRemoteAudio("canplay_retry");
      }
    };

    audioEl.addEventListener("loadedmetadata", onLoadedMetadata);
    audioEl.addEventListener("canplay", onCanPlay);
    return () => {
      audioEl.removeEventListener("loadedmetadata", onLoadedMetadata);
      audioEl.removeEventListener("canplay", onCanPlay);
    };
  }, [playRemoteAudio]);

  useEffect(() => {
    const audioEl = audioRef.current;
    const stream = remoteAudioStreamRef.current;
    if (!audioEl || !stream) return;
    audioEl.autoplay = true;
    audioEl.muted = false;
    audioEl.volume = 1;
    audioEl.setAttribute("playsinline", "true");
    if (audioEl.srcObject !== stream) {
      audioEl.srcObject = stream;
      console.info("Mock interview remote audio source re-bound after render", {
        streamId: stream.id,
        audioTrackCount: stream.getAudioTracks().length,
      });
    }
    if (pendingRemoteAudioPlaybackRef.current) {
      void playRemoteAudio("post_render_retry");
    }
  });

  useEffect(() => {
    if (step !== "interview") return;
    const resumePlayback = () => {
      if (!pendingRemoteAudioPlaybackRef.current || !audioRef.current?.srcObject) return;
      void playRemoteAudio("user_gesture_retry");
    };
    window.addEventListener("pointerdown", resumePlayback, true);
    window.addEventListener("keydown", resumePlayback, true);
    return () => {
      window.removeEventListener("pointerdown", resumePlayback, true);
      window.removeEventListener("keydown", resumePlayback, true);
    };
  }, [playRemoteAudio, step]);

  useEffect(() => {
    if (!isConnectingSession || step !== "interview") return;
    setVoiceConnectionState("connecting");
    const timer = window.setTimeout(() => {
      setVoiceConnectionState((current) => (current === "connecting" ? "retrying" : current));
    }, VOICE_BOOTSTRAP_RETRY_HINT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isConnectingSession, step]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("first_name").eq("user_id", user.id).maybeSingle().then(({ data }) => {
        const name = (data as { first_name?: string } | null)?.first_name;
        if (name?.trim()) setUserName(name.trim());
      });
    });
  }, [supabase]);

  useEffect(() => {
    if (step !== "mic-test") return;
    let active = true;
    let stream: MediaStream | null = null;
    setMicError(null);
    navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => {
      if (!active) {
        s.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = s;
      setMicStream(s);
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(s);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      micAnalyserRef.current = { analyser, ctx };
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!micAnalyserRef.current) return;
        micAnalyserRef.current.analyser.getByteFrequencyData(data);
        const avg = data.reduce((sum, n) => sum + n, 0) / data.length;
        setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
        micAnimationRef.current = requestAnimationFrame(tick);
      };
      micAnimationRef.current = requestAnimationFrame(tick);
    }).catch((error: DOMException | Error) => {
      setMicError(mapMicrophoneError(error, copy.micDenied));
      setMicStream(null);
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        captureException(error, { route: "/mock-interview/[sessionId]", session_id: sessionId, ...(jobId ? { job_id: jobId } : {}), tags: { feature: "ai_interview", mic: "getUserMedia" } });
      }
    });
    return () => {
      active = false;
      if (micAnimationRef.current) cancelAnimationFrame(micAnimationRef.current);
      if (micAnalyserRef.current) micAnalyserRef.current.ctx.close().catch(() => {});
      micAnalyserRef.current = null;
      stream?.getTracks().forEach((track) => track.stop());
      setMicStream(null);
      setMicLevel(0);
    };
  }, [copy.micDenied, jobId, sessionId, step]);

  const bootstrapRealtimeSession = useCallback(async () => {
    const baseStream = micStream && micStream.getAudioTracks().length > 0 ? micStream : await navigator.mediaDevices.getUserMedia({ audio: true });
    const liveStream = new MediaStream(baseStream.getAudioTracks().map((track) => track.clone()));
    liveStream.getAudioTracks().forEach((track) => { track.enabled = false; });
    liveMicStreamRef.current = liveStream;
    if (micAnimationRef.current) cancelAnimationFrame(micAnimationRef.current);
    if (micAnalyserRef.current) micAnalyserRef.current.ctx.close().catch(() => {});
    {
      const liveAudioCtx = new AudioContext();
      const liveSource = liveAudioCtx.createMediaStreamSource(liveStream);
      const liveAnalyser = liveAudioCtx.createAnalyser();
      liveAnalyser.fftSize = 256;
      liveAnalyser.smoothingTimeConstant = 0.8;
      liveSource.connect(liveAnalyser);
      micAnalyserRef.current = { analyser: liveAnalyser, ctx: liveAudioCtx };
      const data = new Uint8Array(liveAnalyser.frequencyBinCount);
      const tick = () => {
        if (!micAnalyserRef.current || liveMicStreamRef.current !== liveStream) return;
        liveAnalyser.getByteFrequencyData(data);
        const avg = data.reduce((sum, n) => sum + n, 0) / data.length;
        const activeMic = liveStream.getAudioTracks().some((track) => track.enabled);
        if (activeMic) {
          setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
          if (avg >= LIVE_SPEECH_LEVEL_THRESHOLD) {
            heardSpeechThisTurnRef.current = true;
            lastLocalSpeechAtRef.current = Date.now();
            speechStoppedAtRef.current = null;
          }
        } else {
          setMicLevel(0);
        }
        micAnimationRef.current = requestAnimationFrame(tick);
      };
      micAnimationRef.current = requestAnimationFrame(tick);
    }
    const pc = new RTCPeerConnection();
    pcRef.current = pc;

    const logPeerState = (reason: string) => {
      console.info("Mock interview realtime peer state", {
        reason,
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
        iceGatheringState: pc.iceGatheringState,
        signalingState: pc.signalingState,
      });
    };

    const audioEl = audioRef.current;
    if (audioEl) {
      audioEl.autoplay = true;
      audioEl.muted = false;
      audioEl.volume = 1;
      audioEl.setAttribute("playsinline", "true");
      console.info("Mock interview audio element primed", {
        hasSrcObject: Boolean(audioEl.srcObject),
        paused: audioEl.paused,
      });
    } else {
      console.info("Mock interview audio element missing at bootstrap");
    }

    pc.onconnectionstatechange = () => logPeerState("connectionstatechange");
    pc.oniceconnectionstatechange = () => logPeerState("iceconnectionstatechange");
    pc.onicegatheringstatechange = () => logPeerState("icegatheringstatechange");
    pc.onsignalingstatechange = () => logPeerState("signalingstatechange");
    logPeerState("created");

    pc.ontrack = (evt) => {
      console.info("remote_audio_track_received", {
        kind: evt.track.kind,
        trackId: evt.track.id,
        streams: evt.streams.length,
        streamAudioTrackCounts: evt.streams.map((stream) => stream.getAudioTracks().length),
      });
      if (evt.track.kind !== "audio") return;

      const stream =
        evt.streams[0] ??
        (() => {
          const fallbackStream = remoteAudioStreamRef.current ?? new MediaStream();
          if (!fallbackStream.getTracks().some((track) => track.id === evt.track.id)) {
            fallbackStream.addTrack(evt.track);
          }
          return fallbackStream;
        })();

      attachRemoteAudioStream(stream, evt.streams[0] ? "remote_track_stream" : "remote_track_fallback_stream");
      evt.track.onunmute = () => {
        console.info("Mock interview remote audio track unmuted", {
          trackId: evt.track.id,
          readyState: evt.track.readyState,
        });
        void playRemoteAudio("remote_track_unmuted");
      };
      evt.track.onmute = () => {
        console.info("Mock interview remote audio track muted", {
          trackId: evt.track.id,
          readyState: evt.track.readyState,
        });
      };
      evt.track.onended = () => {
        console.info("Mock interview remote audio track ended", {
          trackId: evt.track.id,
          readyState: evt.track.readyState,
        });
      };
    };
    liveStream.getTracks().forEach((track) => pc.addTrack(track, liveStream));
    const dc = pc.createDataChannel("oai-events");
    dcRef.current = dc;
    dc.onmessage = (evt) => { void handleRealtimeMessage(evt as MessageEvent<string>); };
    const offer = await pc.createOffer();
    console.info("webrtc_offer_created", {
      offerType: offer.type,
      offerSdpLength: offer.sdp?.length ?? 0,
    });
    await pc.setLocalDescription(offer);
    console.info("webrtc_local_description_set", {
      localDescriptionType: pc.localDescription?.type ?? null,
      localDescriptionSdpLength: pc.localDescription?.sdp?.length ?? 0,
    });
    const iceGatheringCompleted = await waitForIceGatheringCompletion(pc);
    const localDescription = pc.localDescription;
    const directOfferSdp = localDescription?.sdp ?? offer.sdp ?? "";
    const normalizedOfferSdp = normalizeRealtimeSdp(directOfferSdp);
    const offerSummary = summarizeRealtimeSdp(normalizedOfferSdp);

    console.info("Mock interview local realtime offer ready", {
      offerType: offer.type,
      offerSdpLength: offer.sdp?.length ?? 0,
      localDescriptionType: localDescription?.type ?? null,
      localDescriptionSdpLength: localDescription?.sdp?.length ?? 0,
      normalizedSdpLength: offerSummary.length,
      iceGatheringState: pc.iceGatheringState,
      iceGatheringCompleted,
      hasAudioMLine: offerSummary.hasAudioMLine,
      hasIceCandidate: offerSummary.hasIceCandidate,
      hasIceUfrag: offerSummary.hasIceUfrag,
      hasIcePwd: offerSummary.hasIcePwd,
      hasFingerprint: offerSummary.hasFingerprint,
    });

    if (!normalizedOfferSdp || !isLikelyRealtimeOfferSdp(normalizedOfferSdp) || !offerSummary.hasIceCandidate) {
      captureMessage("Mock interview browser failed to produce SDP offer", {
        route: "/mock-interview/[sessionId]",
        session_id: sessionId,
        ...(jobId ? { job_id: jobId } : {}),
        tags: { feature: "ai_interview", provider_path: providerPathRef.current },
        extra: {
          offer_type: offer.type,
          offer_sdp_length: offer.sdp?.length ?? 0,
          local_description_type: localDescription?.type ?? null,
          local_description_sdp_length: localDescription?.sdp?.length ?? 0,
          normalized_sdp_length: offerSummary.length,
          ice_gathering_state: pc.iceGatheringState,
          ice_gathering_completed: iceGatheringCompleted,
          has_audio_mline: offerSummary.hasAudioMLine,
          has_ice_candidate: offerSummary.hasIceCandidate,
          has_ice_ufrag: offerSummary.hasIceUfrag,
          has_ice_pwd: offerSummary.hasIcePwd,
          has_fingerprint: offerSummary.hasFingerprint,
        },
        aiInterview: { stage: "generation", reason: "realtime_error" },
      });
      throw new Error(
        offerSummary.hasIceCandidate
          ? "Local SDP offer is empty or invalid"
          : "Local SDP offer does not contain any ICE candidates"
      );
    }

    const clientSecretStartedAt = Date.now();
    console.info("client_secret_request_start", {
      operation: "client_secret_mint",
      sessionId,
      jobId: jobId || null,
      jobCategory,
      locale,
    });
    let clientSecretResponse: Response;
    try {
      clientSecretResponse = await fetch("/api/mock-interview/realtime/client-secret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          jobCategory,
          userName,
          interviewLanguage: locale,
          ...(jobId && { jobId }),
        }),
      });
    } catch (error) {
      console.error("client_secret_request_failed", {
        operation: "client_secret_mint",
        duration_ms: Date.now() - clientSecretStartedAt,
        cause_message: error instanceof Error ? error.message : String(error),
      });
      throw buildClientRealtimeError({
        message: "Realtime client secret request failed before receiving a response",
        userMessage: voiceServiceUnavailableLabel,
        operation: "client_secret_mint",
        durationMs: Date.now() - clientSecretStartedAt,
        code: "client_secret_network_failure",
        kind: "client_network_error",
        cause: error,
      });
    }
    const clientSecretDurationMs = Date.now() - clientSecretStartedAt;
    const clientSecretContentType = clientSecretResponse.headers.get("content-type");
    const rawClientSecretText = await clientSecretResponse.text();
    const clientSecretBodyPreview = getRealtimeResponsePreview(rawClientSecretText);
    const clientSecretRequestId = getRealtimeRequestId(clientSecretResponse.headers);
    let clientSecretBody: RealtimeClientSecretResponse;
    if (clientSecretContentType?.includes("application/json")) {
      try {
        clientSecretBody = (JSON.parse(rawClientSecretText) as RealtimeClientSecretResponse) ?? {};
      } catch {
        clientSecretBody = { error: getInterviewErrorMessage(clientSecretResponse.status) };
      }
    } else {
      clientSecretBody = { error: rawClientSecretText || getInterviewErrorMessage(clientSecretResponse.status) };
    }
    if (clientSecretBody.debug) {
      console.error("openai_raw_response", clientSecretBody.debug);
    }
    retryAfterUntilRef.current =
      clientSecretResponse.status === 429
        ? Date.now() + Math.max(parseRetryAfterMs(clientSecretResponse.headers.get("Retry-After")), 60_000)
        : 0;
    if (!clientSecretResponse.ok || typeof clientSecretBody.client_secret !== "string" || !clientSecretBody.client_secret.trim()) {
      const debug = clientSecretBody.debug;
      const diagnostics = {
        operation: clientSecretBody.operation ?? "client_secret_mint",
        status: clientSecretResponse.status,
        statusText: clientSecretResponse.statusText,
        contentType: clientSecretContentType,
        bodyPreview: debug?.bodyPreview ?? clientSecretBodyPreview,
        rawBodyPreview: rawClientSecretText.slice(0, 300),
        durationMs: clientSecretDurationMs,
        retryAttempt: debug?.retryAttempt,
        requestId: debug?.requestId ?? clientSecretRequestId,
        code: clientSecretBody.code,
        kind: debug?.kind,
        debug,
      };
      console.error("client_secret_request_failed", diagnostics);
      throw buildClientRealtimeError({
        message:
          clientSecretBody.debug?.message ||
          (!clientSecretResponse.ok
            ? `Realtime client secret request failed with HTTP ${clientSecretResponse.status}${clientSecretResponse.statusText ? ` ${clientSecretResponse.statusText}` : ""}`
            : "Realtime client secret response did not include a client secret"),
        userMessage: clientSecretBody.error?.trim() || voiceServiceUnavailableLabel,
        cause: clientSecretBody.debug ?? rawClientSecretText,
        ...diagnostics,
      });
    }
    providerPathRef.current = clientSecretBody.provider || MOCK_INTERVIEW_LIVE_PROVIDER;
    const effectiveSessionModel =
      typeof clientSecretBody.session?.model === "string"
        ? (clientSecretBody.session.model as string)
        : typeof clientSecretBody.model === "string"
          ? clientSecretBody.model
          : null;
    console.info("client_secret_request_ok", {
      operation: "client_secret_mint",
      duration_ms: clientSecretDurationMs,
      expires_at: clientSecretBody.expires_at ?? null,
      model: effectiveSessionModel,
      provider: providerPathRef.current,
      request_id: clientSecretRequestId,
    });

    const openAiDirectStartedAt = Date.now();
    console.info("openai_direct_sdp_post_start", {
      operation: "openai_direct_sdp_post",
      sdpLength: normalizedOfferSdp.length,
      model: effectiveSessionModel,
    });
    let openAiDirectResponse: Response;
    try {
      openAiDirectResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${clientSecretBody.client_secret}`,
          Accept: "application/sdp",
          "Content-Type": "application/sdp",
        },
        body: normalizedOfferSdp,
      });
    } catch (error) {
      console.error("openai_direct_sdp_post_failed", {
        operation: "openai_direct_sdp_post",
        duration_ms: Date.now() - openAiDirectStartedAt,
        cause_message: error instanceof Error ? error.message : String(error),
      });
      throw buildClientRealtimeError({
        message: "OpenAI direct SDP exchange failed before receiving a response",
        userMessage: voiceServiceUnavailableLabel,
        operation: "openai_direct_sdp_post",
        durationMs: Date.now() - openAiDirectStartedAt,
        code: "realtime_direct_sdp_network_failure",
        kind: "upstream_network_error",
        cause: error,
      });
    }
    const openAiDirectDurationMs = Date.now() - openAiDirectStartedAt;
    const openAiDirectContentType = openAiDirectResponse.headers.get("content-type");
    const openAiDirectText = await openAiDirectResponse.text();
    const openAiDirectPreview = getRealtimeResponsePreview(openAiDirectText);
    const openAiDirectRequestId = getRealtimeRequestId(openAiDirectResponse.headers);
    if (openAiDirectResponse.status === 429) {
      retryAfterUntilRef.current =
        Date.now() + Math.max(parseRetryAfterMs(openAiDirectResponse.headers.get("Retry-After")), 60_000);
    }
    if (!openAiDirectResponse.ok) {
      const diagnostics = {
        operation: "openai_direct_sdp_post",
        status: openAiDirectResponse.status,
        statusText: openAiDirectResponse.statusText,
        contentType: openAiDirectContentType,
        bodyPreview: openAiDirectPreview,
        rawBodyPreview: openAiDirectText.slice(0, 300),
        durationMs: openAiDirectDurationMs,
        requestId: openAiDirectRequestId,
        code: openAiDirectResponse.status === 504 ? "upstream_gateway_timeout" : "realtime_direct_sdp_failed",
        kind: openAiDirectResponse.status === 504 ? "upstream_gateway_timeout" : "upstream_http_error",
      };
      console.error("openai_raw_response", diagnostics);
      console.error("openai_direct_sdp_post_failed", diagnostics);
      throw buildClientRealtimeError({
        message:
          openAiDirectResponse.status === 504
            ? "OpenAI direct SDP exchange returned a gateway timeout"
            : `OpenAI direct SDP exchange failed with HTTP ${openAiDirectResponse.status}${openAiDirectResponse.statusText ? ` ${openAiDirectResponse.statusText}` : ""}`,
        userMessage: voiceServiceUnavailableLabel,
        cause: openAiDirectText,
        ...diagnostics,
      });
    }
    const answerSdp = extractRealtimeAnswerSdp(openAiDirectText);
    const answerSummary = summarizeRealtimeSdp(answerSdp);
    if (!answerSdp) {
      const diagnostics = {
        operation: "openai_direct_sdp_post",
        status: openAiDirectResponse.status,
        statusText: openAiDirectResponse.statusText,
        contentType: openAiDirectContentType,
        bodyPreview: openAiDirectPreview,
        rawBodyPreview: openAiDirectText.slice(0, 300),
        durationMs: openAiDirectDurationMs,
        requestId: openAiDirectRequestId,
        code: "realtime_direct_sdp_missing_answer",
        kind: "upstream_http_error",
      };
      console.error("openai_raw_response", diagnostics);
      console.error("openai_direct_sdp_post_failed", diagnostics);
      throw buildClientRealtimeError({
        message: "OpenAI direct SDP exchange returned an empty SDP answer",
        userMessage: voiceServiceUnavailableLabel,
        cause: openAiDirectText,
        ...diagnostics,
      });
    }
    if (!isLikelyRealtimeSessionSdp(answerSdp)) {
      const diagnostics = {
        operation: "openai_direct_sdp_post",
        status: openAiDirectResponse.status,
        statusText: openAiDirectResponse.statusText,
        contentType: openAiDirectContentType,
        bodyPreview: openAiDirectPreview,
        rawBodyPreview: openAiDirectText.slice(0, 300),
        durationMs: openAiDirectDurationMs,
        requestId: openAiDirectRequestId,
        code: "realtime_direct_sdp_invalid_answer",
        kind: "upstream_http_error",
      };
      console.error("openai_raw_response", {
        ...diagnostics,
        answerSummary,
      });
      console.error("openai_direct_sdp_post_failed", {
        ...diagnostics,
        answerSummary,
      });
      throw buildClientRealtimeError({
        message: "OpenAI direct SDP exchange returned an invalid SDP answer",
        userMessage: voiceServiceUnavailableLabel,
        cause: openAiDirectText,
        ...diagnostics,
      });
    }
    console.info("openai_direct_sdp_post_ok", {
      operation: "openai_direct_sdp_post",
      status: openAiDirectResponse.status,
      duration_ms: openAiDirectDurationMs,
      response_content_type: openAiDirectContentType,
      answerSdpLength: answerSummary.length,
      answerHasAudioMLine: answerSummary.hasAudioMLine,
      answerHasIceUfrag: answerSummary.hasIceUfrag,
      answerHasIcePwd: answerSummary.hasIcePwd,
      answerHasFingerprint: answerSummary.hasFingerprint,
      request_id: openAiDirectRequestId,
    });
    try {
      const remoteDescription =
        typeof RTCSessionDescription === "function"
          ? new RTCSessionDescription({ type: "answer", sdp: answerSdp })
          : { type: "answer" as RTCSdpType, sdp: answerSdp };
      await pc.setRemoteDescription(remoteDescription);
    } catch (error) {
      console.error("openai_direct_sdp_answer_apply_failed", {
        operation: "remote_description",
        duration_ms: openAiDirectDurationMs,
        request_id: openAiDirectRequestId,
        response_content_type: openAiDirectContentType,
        answerSummary,
        signalingState: pc.signalingState,
        iceConnectionState: pc.iceConnectionState,
        connectionState: pc.connectionState,
        cause_message: error instanceof Error ? error.message : String(error),
      });
      throw buildClientRealtimeError({
        message: "Failed to apply the OpenAI realtime SDP answer",
        userMessage: voiceServiceUnavailableLabel,
        operation: "remote_description",
        durationMs: openAiDirectDurationMs,
        requestId: openAiDirectRequestId,
        bodyPreview: `answer_sdp_length=${answerSummary.length},line_count=${answerSummary.lineCount},audio_mline=${answerSummary.hasAudioMLine},ice_ufrag=${answerSummary.hasIceUfrag},ice_pwd=${answerSummary.hasIcePwd},fingerprint=${answerSummary.hasFingerprint}`,
        cause: error,
      });
    }
    console.info("remote_description_set_ok", {
      type: "answer",
      sdpLength: answerSdp.length,
      provider: providerPathRef.current,
    });
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () =>
          reject(
            buildClientRealtimeError({
              message: "Realtime data channel open timed out",
              userMessage: voiceServiceUnavailableLabel,
              operation: "realtime_connection",
              durationMs: 12_000,
              code: "data_channel_timeout",
            })
          ),
        12_000
      );
      dc.onopen = () => {
        clearTimeout(timeout);
        dc.onmessage = (evt) => { void handleRealtimeMessage(evt as MessageEvent<string>); };
        resolve();
      };
      dc.onerror = () => {
        clearTimeout(timeout);
        reject(
          buildClientRealtimeError({
            message: "Realtime data channel errored before opening",
            userMessage: voiceServiceUnavailableLabel,
            operation: "realtime_connection",
            code: "data_channel_error",
          })
        );
      };
    });
    setIsSessionReady(true);
    setVoiceConnectionState("ready");
    setVoiceConnectionIssue(null);
    captureMessage("Mock interview live provider path in use", {
      route: "/mock-interview/[sessionId]",
      session_id: sessionId,
      ...(jobId ? { job_id: jobId } : {}),
      tags: { feature: "ai_interview", provider_path: providerPathRef.current, operation: "browser_direct_realtime" },
      extra: {
        provider: providerPathRef.current,
        model: effectiveSessionModel,
        client_secret_expires_at: clientSecretBody.expires_at ?? null,
      },
    });
    requestAssistantResponse(
      "opening",
      "",
      locale === "tr"
        ? "Mülakata şimdi başla. Kısa selamdan sonra ilk teknik soruyu sor."
        : "Start the interview now. Give the short greeting, then ask the first technical question."
    );
  }, [attachRemoteAudioStream, getInterviewErrorMessage, handleRealtimeMessage, jobCategory, jobId, locale, micStream, parseRetryAfterMs, playRemoteAudio, requestAssistantResponse, sessionId, userName, voiceServiceUnavailableLabel]);

  const startInterview = useCallback(async () => {
    if (isConnectingSession) return;
    if (Date.now() < retryAfterUntilRef.current) {
      setProviderError(ui.interviewRateLimitError);
      return;
    }
    setIsConnectingSession(true);
    endedRef.current = false;
    endingRef.current = false;
    controlStateRef.current = null;
    silenceStrikeRef.current = 0;
    processedUserItemIdsRef.current.clear();
    processedAssistantItemIdsRef.current.clear();
    processedFunctionCallIdsRef.current.clear();
    replaceTranscript([]);
    setAiMessage(copy.preparing);
    setProviderError(null);
    setVoiceConnectionIssue(null);
    setVoiceConnectionState("connecting");
    setStep("interview");
    interviewStartTimeRef.current = Date.now();
    console.info("start_interview_begin", {
      sessionId,
      jobId: jobId || null,
      locale,
      jobCategory,
    });
    trackClient(ANALYTICS_EVENTS.interview_started, { job_category: jobCategory, session_id: sessionId, ...(jobId ? { job_id: jobId } : {}) });
    try {
      await bootstrapRealtimeSession();
    } catch (error) {
      console.error("final_error", error);
      captureException(error, { route: "/mock-interview/[sessionId]", session_id: sessionId, ...(jobId ? { job_id: jobId } : {}), aiInterview: { stage: "generation", reason: "realtime_error" } });
      setVoiceConnectionState("failed");
      const userMessage = getRealtimeErrorUserMessage(error, voiceServiceUnavailableLabel);
      setVoiceConnectionIssue(userMessage);
      releaseRealtimeResources();
      setProviderError(userMessage);
      setStep("mic-test");
    } finally {
      setIsConnectingSession(false);
    }
  }, [bootstrapRealtimeSession, copy.preparing, isConnectingSession, jobCategory, jobId, locale, replaceTranscript, releaseRealtimeResources, sessionId, ui.interviewRateLimitError, voiceServiceUnavailableLabel]);

  const startListening = useCallback(() => {
    if (step !== "interview" || !isSessionReady || isAiResponding || isAiSpeaking) return;
    clearResponseTimers();
    heardSpeechThisTurnRef.current = false;
    lastLocalSpeechAtRef.current = null;
    speechStoppedAtRef.current = null;
    setProviderError(null);
    if (!sendRealtimeEvent({ type: "input_audio_buffer.clear" })) {
      setProviderError(ui.interviewProviderError);
      return;
    }
    liveMicStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = true; });
    listeningStartedAtRef.current = Date.now();
    setIsListening(true);
    setMicLevel(40);
  }, [clearResponseTimers, isAiResponding, isAiSpeaking, isSessionReady, sendRealtimeEvent, step, ui.interviewProviderError]);

  const stopListeningAndCommit = useCallback(() => {
    if (!isListening) return;
    const listeningStartedAt = listeningStartedAtRef.current;
    const listenedForMs = listeningStartedAt ? Date.now() - listeningStartedAt : 0;
    liveMicStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = false; });
    listeningStartedAtRef.current = null;
    setIsListening(false);
    setMicLevel(0);
    if (!heardSpeechThisTurnRef.current) {
      if (listenedForMs < LOCAL_FORCE_COMMIT_AFTER_MS) {
        enqueueSilenceCue();
        return;
      }
      captureMessage("Mock interview force committing user turn without local speech detection", {
        route: "/mock-interview/[sessionId]",
        session_id: sessionId,
        ...(jobId ? { job_id: jobId } : {}),
        tags: { feature: "ai_interview", provider_path: providerPathRef.current, detection_source: "fallback_commit" },
        extra: { listened_for_ms: listenedForMs },
      });
    }
    speechStoppedAtRef.current = lastLocalSpeechAtRef.current ?? Date.now();
    captureMessage("Mock interview user stop speaking", {
      route: "/mock-interview/[sessionId]",
      session_id: sessionId,
      ...(jobId ? { job_id: jobId } : {}),
      tags: { feature: "ai_interview", provider_path: providerPathRef.current, detection_source: "local_ptt" },
    });
    turnCommittedAtRef.current = Date.now();
    captureMessage("Mock interview turn committed", {
      route: "/mock-interview/[sessionId]",
      session_id: sessionId,
      ...(jobId ? { job_id: jobId } : {}),
      tags: { feature: "ai_interview", provider_path: providerPathRef.current },
      extra: { user_stop_to_commit_ms: speechStoppedAtRef.current ? Date.now() - speechStoppedAtRef.current : null },
    });
    if (!sendRealtimeEvent({ type: "input_audio_buffer.commit" })) {
      setProviderError(ui.interviewProviderError);
      return;
    }
    requestAssistantResponse("voice_turn");
  }, [enqueueSilenceCue, isListening, jobId, requestAssistantResponse, sendRealtimeEvent, sessionId, ui.interviewProviderError]);

  const toggleListen = useCallback(() => {
    if (pendingRemoteAudioPlaybackRef.current && audioRef.current?.srcObject) {
      void playRemoteAudio("listen_toggle_retry");
    }
    if (isListening) stopListeningAndCommit();
    else startListening();
  }, [isListening, playRemoteAudio, startListening, stopListeningAndCommit]);

  useEffect(() => {
    if (!isListening) return;

    const interval = window.setInterval(() => {
      const now = Date.now();

      if (heardSpeechThisTurnRef.current && lastLocalSpeechAtRef.current) {
        const silenceForMs = now - lastLocalSpeechAtRef.current;
        if (silenceForMs >= LOCAL_SPEECH_END_COMMIT_DELAY_MS) {
          stopListeningAndCommit();
        }
        return;
      }

      if (!heardSpeechThisTurnRef.current && turnCommittedAtRef.current) {
        return;
      }

      const listeningStartedAt = listeningStartedAtRef.current ?? now;
      if (now - listeningStartedAt >= LOCAL_LISTENING_IDLE_TIMEOUT_MS) {
        stopListeningAndCommit();
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [isListening, stopListeningAndCommit]);

  useEffect(() => {
    if (!showEndConfirm) return;
    endDialogContinueRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setShowEndConfirm(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showEndConfirm]);

  const handleEndInterview = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    endedRef.current = true;
    setShowEndConfirm(false);
    releaseRealtimeResources();
    setAiMessage(copy.farewell);
    setStep("goodbye");
    await new Promise((resolve) => window.setTimeout(resolve, 200));
    await doEvaluateAndRedirect();
  }, [copy.farewell, doEvaluateAndRedirect, releaseRealtimeResources]);

  useEffect(() => () => { endedRef.current = true; releaseRealtimeResources(); }, [releaseRealtimeResources]);

  const agentState: AgentState =
    isListening
      ? "listening"
      : step === "interview" && (isAiResponding || (transcript.length === 0 && aiMessage === copy.preparing))
        ? "thinking"
        : isAiSpeaking
          ? "talking"
          : null;
  const orbAnimate =
    reduceMotion || step !== "interview"
      ? { scale: 1, opacity: 1 }
      : agentState === "listening"
        ? { scale: 1 + (micLevel / 100) * 0.12, opacity: 1 }
        : agentState === "thinking"
          ? { scale: [1, 1.06, 1], opacity: [0.88, 1, 0.92] }
          : agentState === "talking"
            ? { scale: [1, 1.09, 1.04, 1], opacity: 1 }
            : { scale: [1, 1.025, 1], opacity: [0.96, 1, 0.98] };
  const orbTransition =
    reduceMotion
      ? { duration: 0 }
      : agentState === "listening"
        ? { duration: 0.12, ease: "easeOut" as const }
        : { duration: agentState === "talking" ? 0.78 : 1.45, repeat: step === "interview" && (agentState === null || agentState === "thinking" || agentState === "talking") ? Infinity : 0, ease: "easeInOut" as const };
  const micDisabled = step === "goodbye" || ((!isSessionReady || isAiResponding || isAiSpeaking) && !isListening);
  const statusText =
    step === "goodbye"
      ? ui.statusWrapping
      : voiceConnectionState === "connecting"
        ? voiceConnectingLabel
        : voiceConnectionState === "retrying"
          ? voiceRetryingLabel
          : isAiResponding || isAiSpeaking
            ? ui.statusWaitNova
            : isListening
              ? ui.statusListening
              : ui.statusClickToRespond;
  const voiceIssueText = voiceConnectionState === "degraded" ? voiceConnectionIssue ?? voicePlaybackIssueLabel : null;

  if (step === "mic-test") {
    return (
      <main className="mx-auto max-w-md px-4 py-6">
        <audio ref={audioRef} autoPlay playsInline className="hidden" aria-hidden="true" />
        <div className="rounded-2xl border border-[var(--border)] bg-[#FAFAF9] p-6 shadow-sm dark:border-white/[0.08] dark:bg-zinc-900">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: "var(--primary-muted)" }}>
            <Microphone className="h-8 w-8" style={{ color: "var(--primary-dark)" }} weight="regular" aria-hidden />
          </div>
          <h2 className="text-center text-xl font-semibold text-[#111111] dark:text-zinc-100">{ui.testMicTitle}</h2>
          <p className="mt-3 text-center text-sm text-[#111111]/65 dark:text-zinc-400">{ui.testMicHint}</p>
          <div className="mt-6 h-3 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div className="h-full rounded-full transition-all" style={{ width: `${micLevel}%`, backgroundColor: "var(--primary)" }} />
          </div>
          {providerError && <p className="mt-4 text-center text-sm text-amber-800 dark:text-amber-200">{providerError}</p>}
          {micError && <p className="mt-4 text-center text-sm text-red-600 dark:text-red-400">{micError}</p>}
          {micStream && !micError && <p className="mt-4 text-center text-sm text-green-700 dark:text-green-400">{ui.micWorking}</p>}
          <button type="button" onClick={() => { void startInterview(); }} disabled={!micStream || !!micError || isConnectingSession} className="mt-6 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "var(--primary)" }}>
            {ui.continue}
          </button>
        </div>
      </main>
    );
  }

  if (step === "processing") {
    return <MockInterviewProcessingSkeleton title={ui.processing} subtitle={ui.processingSubtitle} />;
  }

  return (
    <main className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col overflow-hidden px-4 py-3">
      <audio ref={audioRef} autoPlay playsInline className="hidden" aria-hidden="true" />
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4" role="presentation" onClick={() => setShowEndConfirm(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="end-interview-dialog-title" onClick={(event) => event.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-[#E8E8E6] bg-[#FAFAF9] p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-950/40">
              <PhoneDisconnect className="h-6 w-6 text-red-600 dark:text-red-400" weight="regular" aria-hidden />
            </div>
            <h3 id="end-interview-dialog-title" className="text-center text-lg font-semibold text-[#111111] dark:text-zinc-100">{ui.endInterviewTitle}</h3>
            <p className="mt-2 text-center text-sm text-[#111111]/65 dark:text-zinc-400">{ui.endInterviewBody}</p>
            <div className="mt-6 flex gap-3">
              <button ref={endDialogContinueRef} type="button" onClick={() => setShowEndConfirm(false)} className="min-h-11 flex-1 rounded-xl border border-[#E8E8E6] px-4 py-2.5 text-sm dark:border-zinc-700">
                {ui.continueInterview}
              </button>
              <button type="button" onClick={() => { void handleEndInterview(); }} className="min-h-11 flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white">
                {ui.endEvaluate}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="truncate text-base font-semibold text-[#111111] sm:text-lg dark:text-zinc-100">{`${jobCategory} ${ui.interviewSuffix}`}</h2>
        {step !== "goodbye" && (
          <button type="button" onClick={() => setShowEndConfirm(true)} className="flex min-h-11 items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:text-red-400">
            <PhoneDisconnect className="h-4 w-4" weight="regular" aria-hidden />
            {ui.end}
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
        <motion.div className="relative flex items-center justify-center" style={{ width: "min(70vw, 420px)", height: "min(70vw, 420px)" }} animate={orbAnimate} transition={orbTransition}>
          <Orb agentState={agentState} colors={["#E8D078", "#D4B84A"]} className="h-full w-full" />
        </motion.div>
        <motion.p key={aiMessage} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.25 }} className="-mt-8 min-h-[92px] w-full max-w-[560px] rounded-3xl border border-black/10 bg-white/50 px-5 py-4 text-center text-base font-medium leading-relaxed text-zinc-800 shadow-lg backdrop-blur-2xl dark:border-white/20 dark:bg-zinc-900/40 dark:text-zinc-100">
          {aiMessage}
        </motion.p>
      </div>

      <div className="flex flex-col items-center gap-3 pb-2">
        <button type="button" onClick={toggleListen} disabled={micDisabled} aria-pressed={isListening} aria-label={isListening ? ui.micAriaStopListening : ui.micAriaStartListening} className={`flex h-14 w-14 items-center justify-center rounded-full text-white disabled:opacity-50 ${isListening ? "bg-red-600" : ""}`} style={!isListening ? { backgroundColor: "var(--primary)" } : {}}>
          {isListening ? <MicrophoneSlash className="h-6 w-6" weight="regular" aria-hidden /> : <Microphone className="h-6 w-6" weight="regular" aria-hidden />}
        </button>
        <p className="text-center text-sm text-[#111111]/60 dark:text-zinc-400">{statusText}</p>
        {voiceIssueText && step === "interview" && <p className="max-w-md text-center text-sm text-amber-900 dark:text-amber-200">{voiceIssueText}</p>}
        {providerError && step === "interview" && <p className="max-w-md text-center text-sm text-amber-900 dark:text-amber-200">{providerError}</p>}
      </div>
    </main>
  );
}
