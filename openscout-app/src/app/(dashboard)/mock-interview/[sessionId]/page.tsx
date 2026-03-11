"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Mic, MicOff, PhoneOff } from "lucide-react";
import { motion } from "framer-motion";
import { useTTS } from "@/hooks/useTTS";
import { createClient } from "@/lib/supabase/client";
import { Orb, type AgentState } from "@/components/ui/orb";

export default function MockInterviewSessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const jobCategory = searchParams.get("category") || "Frontend Developer";
  const jobId = searchParams.get("jobId") || "";
  const cvScoreParam = searchParams.get("cvScore");
  const cvScoreForApplication = cvScoreParam !== null && cvScoreParam !== "" ? Number(cvScoreParam) : null;

  const [step, setStep] = useState<"mic-test" | "interview" | "processing">("mic-test");
  const [micOk, setMicOk] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [transcript, setTranscript] = useState<Array<{ role: string; content: string }>>([]);
  const [aiMessage, setAiMessage] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [userName, setUserName] = useState("Candidate");

  const tts = useTTS();
  const isAiSpeaking = tts.loading;
  const supabase = useMemo(() => createClient(), []);

  // Orb agentState: microphone → listening, waiting for AI → thinking, TTS → talking, default → null
  const agentState: AgentState = (() => {
    if (isListening) return "listening";
    const waitingForAi =
      step === "interview" &&
      transcript.length > 0 &&
      transcript[transcript.length - 1]?.role === "user";
    const initializing = step === "interview" && transcript.length === 0 && aiMessage === "Nova is preparing your interview...";
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

  const recognitionRef = useRef<{ start: () => void; stop: () => void; abort: () => void } | null>(null);
  const interviewStartTimeRef = useRef<number | null>(null);
  const micAnalyserRef = useRef<{ analyser: AnalyserNode; ctx: AudioContext } | null>(null);
  const micAnimationRef = useRef<number | null>(null);

  useEffect(() => {
    if (step !== "mic-test") return;
    setMicError(null);
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => {
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
      .catch((err) => {
        setMicError(err.message || "Microphone access denied. Please allow microphone and try again.");
        setMicStream(null);
      });

    return () => {
      if (micAnimationRef.current) cancelAnimationFrame(micAnimationRef.current);
      micAnalyserRef.current = null;
      stream?.getTracks().forEach((t) => t.stop());
      setMicStream(null);
      setMicLevel(0);
    };
  }, [step]);

  const sendToAI = useCallback(
    async (userMessage: string) => {
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
          ...(jobId && { jobId }),
        }),
      });
      const data = await res.json();
      const content = data.content || "";
      setTranscript((t) => [...t, { role: "assistant", content }]);
      setAiMessage(content);

      const hasEndSignal = content.includes("INTERVIEW_ENDED") && content.includes('"score"');
      if (hasEndSignal) {
        setStep("processing");
        const durationMs = interviewStartTimeRef.current ? Date.now() - interviewStartTimeRef.current : 0;
        const minMs = 5 * 60 * 1000;
        if (durationMs < minMs) {
          const q = new URLSearchParams({ tooShort: "1", score: "0", strengths: "[]", improvements: "[]", category: jobCategory });
          if (cvScoreForApplication != null) q.set("cvScore", String(cvScoreForApplication));
          router.push(`/mock-interview/${sessionId}/result?${q.toString()}`);
          return;
        }
        const transcriptText = [...transcript, { role: "user", content: userMessage }]
          .concat([{ role: "assistant", content }])
          .map((m) => `${m.role}: ${m.content}`)
          .join("\n");
        const resultRes = await fetch("/api/mock-interview/result", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: transcriptText, jobCategory, ...(jobId && { jobId }) }),
        });
        const result = await resultRes.json();
        const score = result.score ?? 0;
        const report = { strengths: result.strengths || [], improvements: result.improvements || [] };
        if (jobId) {
          await fetch("/api/job-applications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jobId,
              cvScore: cvScoreForApplication,
              interviewScore: score,
              interviewReport: report,
            }),
          });
        }
        const q = new URLSearchParams({
          score: String(score),
          strengths: JSON.stringify(report.strengths),
          improvements: JSON.stringify(report.improvements),
          category: jobCategory,
        });
        if (cvScoreForApplication != null) q.set("cvScore", String(cvScoreForApplication));
        router.push(`/mock-interview/${sessionId}/result?${q.toString()}`);
        return;
      }

      tts.play(content);
    },
    [transcript, jobCategory, sessionId, jobId, cvScoreForApplication, router, tts.play, userName]
  );

  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef("");

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
    recognition.lang = "en-US";

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
      const err = (event ?? {}) as { error?: string };
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (err.error === "no-speech" || err.error === "audio-capture") {
        sendToAI("[User was silent or speech was not recognized. Please ask them to repeat naturally.]");
      }
      setIsListening(false);
    }) as (e: unknown) => void;

    recognition.onend = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      const text = finalTranscriptRef.current;
      finalTranscriptRef.current = "";
      if (text) {
        sendToAI(text);
      } else {
        sendToAI("[User was silent or speech was not recognized. Please ask them to repeat naturally.]");
      }
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      recognition.abort();
    };
  }, [step, sendToAI]);

  const startInterview = useCallback(async () => {
    interviewStartTimeRef.current = Date.now();
    setStep("interview");
    setAiMessage("Nova is preparing your interview...");
    const res = await fetch("/api/mock-interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Hello, I'm ready for the interview." }],
        jobCategory,
        userName,
        ...(jobId && { jobId }),
      }),
    });
    const data = await res.json();
    const content = data.content || "Hello, welcome. Tell me about yourself.";
    setAiMessage(content);
    setTranscript([{ role: "assistant", content }]);
    tts.play(content);
  }, [jobCategory, jobId, tts.play, userName]);

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

  const handleEndInterview = useCallback(async () => {
    setShowEndConfirm(false);
    setStep("processing");
    const durationMs = interviewStartTimeRef.current ? Date.now() - interviewStartTimeRef.current : 0;
    const tooShort = durationMs < MIN_INTERVIEW_MS;

    if (tooShort) {
      router.push(
        `/mock-interview/${sessionId}/result?tooShort=1&score=0&strengths=${encodeURIComponent(JSON.stringify([]))}&improvements=${encodeURIComponent(JSON.stringify([]))}`
      );
      return;
    }

    try {
      const transcriptText = transcript
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n");
      const resultRes = await fetch("/api/mock-interview/result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcriptText || "No conversation recorded.",
          jobCategory,
          ...(jobId && { jobId }),
        }),
      });
      const result = await resultRes.json();
      const score = result.score ?? 0;
      const strengths = result.strengths ?? [];
      const improvements = result.improvements ?? [];
      const report = { strengths, improvements };
      if (jobId) {
        await fetch("/api/job-applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId,
            cvScore: cvScoreForApplication,
            interviewScore: score,
            interviewReport: report,
          }),
        });
      }
      const q = new URLSearchParams({
        score: String(score),
        strengths: JSON.stringify(strengths),
        improvements: JSON.stringify(improvements),
        category: jobCategory,
      });
      if (cvScoreForApplication != null) q.set("cvScore", String(cvScoreForApplication));
      router.push(`/mock-interview/${sessionId}/result?${q.toString()}`);
    } catch (e) {
      console.error("Failed to evaluate interview:", e);
      router.push(`/mock-interview/${sessionId}/result?score=0&strengths=${encodeURIComponent(JSON.stringify([]))}&improvements=${encodeURIComponent(JSON.stringify(["Could not process the interview. Please try again."]))}`);
    }
  }, [transcript, jobCategory, sessionId, jobId, cvScoreForApplication, router]);

  if (step === "mic-test") {
    return (
      <div className="mx-auto max-w-md">
        <div className="rounded-[10px] border border-[var(--border)] bg-white p-8 shadow-card dark:border-white/[0.06] dark:bg-zinc-900">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--primary-muted)" }}
          >
            <Mic className="h-8 w-8" style={{ color: "var(--primary-dark)" }} />
          </div>
          <h2 className="text-center text-xl font-bold text-gray-900 dark:text-zinc-100">Test Your Microphone</h2>
          <p className="mt-2 text-center text-sm text-gray-500 dark:text-zinc-400">
            Speak into your microphone. The bar below should move when you talk.
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
          {micError && (
            <p className="mt-4 text-center text-sm text-red-600 dark:text-red-400">{micError}</p>
          )}
          {micStream && !micError && (
            <p className="mt-4 text-center text-sm text-green-600 dark:text-green-400">
              Microphone working! Speak to see the level, then continue.
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
            Continue
          </button>
        </div>
      </div>
    );
  }

  if (step === "processing") {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-4 font-medium text-gray-900 dark:text-zinc-100">Processing your interview...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col overflow-hidden px-4 py-2">
      {/* End confirmation modal */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:border dark:border-white/[0.06] dark:bg-zinc-900"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mx-auto dark:bg-red-950/50">
              <PhoneOff className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-center text-lg font-semibold text-gray-900 dark:text-zinc-100">End interview?</h3>
            <p className="mt-2 text-center text-sm text-gray-500 dark:text-zinc-400">
              Your responses will be evaluated and scored. This action cannot be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Continue interview
              </button>
              <button
                onClick={handleEndInterview}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
              >
                End &amp; evaluate
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="mb-1 flex shrink-0 items-center justify-between">
        <h2 className="font-semibold text-gray-900 dark:text-zinc-100">{jobCategory} Interview</h2>
        <button
          onClick={() => setShowEndConfirm(true)}
          className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          <PhoneOff className="h-4 w-4" />
          End
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-[10px] border border-[var(--border)] bg-white p-3 shadow-card dark:border-white/[0.06] dark:bg-black sm:p-4">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 sm:gap-2">
          {/* Orb — tek ekrana sığacak (vmin ile sınırlı) */}
          <div
            className="relative flex shrink-0 items-center justify-center"
            style={{
              clipPath: "circle(50% at 50% 50%)",
              overflow: "hidden",
              width: "min(380px, 48vmin)",
              height: "min(380px, 48vmin)",
            }}
          >
            <Orb agentState={agentState} colors={["#FFE066", "#FFCB05"]} className="relative z-10 h-full w-full" />
          </div>

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
            {isListening && (
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
              disabled={isAiSpeaking}
              className={`relative flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200 sm:h-14 sm:w-14 ${
                isListening ? "bg-red-500 text-white shadow-lg shadow-red-200 dark:shadow-red-900/30" : "text-white"
              } disabled:cursor-not-allowed disabled:opacity-50`}
              style={!isListening ? { backgroundColor: "var(--primary)" } : {}}
            >
              {isListening ? <MicOff className="h-6 w-6 sm:h-7 sm:w-7" /> : <Mic className="h-6 w-6 sm:h-7 sm:w-7" />}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-400 sm:text-sm">
            {isAiSpeaking ? "Wait for Nova to finish..." : isListening ? "Listening..." : "Click to respond"}
          </p>
          {tts.error && (
            <p className="mt-1 max-w-md text-center text-xs text-red-600 dark:text-red-400 sm:text-sm">
              Voice error: {tts.error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
