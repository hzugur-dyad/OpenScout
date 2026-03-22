"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Microphone, MicrophoneSlash, PhoneDisconnect } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { useTTS } from "@/hooks/useTTS";
import { createClient } from "@/lib/supabase/client";
import { Orb, type AgentState } from "@/components/ui/orb";
import {
  interviewCopy,
  interviewUi,
  parseInterviewLocale,
  interviewLocaleConfig,
  type InterviewLocale,
} from "@/lib/interview-locale";
import { MockInterviewProcessingSkeleton } from "@/components/ui/Skeleton";
import { ANALYTICS_EVENTS, trackClient } from "@/lib/analytics";
import { captureException, captureMessage } from "@/lib/monitoring";

type InterviewControl = {
  questionId: string;
  attempt: number;
  isFollowup: boolean;
};

export default function MockInterviewSessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const jobCategory = searchParams.get("category") || "Frontend Developer";
  const jobId = searchParams.get("jobId") || "";
  const cvScoreParam = searchParams.get("cvScore");
  const cvScoreForApplication = cvScoreParam !== null && cvScoreParam !== "" ? Number(cvScoreParam) : null;
  const locale: InterviewLocale = parseInterviewLocale(searchParams.get("lang"));
  const ui = interviewUi[locale];
  const copy = interviewCopy[locale];

  const [step, setStep] = useState<"mic-test" | "interview" | "goodbye" | "processing">("mic-test");
  const [micOk, setMicOk] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [transcript, setTranscript] = useState<Array<{ role: string; content: string }>>([]);
  const [aiMessage, setAiMessage] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [userName, setUserName] = useState("Candidate");

  const recognitionRef = useRef<{ start: () => void; stop: () => void; abort: () => void } | null>(null);
  const endedRef = useRef(false); // true when user ended interview or left page → skip recognition callbacks
  const ttsStopRef = useRef<(() => void) | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const interviewStartTimeRef = useRef<number | null>(null);
  const micAnalyserRef = useRef<{ analyser: AnalyserNode; ctx: AudioContext } | null>(null);
  const micAnimationRef = useRef<number | null>(null);
  const responseLimitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlStateRef = useRef<InterviewControl | null>(null);
  const RESPONSE_LIMIT_MS = 30_000;
  const [providerError, setProviderError] = useState<string | null>(null);

  const tts = useTTS();
  ttsStopRef.current = tts.stop;
  micStreamRef.current = micStream;
  const isAiSpeaking = tts.loading;
  const supabase = useMemo(() => createClient(), []);

  // Orb agentState: microphone → listening, waiting for AI → thinking, TTS → talking, default → null
  const agentState: AgentState = (() => {
    if (isListening) return "listening";
    const waitingForAi =
      step === "interview" &&
      transcript.length > 0 &&
      transcript[transcript.length - 1]?.role === "user";
    const initializing = step === "interview" && transcript.length === 0 && aiMessage === copy.preparing;
    if (waitingForAi || initializing) return "thinking";
    if (isAiSpeaking) return "talking";
    return null;
  })();

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
    setMicError(null);
    let active = true;
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => {
        if (!active) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        setMicStream(s);
        setMicError(null);
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(s);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        micAnalyserRef.current = { analyser, ctx };
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateLevel = () => {
          if (!micAnalyserRef.current) return;
          const { analyser: a } = micAnalyserRef.current;
          a.getByteFrequencyData(dataArray);
          const sum = dataArray.reduce((acc, v) => acc + v, 0);
          const avg = sum / dataArray.length;
          setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
          micAnimationRef.current = requestAnimationFrame(updateLevel);
        };
        micAnimationRef.current = requestAnimationFrame(updateLevel);
      })
      .catch((err: DOMException | Error) => {
        setMicError(err.message || copy.micDenied);
        setMicStream(null);
        if (err instanceof DOMException && err.name === "NotAllowedError") {
          captureMessage("Microphone permission denied (mock interview)", {
            route: "/mock-interview/[sessionId]",
            session_id: sessionId,
            ...(jobId ? { job_id: jobId } : {}),
            tags: { feature: "ai_interview", mic: "permission_denied" },
            level: "warning",
          });
        } else if (!(err instanceof DOMException && err.name === "AbortError")) {
          captureException(err, {
            route: "/mock-interview/[sessionId]",
            session_id: sessionId,
            ...(jobId ? { job_id: jobId } : {}),
            tags: { feature: "ai_interview", mic: "getUserMedia" },
          });
        }
      });

    return () => {
      active = false;
      if (micAnimationRef.current) cancelAnimationFrame(micAnimationRef.current);
      if (micAnalyserRef.current) {
        micAnalyserRef.current.ctx.close().catch(() => {});
        micAnalyserRef.current = null;
      }
      stream?.getTracks().forEach((t) => t.stop());
      setMicStream(null);
      setMicLevel(0);
    };
  }, [step, sessionId, jobId, copy.micDenied]);

  const sendToAI = useCallback(
    async (userMessage: string) => {
      if (responseLimitTimerRef.current) {
        clearTimeout(responseLimitTimerRef.current);
        responseLimitTimerRef.current = null;
      }

      const newMessages = [
        ...transcript.map((t) => ({ role: t.role as "user" | "assistant", content: t.content })),
        { role: "user" as const, content: userMessage },
      ];
      setTranscript((t) => [...t, { role: "user", content: userMessage }]);

      const res = await fetch("/api/mock-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          jobCategory,
          userName,
          interviewLanguage: locale,
          interviewControl: controlStateRef.current
            ? {
                questionId: controlStateRef.current.questionId,
                attemptCount: controlStateRef.current.attempt,
              }
            : undefined,
          ...(jobId && { jobId }),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        content?: string;
        interviewEnded?: boolean;
        questionControl?: { questionId?: string; attempt?: number; isFollowup?: boolean };
        retryable?: boolean;
      };
      if (res.status === 503 && data.retryable) {
        setTranscript((t) =>
          t.length > 0 && t[t.length - 1]?.role === "user" ? t.slice(0, -1) : t
        );
        setProviderError(ui.interviewProviderError);
        return;
      }
      setProviderError(null);
      if (!res.ok) {
        captureMessage(`Mock interview turn: HTTP ${res.status}`, {
          route: "/api/mock-interview",
          session_id: sessionId,
          ...(jobId ? { job_id: jobId } : {}),
          tags: { feature: "ai_interview" },
          level: "warning",
        });
      }
      const visibleText = (data.content ?? "").trim();
      const interviewEnded = Boolean(data.interviewEnded);

      if (interviewEnded) {
        controlStateRef.current = null;
      } else if (data.questionControl && typeof data.questionControl.questionId === "string") {
        controlStateRef.current = {
          questionId: data.questionControl.questionId,
          attempt: Math.min(2, Math.max(1, Number(data.questionControl.attempt) || 1)),
          isFollowup: Boolean(data.questionControl.isFollowup),
        };
      } else {
        controlStateRef.current = null;
      }

      setTranscript((t) => [...t, { role: "assistant", content: visibleText }]);
      setAiMessage(visibleText);

      if (interviewEnded) {
        setStep("processing");
        const durationMs = interviewStartTimeRef.current ? Date.now() - interviewStartTimeRef.current : 0;
        const minMs = 5 * 60 * 1000;
        if (durationMs < minMs) {
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
        const transcriptText = [...transcript, { role: "user", content: userMessage }]
          .concat([{ role: "assistant", content: visibleText }])
          .map((m) => `${m.role}: ${m.content}`)
          .join("\n");
        const resultRes = await fetch("/api/mock-interview/result", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            transcript: transcriptText,
            jobCategory,
            interviewLanguage: locale,
            durationMs,
            ...(jobId && { jobId }),
          }),
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
        return;
      }

      responseLimitTimerRef.current = setTimeout(() => {
        responseLimitTimerRef.current = null;
        sendToAI(copy.noResponseCue);
      }, RESPONSE_LIMIT_MS);

      tts.play(visibleText, locale);
    },
    [transcript, jobCategory, sessionId, jobId, cvScoreForApplication, router, tts.play, userName, locale, copy.noResponseCue, ui.interviewProviderError]
  );

  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef("");
  const endingRef = useRef(false);

  useEffect(() => {
    if (step !== "interview") return;
    const SpeechRecognitionAPI = (typeof window !== "undefined" && ((window as unknown as { SpeechRecognition?: new () => unknown }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition));
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI() as {
      start: () => void; stop: () => void; abort: () => void;
      continuous: boolean; interimResults: boolean; lang: string;
      onresult: ((e: unknown) => void) | null;
      onerror: ((e: unknown) => void) | null;
      onend: (() => void) | null;
    };
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = interviewLocaleConfig[locale].speechRecognitionLang;

    const SILENCE_TIMEOUT_MS = 2500;

    const resetSilenceTimer = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        // User stopped speaking for 2.5 seconds, finalize
        recognition.stop();
      }, SILENCE_TIMEOUT_MS);
    };

    recognition.onresult = (event: unknown) => {
      const e = event as { results: { [index: number]: { [index: number]: { transcript: string }; isFinal: boolean }; length: number } };
      let full = "";
      for (let i = 0; i < e.results.length; i++) {
        full += e.results[i][0].transcript;
      }
      finalTranscriptRef.current = full.trim();
      resetSilenceTimer();
    };

    recognition.onerror = ((event?: unknown) => {
      if (endedRef.current) return;
      const err = (event ?? {}) as { error?: string };
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (err.error === "no-speech" || err.error === "audio-capture") {
        sendToAI(copy.notHeardCue);
      }
      setIsListening(false);
    }) as (e: unknown) => void;

    recognition.onend = () => {
      if (endedRef.current) return;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      const text = finalTranscriptRef.current;
      finalTranscriptRef.current = "";
      if (text) {
        sendToAI(text);
      } else {
        sendToAI(copy.notHeardCue);
      }
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      recognition.abort();
    };
  }, [step, sendToAI, locale, copy.notHeardCue]);

  const startInterview = useCallback(async () => {
    endedRef.current = false;
    interviewStartTimeRef.current = Date.now();
    trackClient(ANALYTICS_EVENTS.interview_started, {
      job_category: jobCategory,
      session_id: sessionId,
      ...(jobId ? { job_id: jobId } : {}),
    });
    setStep("interview");
    setAiMessage(copy.preparing);
    const res = await fetch("/api/mock-interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: copy.readyPhrase }],
        jobCategory,
        userName,
        interviewLanguage: locale,
        interviewControl: undefined,
        ...(jobId && { jobId }),
      }),
    });
    if (!res.ok) {
      captureMessage(`Mock interview start: HTTP ${res.status}`, {
        route: "/api/mock-interview",
        session_id: sessionId,
        ...(jobId ? { job_id: jobId } : {}),
        tags: { feature: "ai_interview" },
        level: "warning",
      });
    }
    const data = await res.json();
    const visibleText = (data.content ?? "").trim() || copy.fallbackOpening;
    if (data.interviewEnded) {
      controlStateRef.current = null;
    } else if (data.questionControl && typeof data.questionControl.questionId === "string") {
      controlStateRef.current = {
        questionId: data.questionControl.questionId,
        attempt: Math.min(2, Math.max(1, Number(data.questionControl.attempt) || 1)),
        isFollowup: Boolean(data.questionControl.isFollowup),
      };
    } else {
      controlStateRef.current = null;
    }
    const content = visibleText;
    setAiMessage(content);
    setTranscript([{ role: "assistant", content }]);

    responseLimitTimerRef.current = setTimeout(() => {
      responseLimitTimerRef.current = null;
      sendToAI(copy.noResponseCue);
    }, RESPONSE_LIMIT_MS);

    tts.play(content, locale);
  }, [
    jobCategory,
    jobId,
    sessionId,
    tts.play,
    userName,
    sendToAI,
    locale,
    copy.preparing,
    copy.readyPhrase,
    copy.fallbackOpening,
    copy.noResponseCue,
    ui.interviewProviderError,
  ]);

  const toggleListen = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const MIN_INTERVIEW_MS = 5 * 60 * 1000;
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const releaseMicrophoneResources = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setIsListening(false);
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (micAnimationRef.current) {
      cancelAnimationFrame(micAnimationRef.current);
      micAnimationRef.current = null;
    }
    if (micAnalyserRef.current) {
      micAnalyserRef.current.ctx.close().catch(() => {});
      micAnalyserRef.current = null;
    }
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    setMicStream(null);
    setMicLevel(0);
  }, []);

  const doEvaluateAndRedirect = useCallback(async () => {
    setStep("processing");
    const durationMs = interviewStartTimeRef.current ? Date.now() - interviewStartTimeRef.current : 0;
    const tooShort = durationMs < MIN_INTERVIEW_MS;

    if (tooShort) {
      trackClient(ANALYTICS_EVENTS.interview_too_short, {
        job_category: jobCategory,
        session_id: sessionId,
        duration_ms: durationMs,
        ...(jobId ? { job_id: jobId } : {}),
      });
      const q = new URLSearchParams({
        tooShort: "1",
        score: "0",
        strengths: "[]",
        improvements: "[]",
        category: jobCategory,
        lang: locale,
      });
      if (cvScoreForApplication != null) q.set("cvScore", String(cvScoreForApplication));
      router.push(`/mock-interview/${sessionId}/result?${q.toString()}`);
      return;
    }

    try {
      const transcriptText = transcript
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n");
      const durationMs = interviewStartTimeRef.current ? Date.now() - interviewStartTimeRef.current : 0;
      const resultRes = await fetch("/api/mock-interview/result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          transcript: transcriptText || "No conversation recorded.",
          jobCategory,
          interviewLanguage: locale,
          durationMs,
          ...(jobId && { jobId }),
        }),
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
    } catch (e) {
      captureException(e, {
        route: "/api/mock-interview/result",
        session_id: sessionId,
        ...(jobId ? { job_id: jobId } : {}),
      });
      router.push(`/mock-interview/${sessionId}/result?error=1&lang=${encodeURIComponent(locale)}`);
    }
  }, [transcript, jobCategory, sessionId, jobId, cvScoreForApplication, router, locale]);

  const handleEndInterview = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    endedRef.current = true;
    releaseMicrophoneResources();
    tts.stop();
    if (responseLimitTimerRef.current) {
      clearTimeout(responseLimitTimerRef.current);
      responseLimitTimerRef.current = null;
    }
    setShowEndConfirm(false);

    const farewellMessage = copy.farewell;
    setAiMessage(farewellMessage);
    setStep("goodbye");
    await tts.play(farewellMessage, locale);
    await doEvaluateAndRedirect();
  }, [releaseMicrophoneResources, tts, doEvaluateAndRedirect, copy.farewell, locale]);

  // On unmount or when leaving the page: release mic, stop TTS, abort recognition
  useEffect(() => {
    return () => {
      endedRef.current = true;
      releaseMicrophoneResources();
      ttsStopRef.current?.();
      if (responseLimitTimerRef.current) {
        clearTimeout(responseLimitTimerRef.current);
        responseLimitTimerRef.current = null;
      }
    };
  }, [releaseMicrophoneResources]);

  if (step === "mic-test") {
    return (
      <div className="mx-auto max-w-md">
        <div className="rounded-[10px] border border-[var(--border)] bg-white p-8 shadow-card dark:border-white/[0.06] dark:bg-zinc-900">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--primary-muted)" }}
          >
            <Microphone className="h-8 w-8" style={{ color: "var(--primary-dark)" }} weight="regular" aria-hidden />
          </div>
          <h2 className="text-center text-xl font-bold text-gray-900 dark:text-zinc-100">{ui.testMicTitle}</h2>
          <p className="mt-2 text-center text-sm text-gray-500 dark:text-zinc-400">
            {ui.testMicHint}
          </p>
          <div className="mt-6 h-4 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-zinc-700">
            <div
              className="h-full rounded-full transition-all duration-150"
              style={{
                width: `${micLevel}%`,
                backgroundColor: "var(--primary)",
              }}
            />
          </div>
          {providerError && (
            <p className="mt-4 text-center text-sm text-amber-800 dark:text-amber-200">{providerError}</p>
          )}
          {micError && (
            <p className="mt-4 text-center text-sm text-red-600 dark:text-red-400">{micError}</p>
          )}
          {micStream && !micError && (
            <p className="mt-4 text-center text-sm text-green-600 dark:text-green-400">
              {ui.micWorking}
            </p>
          )}
          <button
            onClick={() => {
              setMicOk(true);
              startInterview();
            }}
            disabled={!micStream || !!micError}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-[10px] px-4 py-3 text-white disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: "var(--primary)" }}
          >
            {ui.continue}
          </button>
        </div>
      </div>
    );
  }

  if (step === "processing") {
    return (
      <MockInterviewProcessingSkeleton title={ui.processing} subtitle={ui.processingSubtitle} />
    );
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col overflow-hidden px-4 py-2">
      {/* End confirmation modal */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:border dark:border-white/[0.06] dark:bg-zinc-900"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mx-auto dark:bg-red-950/50">
              <PhoneDisconnect className="h-6 w-6 text-red-600 dark:text-red-400" weight="regular" aria-hidden />
            </div>
            <h3 className="text-center text-lg font-semibold text-gray-900 dark:text-zinc-100">{ui.endInterviewTitle}</h3>
            <p className="mt-2 text-center text-sm text-gray-500 dark:text-zinc-400">
              {ui.endInterviewBody}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {ui.continueInterview}
              </button>
              <button
                onClick={handleEndInterview}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
              >
                {ui.endEvaluate}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="mb-1 flex shrink-0 items-center justify-between">
        <h2 className="font-semibold text-gray-900 dark:text-zinc-100">
          {`${jobCategory} ${ui.interviewSuffix}`}
        </h2>
        {step !== "goodbye" && (
          <button
            onClick={() => setShowEndConfirm(true)}
            className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <PhoneDisconnect className="h-4 w-4" weight="regular" aria-hidden />
            {ui.end}
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-[10px] border border-[var(--border)] bg-white p-3 shadow-card dark:border-white/[0.06] dark:bg-zinc-900 sm:p-4">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 sm:gap-2">
          {/* Orb — tek ekrana sığacak (vmin ile sınırlı) */}
          <motion.div
            className="relative flex shrink-0 items-center justify-center"
            style={{
              clipPath: "circle(50% at 50% 50%)",
              overflow: "hidden",
              width: "min(380px, 48vmin)",
              height: "min(380px, 48vmin)",
            }}
            animate={
              step !== "interview"
                ? { scale: 1, opacity: 1 }
                : agentState === "listening"
                  ? { scale: 1 + (micLevel / 100) * 0.12, opacity: 1 }
                  : agentState === "thinking"
                    ? { scale: [1, 1.06, 1], opacity: [0.88, 1, 0.92] }
                    : agentState === "talking"
                      ? { scale: [1, 1.09, 1.04, 1], opacity: 1 }
                      : { scale: [1, 1.025, 1], opacity: [0.96, 1, 0.98] }
            }
            transition={
              agentState === "listening"
                ? { duration: 0.12, ease: "easeOut" }
                : {
                    duration: agentState === "talking" ? 0.78 : 1.45,
                    repeat:
                      step === "interview" &&
                      (agentState === null ||
                        agentState === "thinking" ||
                        agentState === "talking")
                        ? Infinity
                        : 0,
                    ease: "easeInOut",
                  }
            }
          >
            <Orb agentState={agentState} colors={["#FFE066", "#FFCB05"]} className="relative z-10 h-full w-full" />
          </motion.div>

          <motion.div
            key={aiMessage}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="w-full max-w-[600px] shrink-0"
          >
            <p className="rounded-2xl border border-[var(--border)] bg-gray-50/60 px-5 py-3 text-center text-base font-medium leading-relaxed tracking-tight text-gray-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">
              {aiMessage}
            </p>
          </motion.div>

          {/* Mic button */}
          <div className="relative mt-1 flex h-12 w-12 shrink-0 items-center justify-center sm:h-14 sm:w-14">
            {step !== "goodbye" && isListening && (
              <>
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-[var(--primary)]"
                  style={{ borderColor: "var(--primary)" }}
                  initial={{ scale: 1, opacity: 0.4 }}
                  animate={{ scale: [1, 1.5, 1.6], opacity: [0.4, 0.15, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
                />
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-[var(--primary)]"
                  style={{ borderColor: "var(--primary)" }}
                  initial={{ scale: 1, opacity: 0.3 }}
                  animate={{ scale: [1, 1.5, 1.6], opacity: [0.3, 0.1, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
                />
              </>
            )}
            <button
              onClick={toggleListen}
              disabled={isAiSpeaking || step === "goodbye"}
              className={`relative flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200 sm:h-14 sm:w-14 ${
                isListening ? "bg-red-500 text-white shadow-lg shadow-red-200 dark:shadow-red-900/30" : "text-white"
              } disabled:cursor-not-allowed disabled:opacity-50`}
              style={!isListening ? { backgroundColor: "var(--primary)" } : {}}
            >
              {isListening ? (
                <MicrophoneSlash className="h-6 w-6 sm:h-7 sm:w-7" weight="regular" aria-hidden />
              ) : (
                <Microphone className="h-6 w-6 sm:h-7 sm:w-7" weight="regular" aria-hidden />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-400 sm:text-sm">
            {step === "goodbye"
              ? ui.statusWrapping
              : isAiSpeaking
                ? ui.statusWaitNova
                : isListening
                  ? ui.statusListening
                  : ui.statusClickToRespond}
          </p>
          {providerError && step === "interview" && (
            <p className="mt-2 max-w-md text-center text-xs text-amber-800 dark:text-amber-200 sm:text-sm">
              {providerError}
            </p>
          )}
          {tts.error && (
            <p className="mt-1 max-w-md text-center text-xs text-red-600 dark:text-red-400 sm:text-sm">
              {ui.voiceErrorPrefix}: {tts.error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
