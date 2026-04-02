"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Microphone, MicrophoneSlash, PhoneDisconnect } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "framer-motion";
import { useTTS, type TtsPlaybackResult } from "@/hooks/useTTS";
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
import { mapMicrophoneError } from "@/lib/user-facing-errors";

type InterviewControl = {
  questionId: string;
  attempt: number;
  isFollowup: boolean;
};

type RecognitionStopReason = "none" | "assistant" | "manual" | "teardown" | "silence-finalize";
type InterviewTurnPhase =
  | "idle"
  | "waiting_for_answer_start"
  | "user_speaking"
  | "user_answer_complete"
  | "nova_processing";
type CurrentQuestionState = {
  promptText: string;
  questionId: string | null;
  attempt: number;
  hasRepeatedCurrentQuestion: boolean;
  questionUnanswered: boolean;
  answerStartedForCurrentQuestion: boolean;
};

function mapInterviewStateToOrb(params: {
  step: "mic-test" | "interview" | "goodbye" | "processing";
  isListening: boolean;
  isAiPlaying: boolean;
  turnPhase: InterviewTurnPhase;
}): AgentState {
  const { step, isListening, isAiPlaying, turnPhase } = params;
  if (step !== "interview") return null;
  if (isListening) return "listening";
  if (isAiPlaying) return "speaking";
  if (turnPhase === "nova_processing" || turnPhase === "user_answer_complete") {
    return "thinking";
  }
  return null;
}

export default function MockInterviewSessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const jobCategory = searchParams.get("category") || "Frontend Developer";
  const jobId = searchParams.get("jobId") || "";
  const locale: InterviewLocale = parseInterviewLocale(searchParams.get("lang"));
  const ui = interviewUi.en;
  const copy = interviewCopy[locale];

  const [step, setStep] = useState<"mic-test" | "interview" | "goodbye" | "processing">("mic-test");
  const [micError, setMicError] = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [transcript, setTranscript] = useState<Array<{ role: string; content: string }>>([]);
  const [aiMessage, setAiMessage] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [turnPhase, setTurnPhase] = useState<InterviewTurnPhase>("idle");
  const [userName, setUserName] = useState("Candidate");

  const recognitionRef = useRef<{ start: () => void; stop: () => void; abort: () => void } | null>(null);
  const endedRef = useRef(false); // true when user ended interview or left page → skip recognition callbacks
  const ttsStopRef = useRef<(() => void) | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const interviewStartTimeRef = useRef<number | null>(null);
  const stepRef = useRef(step);
  const turnPhaseRef = useRef(turnPhase);
  const micAnalyserRef = useRef<{ analyser: AnalyserNode; ctx: AudioContext } | null>(null);
  const micAnimationRef = useRef<number | null>(null);
  const answerStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userSilenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlStateRef = useRef<InterviewControl | null>(null);
  const autoStartListeningRef = useRef(false);
  const listeningResumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assistantPlaybackTokenRef = useRef(0);
  const sendInFlightRef = useRef(false);
  const lastSendAtRef = useRef(0);
  const lastUserMessageSentRef = useRef("");
  const retryAfterUntilRef = useRef(0);
  const ANSWER_START_TIMEOUT_MS = 7_000;
  const USER_SILENCE_TIMEOUT_MS = 4_000;
  const PLAYBACK_TO_LISTEN_DELAY_MS = 120;
  const AUTO_LISTEN_RETRY_MS = 160;
  const AUTO_LISTEN_MAX_RETRIES = 4;
  const [providerError, setProviderError] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  const endDialogContinueRef = useRef<HTMLButtonElement>(null);
  const currentQuestionRef = useRef<CurrentQuestionState>({
    promptText: "",
    questionId: null,
    attempt: 1,
    hasRepeatedCurrentQuestion: false,
    questionUnanswered: false,
    answerStartedForCurrentQuestion: false,
  });
  const repeatCurrentQuestionRef = useRef<(() => void) | null>(null);
  const advanceAfterNoResponseRef = useRef<(() => void) | null>(null);

  const tts = useTTS();
  ttsStopRef.current = tts.stop;
  micStreamRef.current = micStream;
  const playTts = tts.play;
  const isAiBusy = tts.loading;
  const isAiPlaying = tts.isPlaying;
  const supabase = useMemo(() => createClient(), []);
  const getInterviewErrorMessage = useCallback(
    (status: number) => (status === 429 ? ui.interviewRateLimitError : ui.interviewProviderError),
    [ui.interviewProviderError, ui.interviewRateLimitError]
  );
  const parseRetryAfterMs = useCallback((value: string | null): number => {
    if (!value) return 0;
    const sec = Number(value);
    if (Number.isFinite(sec) && sec > 0) return Math.max(0, Math.floor(sec * 1000));
    const dateMs = Date.parse(value);
    if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());
    return 0;
  }, []);

  const clearListeningResumeTimer = useCallback(() => {
    if (listeningResumeTimerRef.current) {
      clearTimeout(listeningResumeTimerRef.current);
      listeningResumeTimerRef.current = null;
    }
  }, []);

  const clearAnswerStartTimer = useCallback(() => {
    if (answerStartTimerRef.current) {
      clearTimeout(answerStartTimerRef.current);
      answerStartTimerRef.current = null;
    }
  }, []);

  const clearUserSilenceTimer = useCallback(() => {
    if (userSilenceTimerRef.current) {
      clearTimeout(userSilenceTimerRef.current);
      userSilenceTimerRef.current = null;
    }
  }, []);

  const clearTurnTimers = useCallback(() => {
    clearAnswerStartTimer();
    clearUserSilenceTimer();
  }, [clearAnswerStartTimer, clearUserSilenceTimer]);

  const setTurnPhaseValue = useCallback((next: InterviewTurnPhase) => {
    turnPhaseRef.current = next;
    setTurnPhase(next);
  }, []);

  const resetCurrentQuestionTracking = useCallback(
    (
      promptText: string,
      questionControl?: { questionId?: string; attempt?: number } | null
    ) => {
      currentQuestionRef.current = {
        promptText: promptText.trim(),
        questionId:
          questionControl && typeof questionControl.questionId === "string"
            ? questionControl.questionId
            : null,
        attempt: Math.max(1, Math.min(2, Number(questionControl?.attempt) || 1)),
        hasRepeatedCurrentQuestion: false,
        questionUnanswered: false,
        answerStartedForCurrentQuestion: false,
      };
    },
    []
  );

  const resetCurrentQuestionState = useCallback(() => {
    resetCurrentQuestionTracking("", null);
  }, [resetCurrentQuestionTracking]);

  const setListeningState = useCallback(
    (next: boolean) => {
      if (!next) {
        clearTurnTimers();
      }
      isListeningRef.current = next;
      setIsListening(next);
    },
    [clearTurnTimers]
  );

  const stopListeningSession = useCallback(
    (reason: RecognitionStopReason, options?: { resetListeningState?: boolean }) => {
      if (options?.resetListeningState !== false) {
        setListeningState(false);
      } else {
        clearTurnTimers();
      }
      recognitionStopReasonRef.current = reason;
      try {
        recognitionRef.current?.stop();
      } catch {
        // Ignore redundant stop requests from browser speech recognition.
      }
      return true;
    },
    [clearTurnTimers, setListeningState]
  );

  const finalizeUserTurn = useCallback(
    (reason: "manual" | "silence-finalize") => {
      if (!isListeningRef.current) return false;
      if (!currentQuestionRef.current.answerStartedForCurrentQuestion) return false;
      setTurnPhaseValue("user_answer_complete");
      stopListeningSession(reason, { resetListeningState: false });
      return true;
    },
    [setTurnPhaseValue, stopListeningSession]
  );

  const armUserSilenceTimer = useCallback(
    (sessionToken: number) => {
      if (!isListeningRef.current) return;
      if (sessionToken !== activeListeningSessionRef.current) return;
      if (!currentQuestionRef.current.answerStartedForCurrentQuestion) return;
      clearUserSilenceTimer();
      userSilenceTimerRef.current = setTimeout(() => {
        if (!isListeningRef.current) return;
        if (sessionToken !== activeListeningSessionRef.current) return;
        if (!currentQuestionRef.current.answerStartedForCurrentQuestion) return;
        finalizeUserTurn("silence-finalize");
      }, USER_SILENCE_TIMEOUT_MS);
    },
    [USER_SILENCE_TIMEOUT_MS, clearUserSilenceTimer, finalizeUserTurn]
  );

  const armAnswerStartTimer = useCallback(
    (sessionToken: number) => {
      clearAnswerStartTimer();
      answerStartTimerRef.current = setTimeout(() => {
        if (!isListeningRef.current) return;
        if (sessionToken !== activeListeningSessionRef.current) return;
        if (turnPhaseRef.current !== "waiting_for_answer_start") return;
        if (currentQuestionRef.current.answerStartedForCurrentQuestion) return;
        if (!currentQuestionRef.current.hasRepeatedCurrentQuestion) {
          repeatCurrentQuestionRef.current?.();
          return;
        }
        advanceAfterNoResponseRef.current?.();
      }, ANSWER_START_TIMEOUT_MS);
    },
    [ANSWER_START_TIMEOUT_MS, clearAnswerStartTimer]
  );

  useEffect(() => {
    stepRef.current = step;
    if (step !== "interview") {
      assistantPlaybackTokenRef.current += 1;
      activeListeningSessionRef.current += 1;
      autoStartListeningRef.current = false;
      recognitionStopReasonRef.current = "teardown";
      clearTurnTimers();
      clearListeningResumeTimer();
      setListeningState(false);
      setTurnPhaseValue("idle");
      finalTranscriptRef.current = "";
      setLiveTranscript("");
      resetCurrentQuestionState();
    }
  }, [
    clearListeningResumeTimer,
    clearTurnTimers,
    resetCurrentQuestionState,
    setListeningState,
    setTurnPhaseValue,
    step,
  ]);

  const startListening = useCallback((options?: { preserveSession?: boolean }) => {
    if (endedRef.current || stepRef.current !== "interview") return false;
    if (!recognitionRef.current || isAiBusy) return false;
    const preserveSession = Boolean(options?.preserveSession);
    if (!preserveSession && isListeningRef.current) return false;

    const sessionToken = preserveSession ? activeListeningSessionRef.current : activeListeningSessionRef.current + 1;
    if (!preserveSession) {
      activeListeningSessionRef.current = sessionToken;
      finalTranscriptRef.current = "";
      setLiveTranscript("");
      currentQuestionRef.current.answerStartedForCurrentQuestion = false;
      currentQuestionRef.current.questionUnanswered = false;
      clearTurnTimers();
      setListeningState(true);
      setTurnPhaseValue("waiting_for_answer_start");
    }

    recognitionStopReasonRef.current = "none";
    try {
      recognitionRef.current.start();
      autoStartListeningRef.current = false;
      if (!preserveSession) {
        armAnswerStartTimer(sessionToken);
      }
      return true;
    } catch {
      if (!preserveSession) {
        setListeningState(false);
        setTurnPhaseValue("idle");
      }
      return false;
    }
  }, [armAnswerStartTimer, clearTurnTimers, isAiBusy, setListeningState, setTurnPhaseValue]);

  const scheduleListeningStart = useCallback(
    (
      playbackToken: number,
      attempt = 0,
      delayMs = PLAYBACK_TO_LISTEN_DELAY_MS,
      preserveSession = false
    ) => {
      autoStartListeningRef.current = true;
      clearListeningResumeTimer();
      listeningResumeTimerRef.current = setTimeout(() => {
        listeningResumeTimerRef.current = null;
        if (endedRef.current || stepRef.current !== "interview") return;
        if (playbackToken !== assistantPlaybackTokenRef.current) return;
        if (isAiBusy) {
          if (attempt < AUTO_LISTEN_MAX_RETRIES) {
            scheduleListeningStart(playbackToken, attempt + 1, AUTO_LISTEN_RETRY_MS, preserveSession);
          }
          return;
        }
        if (startListening({ preserveSession })) return;
        if (attempt < AUTO_LISTEN_MAX_RETRIES) {
          scheduleListeningStart(playbackToken, attempt + 1, AUTO_LISTEN_RETRY_MS, preserveSession);
        }
      }, delayMs);
    },
    [
      AUTO_LISTEN_MAX_RETRIES,
      AUTO_LISTEN_RETRY_MS,
      PLAYBACK_TO_LISTEN_DELAY_MS,
      clearListeningResumeTimer,
      isAiBusy,
      startListening,
    ]
  );

  const resumeListeningAfterPlayback = useCallback(
    (playbackToken: number) => {
      scheduleListeningStart(playbackToken);
    },
    [scheduleListeningStart]
  );

  const playAssistantTurn = useCallback(
    async (text: string) => {
      const playbackToken = assistantPlaybackTokenRef.current + 1;
      assistantPlaybackTokenRef.current = playbackToken;
      clearListeningResumeTimer();
      autoStartListeningRef.current = false;
      clearTurnTimers();
      setTurnPhaseValue("nova_processing");
      if (isListeningRef.current) {
        stopListeningSession("assistant");
      }
      setLiveTranscript("");
      const playbackResult: TtsPlaybackResult = await playTts(text, locale);
      if (playbackToken !== assistantPlaybackTokenRef.current) return;
      if (endedRef.current || stepRef.current !== "interview") return;
      if (playbackResult === "interrupted") return;
      resumeListeningAfterPlayback(playbackToken);
    },
    [
      clearListeningResumeTimer,
      clearTurnTimers,
      locale,
      playTts,
      resumeListeningAfterPlayback,
      setTurnPhaseValue,
      stopListeningSession,
    ]
  );

  // Single-source orb mapping: mic-open -> listening, Nova processing -> thinking, audio playback -> speaking.
  const orbState = mapInterviewStateToOrb({
    step,
    isListening,
    isAiPlaying,
    turnPhase,
  });

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
        setMicError(mapMicrophoneError(err, interviewCopy.en.micDenied));
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
  }, [step, sessionId, jobId]);

  const sendToAI = useCallback(
    async (userMessage: string) => {
      const trimmedMessage = userMessage.trim();
      if (!trimmedMessage) return;

      const now = Date.now();
      if (now < retryAfterUntilRef.current) {
        setProviderError(ui.interviewRateLimitError);
        setTurnPhaseValue("idle");
        return;
      }
      if (sendInFlightRef.current) return;
      if (now - lastSendAtRef.current < 1200) return;
      if (lastUserMessageSentRef.current === trimmedMessage && now - lastSendAtRef.current < 5000) return;

      sendInFlightRef.current = true;
      lastSendAtRef.current = now;
      lastUserMessageSentRef.current = trimmedMessage;
      assistantPlaybackTokenRef.current += 1;
      clearListeningResumeTimer();
      autoStartListeningRef.current = false;
      clearTurnTimers();
      setTurnPhaseValue("nova_processing");
      setLiveTranscript("");

      const newMessages = [
        ...transcript.map((t) => ({ role: t.role as "user" | "assistant", content: t.content })),
        { role: "user" as const, content: trimmedMessage },
      ];
      setTranscript((t) => [...t, { role: "user", content: trimmedMessage }]);

      try {
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
          setTurnPhaseValue("idle");
          return;
        }
        if (res.status === 429) {
          const retryAfterMs = parseRetryAfterMs(res.headers.get("Retry-After"));
          retryAfterUntilRef.current = Date.now() + (retryAfterMs > 0 ? retryAfterMs : 60_000);
        } else {
          retryAfterUntilRef.current = 0;
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
          const errMsg = getInterviewErrorMessage(res.status);
          setProviderError(errMsg);
          setTranscript((t) => [...t, { role: "assistant", content: errMsg }]);
          setAiMessage(errMsg);
          setTurnPhaseValue("idle");
          return;
        }
        const visibleText = (data.content ?? "").trim();
        const interviewEnded = Boolean(data.interviewEnded);

        if (interviewEnded) {
          controlStateRef.current = null;
          resetCurrentQuestionState();
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
          const transcriptText = [...transcript, { role: "user", content: trimmedMessage }]
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

        resetCurrentQuestionTracking(visibleText, data.questionControl ?? controlStateRef.current);

        void playAssistantTurn(visibleText);
      } finally {
        sendInFlightRef.current = false;
      }
    },
    [
      transcript,
      jobCategory,
      sessionId,
      jobId,
      router,
      playAssistantTurn,
      userName,
      locale,
      clearTurnTimers,
      clearListeningResumeTimer,
      getInterviewErrorMessage,
      parseRetryAfterMs,
      resetCurrentQuestionState,
      resetCurrentQuestionTracking,
      setTurnPhaseValue,
    ]
  );

  const repeatCurrentQuestion = useCallback(() => {
    const promptText = currentQuestionRef.current.promptText.trim();
    if (!promptText) {
      advanceAfterNoResponseRef.current?.();
      return;
    }
    currentQuestionRef.current.hasRepeatedCurrentQuestion = true;
    currentQuestionRef.current.questionUnanswered = false;
    currentQuestionRef.current.answerStartedForCurrentQuestion = false;
    finalTranscriptRef.current = "";
    setLiveTranscript("");
    setAiMessage(`${copy.noAnswerRetryIntro} ${promptText}`.trim());
    void playAssistantTurn(`${copy.noAnswerRetryIntro} ${promptText}`.trim());
  }, [copy.noAnswerRetryIntro, playAssistantTurn]);

  const advanceAfterNoResponse = useCallback(() => {
    if (currentQuestionRef.current.questionUnanswered) return;
    currentQuestionRef.current.questionUnanswered = true;
    currentQuestionRef.current.answerStartedForCurrentQuestion = false;
    finalTranscriptRef.current = "";
    setLiveTranscript("");
    if (isListeningRef.current) {
      stopListeningSession("assistant");
    } else {
      clearTurnTimers();
    }
    void sendToAI(copy.noResponseCue);
  }, [clearTurnTimers, copy.noResponseCue, sendToAI, stopListeningSession]);

  useEffect(() => {
    repeatCurrentQuestionRef.current = repeatCurrentQuestion;
    advanceAfterNoResponseRef.current = advanceAfterNoResponse;
  }, [advanceAfterNoResponse, repeatCurrentQuestion]);

  const finalTranscriptRef = useRef("");
  const recognitionStopReasonRef = useRef<RecognitionStopReason>("none");
  const activeListeningSessionRef = useRef(0);
  const isListeningRef = useRef(isListening);
  const endingRef = useRef(false);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

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

    recognition.onresult = (event: unknown) => {
      const e = event as { results: { [index: number]: { [index: number]: { transcript: string }; isFinal: boolean }; length: number } };
      let full = "";
      for (let i = 0; i < e.results.length; i++) {
        full += e.results[i][0].transcript;
      }
      const nextTranscript = full.trim();
      finalTranscriptRef.current = nextTranscript;
      setLiveTranscript(nextTranscript);
      if (nextTranscript) {
        if (!currentQuestionRef.current.answerStartedForCurrentQuestion) {
          currentQuestionRef.current.answerStartedForCurrentQuestion = true;
          currentQuestionRef.current.questionUnanswered = false;
          clearAnswerStartTimer();
          setTurnPhaseValue("user_speaking");
        }
        armUserSilenceTimer(activeListeningSessionRef.current);
      }
    };

    recognition.onerror = ((event?: unknown) => {
      if (endedRef.current) return;
      const err = (event ?? {}) as { error?: string };
      const stopReason = recognitionStopReasonRef.current;
      if (stopReason === "assistant" || stopReason === "manual" || stopReason === "teardown") {
        return;
      }
      if (!isListeningRef.current) return;
      if (stopReason === "silence-finalize") {
        return;
      }

      if (err.error === "no-speech" || err.error === "aborted" || err.error === "audio-capture") {
        scheduleListeningStart(assistantPlaybackTokenRef.current, 0, AUTO_LISTEN_RETRY_MS, true);
        return;
      }

      stopListeningSession("teardown");
    }) as (e: unknown) => void;

    recognition.onend = () => {
      if (endedRef.current) return;
      const stopReason = recognitionStopReasonRef.current;
      recognitionStopReasonRef.current = "none";
      if (stopReason === "assistant" || stopReason === "teardown") {
        finalTranscriptRef.current = "";
        setLiveTranscript("");
        return;
      }
      if (!isListeningRef.current) {
        return;
      }

      if (stopReason !== "silence-finalize" && stopReason !== "manual") {
        scheduleListeningStart(assistantPlaybackTokenRef.current, 0, AUTO_LISTEN_RETRY_MS, true);
        return;
      }

      const text = finalTranscriptRef.current.trim();
      finalTranscriptRef.current = "";
      setLiveTranscript("");
      setListeningState(false);

      if (!text) {
        currentQuestionRef.current.answerStartedForCurrentQuestion = false;
        setTurnPhaseValue("waiting_for_answer_start");
        scheduleListeningStart(assistantPlaybackTokenRef.current, 0, AUTO_LISTEN_RETRY_MS);
        return;
      }

      void sendToAI(text);
    };

    recognitionRef.current = recognition;
    if (autoStartListeningRef.current) {
      startListening();
    }
    return () => {
      clearTurnTimers();
      recognition.abort();
    };
  }, [
    armUserSilenceTimer,
    AUTO_LISTEN_RETRY_MS,
    clearAnswerStartTimer,
    clearTurnTimers,
    step,
    sendToAI,
    locale,
    scheduleListeningStart,
    setListeningState,
    setTurnPhaseValue,
    startListening,
    stopListeningSession,
  ]);

  const startInterview = useCallback(async () => {
    const now = Date.now();
    if (sendInFlightRef.current) return;
    if (now < retryAfterUntilRef.current) {
      setProviderError(ui.interviewRateLimitError);
      return;
    }
    sendInFlightRef.current = true;

    endedRef.current = false;
    interviewStartTimeRef.current = Date.now();
    trackClient(ANALYTICS_EVENTS.interview_started, {
      job_category: jobCategory,
      session_id: sessionId,
      ...(jobId ? { job_id: jobId } : {}),
    });
    setStep("interview");
    setTurnPhaseValue("nova_processing");
    setAiMessage("");
    resetCurrentQuestionState();
    try {
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
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        const retryAfterMs = parseRetryAfterMs(res.headers.get("Retry-After"));
        retryAfterUntilRef.current = Date.now() + (retryAfterMs > 0 ? retryAfterMs : 60_000);
      } else {
        retryAfterUntilRef.current = 0;
      }
      if (!res.ok) {
        captureMessage(`Mock interview start: HTTP ${res.status}`, {
          route: "/api/mock-interview",
          session_id: sessionId,
          ...(jobId ? { job_id: jobId } : {}),
          tags: { feature: "ai_interview" },
          level: "warning",
        });
        const errMsg = getInterviewErrorMessage(res.status);
        setProviderError(errMsg);
        setAiMessage(errMsg);
        setTranscript([{ role: "assistant", content: errMsg }]);
        setTurnPhaseValue("idle");
        return;
      }
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
      setProviderError(null);
      setAiMessage(content);
      setTranscript([{ role: "assistant", content }]);
      resetCurrentQuestionTracking(content, data.questionControl ?? controlStateRef.current);

      void playAssistantTurn(content);
    } finally {
      sendInFlightRef.current = false;
    }
  }, [
    jobCategory,
    jobId,
    sessionId,
    playAssistantTurn,
    userName,
    locale,
    copy.readyPhrase,
    copy.fallbackOpening,
    getInterviewErrorMessage,
    parseRetryAfterMs,
    resetCurrentQuestionState,
    resetCurrentQuestionTracking,
    setTurnPhaseValue,
    ui.interviewRateLimitError,
  ]);

  const toggleListen = () => {
    if (!recognitionRef.current) return;
    if (turnPhaseRef.current === "nova_processing" || turnPhaseRef.current === "user_answer_complete") return;
    assistantPlaybackTokenRef.current += 1;
    clearListeningResumeTimer();
    autoStartListeningRef.current = false;
    if (isListening) {
      if (turnPhaseRef.current === "user_speaking") {
        finalizeUserTurn("manual");
      }
    } else {
      startListening();
    }
  };

  const [showEndConfirm, setShowEndConfirm] = useState(false);

  useEffect(() => {
    if (!showEndConfirm) return;
    endDialogContinueRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setShowEndConfirm(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showEndConfirm]);

  const releaseMicrophoneResources = useCallback(() => {
    assistantPlaybackTokenRef.current += 1;
    clearListeningResumeTimer();
    autoStartListeningRef.current = false;
    recognitionStopReasonRef.current = "teardown";
    clearTurnTimers();
    try {
      recognitionRef.current?.stop();
    } catch {
      // Ignore redundant stop requests during teardown.
    }
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setListeningState(false);
    setTurnPhaseValue("idle");
    setLiveTranscript("");
    finalTranscriptRef.current = "";
    resetCurrentQuestionState();
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
  }, [
    clearListeningResumeTimer,
    clearTurnTimers,
    resetCurrentQuestionState,
    setListeningState,
    setTurnPhaseValue,
  ]);

  const doEvaluateAndRedirect = useCallback(async () => {
    setStep("processing");
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
  }, [transcript, jobCategory, sessionId, jobId, router, locale]);

  const handleEndInterview = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    endedRef.current = true;
    releaseMicrophoneResources();
    tts.stop();
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
    };
  }, [releaseMicrophoneResources]);

  if (step === "mic-test") {
    return (
      <main id="mock-interview-session" className="mx-auto max-w-md px-4 py-2">
        <div className="rounded-[10px] border border-[var(--border)] bg-[#FAFAF9] p-6 sm:p-8 dark:border-white/[0.08] dark:bg-zinc-900">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[10px]"
            style={{ backgroundColor: "var(--primary-muted)" }}
          >
            <Microphone className="h-8 w-8" style={{ color: "var(--primary-dark)" }} weight="regular" aria-hidden />
          </div>
          <h2 className="text-center text-xl font-semibold leading-[1.25] tracking-tight text-[#111111] dark:text-zinc-100">
            {ui.testMicTitle}
          </h2>
          <p className="mt-3 text-center text-base font-normal leading-[1.5] text-[#111111]/60 dark:text-zinc-400">
            {ui.testMicHint}
          </p>
          <div
            className="mt-6 h-4 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-zinc-700"
            aria-hidden
          >
            <div
              className="h-full rounded-full transition-all duration-150 motion-reduce:transition-none"
              style={{
                width: `${micLevel}%`,
                backgroundColor: "var(--primary)",
              }}
            />
          </div>
          {providerError && (
            <p className="mt-4 text-center text-sm text-amber-800 dark:text-amber-200" role="alert">
              {providerError}
            </p>
          )}
          {micError && (
            <p className="mt-4 text-center text-sm text-red-600 dark:text-red-400" role="alert">
              {micError}
            </p>
          )}
          {micStream && !micError && (
            <p className="mt-4 text-center text-sm text-green-700 dark:text-green-400">
              {ui.micWorking}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              startInterview();
            }}
            disabled={!micStream || !!micError}
            aria-label={ui.continueMicTestAria}
            className="mt-6 flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-[10px] px-4 py-3 text-sm font-semibold text-white transition-[filter,colors] hover:brightness-105 active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-zinc-900"
            style={{ backgroundColor: "var(--primary)" }}
          >
            {ui.continue}
          </button>
        </div>
      </main>
    );
  }

  if (step === "processing") {
    return (
      <MockInterviewProcessingSkeleton title={ui.processing} subtitle={ui.processingSubtitle} />
    );
  }

  const orbAnimate =
    reduceMotion || step !== "interview"
      ? { scale: 1, opacity: 1, rotate: 0 }
      : orbState === "listening"
        ? {
            scale: [0.995, 1.026, 1],
            opacity: [0.96, 1, 0.98],
            rotate: [0, -0.55, 0],
          }
        : orbState === "thinking"
          ? {
              scale: [0.986, 1.032, 0.995],
              opacity: [0.9, 0.98, 0.92],
              rotate: [0, 5, 0],
            }
          : orbState === "speaking"
            ? {
                scale: [1, 1.072, 1.018, 1.088, 1],
                opacity: [0.95, 1, 0.97, 1, 0.98],
                rotate: [0, -1.4, 1, -0.6, 0],
              }
            : { scale: [1, 1.02, 1], opacity: [0.96, 1, 0.98], rotate: 0 };

  const orbTransition =
    reduceMotion
      ? { duration: 0 }
      : orbState === "listening"
        ? { duration: 2.3, repeat: Infinity, ease: [0.22, 1, 0.36, 1] as const }
        : orbState === "thinking"
          ? { duration: 4.6, repeat: Infinity, ease: [0.32, 0, 0.16, 1] as const }
          : orbState === "speaking"
            ? { duration: 0.92, repeat: Infinity, ease: [0.2, 0.9, 0.2, 1] as const }
            : { duration: 2.8, repeat: Infinity, ease: [0.22, 1, 0.36, 1] as const };

  const isNovaProcessing =
    step === "interview" && (turnPhase === "nova_processing" || turnPhase === "user_answer_complete");
  const shouldAnimateNovaSubtitle = isNovaProcessing && !isAiPlaying;
  const isNovaBusy = isAiBusy || isNovaProcessing;
  const micAriaLabel = isNovaBusy
    ? ui.statusWaitNova
    : isListening
      ? ui.micAriaStopListening
      : ui.micAriaStartListening;

  return (
    <main
      id="mock-interview-session-live"
      className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col overflow-hidden px-4 py-0.5"
    >
      {showEndConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50"
          role="presentation"
          onClick={() => setShowEndConfirm(false)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="end-interview-dialog-title"
            initial={reduceMotion ? false : { scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={
              reduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }
            }
            onClick={(e) => e.stopPropagation()}
            className="mx-4 w-full max-w-sm rounded-[10px] border border-[#E8E8E6] bg-[#FAFAF9] p-6 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[10px] bg-red-100/90 dark:bg-red-950/40">
              <PhoneDisconnect className="h-6 w-6 text-red-600 dark:text-red-400" weight="regular" aria-hidden />
            </div>
            <h3
              id="end-interview-dialog-title"
              className="text-center text-lg font-semibold leading-snug text-[#111111] dark:text-zinc-100"
            >
              {ui.endInterviewTitle}
            </h3>
            <p className="mt-2 text-center text-sm font-normal leading-[1.5] text-[#111111]/60 dark:text-zinc-400">
              {ui.endInterviewBody}
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:gap-3">
              <button
                ref={endDialogContinueRef}
                type="button"
                onClick={() => setShowEndConfirm(false)}
                className="min-h-11 flex-1 touch-manipulation rounded-[10px] border border-[#E8E8E6] bg-[#FAFAF9] px-4 py-2.5 text-sm font-normal text-[#111111]/80 hover:bg-[#F2F1EF] active:bg-[#EAE9E6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:active:bg-zinc-800/80 dark:focus-visible:ring-zinc-500 dark:focus-visible:ring-offset-zinc-900"
              >
                {ui.continueInterview}
              </button>
              <button
                type="button"
                onClick={handleEndInterview}
                className="min-h-11 flex-1 touch-manipulation rounded-[10px] bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 active:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:bg-red-600 dark:hover:bg-red-700 dark:active:bg-red-800 dark:focus-visible:ring-offset-zinc-900"
              >
                {ui.endEvaluate}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="mb-0.5 flex shrink-0 items-center justify-between gap-3">
        <h2 className="min-w-0 truncate text-base font-semibold leading-snug text-[#111111] sm:text-lg dark:text-zinc-100">
          {`${jobCategory} ${ui.interviewSuffix}`}
        </h2>
        {step !== "goodbye" && (
          <button
            type="button"
            onClick={() => setShowEndConfirm(true)}
            aria-label={ui.endInterviewButtonAria}
            className="flex min-h-11 shrink-0 touch-manipulation items-center gap-2 rounded-[10px] border border-red-200/90 bg-[#FAFAF9] px-3 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 active:bg-red-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 dark:border-red-900/60 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/35 dark:active:bg-red-950/50 dark:focus-visible:ring-offset-zinc-950"
          >
            <PhoneDisconnect className="h-4 w-4 shrink-0" weight="regular" aria-hidden />
            {ui.end}
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-start gap-0.5 pt-0.5">
          {/* Orb — tek ekrana sığacak (vmin ile sınırlı) */}
          <motion.div
            className="relative flex shrink-0 items-center justify-center"
            style={{
              width: "clamp(340px, 46vh, 560px)",
              height: "clamp(340px, 46vh, 560px)",
              marginTop: "-44px",
            }}
            animate={orbAnimate}
            transition={orbTransition}
          >
            <Orb
              agentState={orbState}
              volumeMode="manual"
              getOutputVolume={tts.getOutputLevel}
              colors={["#E8D078", "#D4B84A"]}
              className="relative z-10 h-full w-full"
            />
          </motion.div>

          <motion.div
            key={aiMessage}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduceMotion ? { duration: 0 } : { duration: 0.28, ease: [0.16, 1, 0.3, 1] }
            }
            className="w-full max-w-[560px] shrink-0 -mt-12 min-h-[88px]"
          >
            <p
              className={`nova-subtitle-frame rounded-2xl border border-black/10 bg-white/40 px-5 py-3 text-center text-base font-medium leading-relaxed tracking-tight text-zinc-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_10px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl dark:border-white/20 dark:bg-zinc-900/30 dark:text-zinc-100 ${
                shouldAnimateNovaSubtitle ? "nova-processing-frame" : ""
              }`}
              style={{
                backgroundImage:
                  "linear-gradient(135deg, rgba(255,255,255,0.58) 0%, rgba(255,255,255,0.34) 52%, rgba(255,255,255,0.22) 100%)",
              }}
              aria-live="polite"
              aria-atomic="true"
            >
              {aiMessage || "\u00A0"}
            </p>
          </motion.div>
        </div>

        <div className="shrink-0 flex flex-col items-center">
          <div className="relative mt-0 flex h-11 w-11 shrink-0 items-center justify-center sm:h-12 sm:w-12">
            {step !== "goodbye" && isListening && !reduceMotion && (
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
              type="button"
              onClick={toggleListen}
              disabled={isNovaBusy || step === "goodbye"}
              aria-pressed={isListening}
              aria-label={micAriaLabel}
              className={`relative flex h-11 w-11 touch-manipulation items-center justify-center rounded-full transition-colors duration-200 motion-reduce:transition-none sm:h-12 sm:w-12 ${
                isListening
                  ? "bg-red-600 text-white ring-2 ring-red-500/25 dark:ring-red-400/20"
                  : "text-white"
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-zinc-900`}
              style={!isListening ? { backgroundColor: "var(--primary)" } : {}}
            >
              {isListening ? (
                <MicrophoneSlash className="h-5 w-5 sm:h-6 sm:w-6" weight="regular" aria-hidden />
              ) : (
                <Microphone className="h-5 w-5 sm:h-6 sm:w-6" weight="regular" aria-hidden />
              )}
            </button>
          </div>
          <p
            className={`mt-2 min-h-8 max-w-[220px] text-center text-[11px] leading-4 tracking-[0.01em] transition-opacity duration-200 ${
              isListening && liveTranscript
                ? "opacity-100 text-[#111111]/38 dark:text-zinc-400/60"
                : "opacity-0"
            }`}
            aria-hidden={!isListening || !liveTranscript}
          >
            {isListening && liveTranscript ? liveTranscript : "\u00A0"}
          </p>
          <p className="text-center text-sm font-normal leading-[1.5] text-[#111111]/55 dark:text-zinc-500">
            {step === "goodbye"
              ? ui.statusWrapping
              : isNovaBusy
                ? ui.statusWaitNova
                : isListening
                  ? ui.statusListening
                  : ui.statusClickToRespond}
          </p>
          {providerError && step === "interview" && (
            <p
              className="mt-2 max-w-md text-center text-sm text-amber-900 dark:text-amber-200"
              role="alert"
            >
              {providerError}
            </p>
          )}
          {tts.error && (
            <p
              className="mt-1 max-w-md text-center text-sm text-red-700 dark:text-red-400"
              role="alert"
            >
              {tts.error}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
