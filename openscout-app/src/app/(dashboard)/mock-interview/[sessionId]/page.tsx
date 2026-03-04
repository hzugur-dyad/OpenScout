"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Mic, MicOff, PhoneOff } from "lucide-react";
import { motion } from "framer-motion";
import { useTTS } from "@/hooks/useTTS";

export default function MockInterviewSessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const jobCategory = searchParams.get("category") || "Frontend Developer";

  const [step, setStep] = useState<"mic-test" | "interview" | "processing">("mic-test");
  const [micOk, setMicOk] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [transcript, setTranscript] = useState<Array<{ role: string; content: string }>>([]);
  const [aiMessage, setAiMessage] = useState("");
  const [isListening, setIsListening] = useState(false);

  const tts = useTTS();
  const isAiSpeaking = tts.loading;

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
          userName: "Aday",
        }),
      });
      const data = await res.json();
      const content = data.content || "";
      setTranscript((t) => [...t, { role: "assistant", content }]);
      setAiMessage(content);

      if (content.includes("INTERVIEW_ENDED") || content.includes("MULAKAT_BITTI") || content.toLowerCase().includes("interview_end")) {
        setStep("processing");
        const durationMs = interviewStartTimeRef.current ? Date.now() - interviewStartTimeRef.current : 0;
        const minMs = 5 * 60 * 1000;
        if (durationMs < minMs) {
          router.push(`/mock-interview/${sessionId}/result?tooShort=1&score=0&strengths=${encodeURIComponent(JSON.stringify([]))}&improvements=${encodeURIComponent(JSON.stringify([]))}`);
          return;
        }
        const transcriptText = [...transcript, { role: "user", content: userMessage }]
          .concat([{ role: "assistant", content }])
          .map((m) => `${m.role}: ${m.content}`)
          .join("\n");
        const resultRes = await fetch("/api/mock-interview/result", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: transcriptText, jobCategory }),
        });
        const result = await resultRes.json();
        router.push(`/mock-interview/${sessionId}/result?score=${result.score}&strengths=${encodeURIComponent(JSON.stringify(result.strengths || []))}&improvements=${encodeURIComponent(JSON.stringify(result.improvements || []))}`);
        return;
      }

      tts.play(content);
    },
    [transcript, jobCategory, sessionId, router, tts.play]
  );

  useEffect(() => {
    if (step !== "interview") return;
    const SpeechRecognitionAPI = (typeof window !== "undefined" && ((window as unknown as { SpeechRecognition?: new () => unknown }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition));
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI() as { start: () => void; stop: () => void; abort: () => void; continuous: boolean; interimResults: boolean; lang: string; onresult: ((e: unknown) => void) | null; onerror: (() => void) | null; onend: (() => void) | null };
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    let gotResult = false;
    recognition.onresult = (event: unknown) => {
      const e = event as { results: Array<Array<{ transcript: string }>> };
      const transcriptVal = e.results?.[0]?.[0]?.transcript?.trim();
      gotResult = true;
      if (transcriptVal) {
        sendToAI(transcriptVal);
      } else {
        sendToAI("[User was silent or speech was not recognized. Please ask them to repeat in a natural way, e.g. 'I didn\'t catch that, could you repeat?' or 'Sorry, I couldn\'t hear you clearly. Would you mind saying that again?']");
      }
    };
    recognition.onerror = (event: unknown) => {
      const err = event as { error?: string };
      gotResult = true;
      if (err.error === "no-speech" || err.error === "audio-capture") {
        sendToAI("[User was silent or speech was not recognized. Please ask them to repeat in a natural way, e.g. 'I didn\'t catch that, could you repeat?' or 'Sorry, I couldn\'t hear you clearly. Would you mind saying that again?']");
      }
      setIsListening(false);
    };
    recognition.onend = () => {
      if (!gotResult) {
        sendToAI("[User was silent or speech was not recognized. Please ask them to repeat in a natural way, e.g. 'I didn\'t catch that, could you repeat?' or 'Sorry, I couldn\'t hear you clearly. Would you mind saying that again?']");
      }
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    return () => {
      recognition.abort();
    };
  }, [step, sendToAI]);

  const startInterview = useCallback(async () => {
    interviewStartTimeRef.current = Date.now();
    setStep("interview");
    setAiMessage("Interview starting...");
    const res = await fetch("/api/mock-interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Hello, I'm ready for the interview." }],
        jobCategory,
        userName: "Aday",
      }),
    });
    const data = await res.json();
    const content = data.content || "Hello, welcome. Tell me about yourself.";
    setAiMessage(content);
    setTranscript([{ role: "assistant", content }]);
    tts.play(content);
  }, [jobCategory, tts.play]);

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

  const handleEndInterview = useCallback(async () => {
    if (!confirm("Are you sure you want to end the interview? Your responses will be evaluated.")) return;
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
        }),
      });
      const result = await resultRes.json();
      const score = result.score ?? 0;
      const strengths = result.strengths ?? [];
      const improvements = result.improvements ?? [];
      router.push(
        `/mock-interview/${sessionId}/result?score=${score}&strengths=${encodeURIComponent(JSON.stringify(strengths))}&improvements=${encodeURIComponent(JSON.stringify(improvements))}`
      );
    } catch (e) {
      console.error("Failed to evaluate interview:", e);
      router.push(`/mock-interview/${sessionId}/result?score=0&strengths=${encodeURIComponent(JSON.stringify([]))}&improvements=${encodeURIComponent(JSON.stringify(["Could not process the interview. Please try again."]))}`);
    }
  }, [transcript, jobCategory, sessionId, router]);

  if (step === "mic-test") {
    return (
      <div className="mx-auto max-w-md">
        <div className="rounded-[10px] border border-[var(--border)] bg-white p-8 shadow-card">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--primary-muted)" }}
          >
            <Mic className="h-8 w-8" style={{ color: "var(--primary-dark)" }} />
          </div>
          <h2 className="text-center text-xl font-bold">Test Your Microphone</h2>
          <p className="mt-2 text-center text-sm text-gray-500">
            Speak into your microphone. The bar below should move when you talk.
          </p>
          <div className="mt-6 h-4 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full transition-all duration-150"
              style={{
                width: `${micLevel}%`,
                backgroundColor: "var(--primary)",
              }}
            />
          </div>
          {micError && (
            <p className="mt-4 text-center text-sm text-red-600">{micError}</p>
          )}
          {micStream && !micError && (
            <p className="mt-4 text-center text-sm text-green-600">
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
        <p className="mt-4 font-medium">Processing your interview...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">{jobCategory} Interview</h2>
        <button
          onClick={handleEndInterview}
          className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
        >
          <PhoneOff className="h-4 w-4" />
          End
        </button>
      </div>

      <div className="rounded-[10px] border border-[var(--border)] bg-white p-8 shadow-card">
        <div className="flex flex-col items-center">
          <motion.div
            animate={{ scale: isAiSpeaking ? 1.05 : 1 }}
            className="mb-6 flex h-24 w-24 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--primary-muted)" }}
          >
            <span className="text-4xl">AI</span>
          </motion.div>
          <p className="min-h-[80px] text-center text-lg text-gray-700">
            {aiMessage}
          </p>

          <button
            onClick={toggleListen}
            disabled={isAiSpeaking}
            className={`mt-8 flex h-16 w-16 items-center justify-center rounded-full ${
              isListening ? "bg-red-500 text-white" : "bg-primary text-white"
            }`}
            style={!isListening ? { backgroundColor: "var(--primary)" } : {}}
          >
            {isListening ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
          </button>
          <p className="mt-2 text-sm text-gray-500">
            {isListening ? "Listening..." : "Click to respond"}
          </p>
        </div>
      </div>
    </div>
  );
}
