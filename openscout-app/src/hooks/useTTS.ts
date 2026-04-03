"use client";

import { useState, useCallback, useRef } from "react";
import type { InterviewLocale } from "@/lib/interview-locale";
import { captureException, captureMessage } from "@/lib/monitoring";
import { getSpeechChunkPauseMs, splitTextIntoSpeechChunks } from "@/lib/tts-text";
import { mapTtsUserError } from "@/lib/user-facing-errors";

export type TtsPlaybackResult = "completed" | "interrupted" | "not_played";

function formatTtsError(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: string };
    if (typeof parsed?.error === "string" && parsed.error.length > 0) return parsed.error;
  } catch {
    // ignore
  }
  return raw;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function base64ToBlob(base64: string, mimeType = "audio/mpeg"): Blob {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}

function waitForAudioTailFlush(frameCount = 2): Promise<void> {
  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
    return wait(0);
  }

  return new Promise((resolve) => {
    const advance = (remainingFrames: number) => {
      if (remainingFrames <= 0) {
        resolve();
        return;
      }
      window.requestAnimationFrame(() => advance(remainingFrames - 1));
    };

    advance(frameCount);
  });
}

export function useTTS() {
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRequestIdRef = useRef(0);
  const lastCallAtRef = useRef(0);
  const lastUtteranceRef = useRef<string>("");
  const outputLevelRef = useRef(0);
  const activePlaybackRef = useRef<{
    requestId: number;
    resolve: (result: TtsPlaybackResult) => void;
  } | null>(null);
  const playbackAnalysisRef = useRef<{
    audioContext: AudioContext;
    analyser: AnalyserNode;
    source: MediaElementAudioSourceNode;
    data: Uint8Array;
    frameId: number | null;
  } | null>(null);

  const stopPlaybackAnalysis = useCallback(() => {
    const activeAnalysis = playbackAnalysisRef.current;
    playbackAnalysisRef.current = null;
    outputLevelRef.current = 0;
    if (!activeAnalysis) return;
    if (activeAnalysis.frameId !== null) {
      cancelAnimationFrame(activeAnalysis.frameId);
    }
    try {
      activeAnalysis.source.disconnect();
    } catch {
      // Ignore disconnect errors during teardown.
    }
    try {
      activeAnalysis.analyser.disconnect();
    } catch {
      // Ignore disconnect errors during teardown.
    }
    activeAnalysis.audioContext.close().catch(() => {});
  }, []);

  const startPlaybackAnalysis = useCallback(async (audio: HTMLAudioElement) => {
    stopPlaybackAnalysis();
    try {
      const audioContext = new AudioContext();
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;
      const source = audioContext.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const analysis = {
        audioContext,
        analyser,
        source,
        data,
        frameId: null as number | null,
      };
      playbackAnalysisRef.current = analysis;

      const updateLevel = () => {
        if (playbackAnalysisRef.current !== analysis) return;
        analyser.getByteFrequencyData(data);
        const sum = data.reduce((acc, value) => acc + value, 0);
        const avg = sum / data.length;
        outputLevelRef.current = Math.min(1, Math.max(0, avg / 96));
        analysis.frameId = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch {
      outputLevelRef.current = 0;
    }
  }, [stopPlaybackAnalysis]);

  const interruptActivePlayback = useCallback((result: TtsPlaybackResult) => {
    const activePlayback = activePlaybackRef.current;
    activePlaybackRef.current = null;
    setIsPlaying(false);
    stopPlaybackAnalysis();
    if (activePlayback) {
      activePlayback.resolve(result);
    }
    setLoading(false);
  }, [stopPlaybackAnalysis]);

  const stop = useCallback(() => {
    activeRequestIdRef.current += 1;
    interruptActivePlayback("interrupted");
  }, [interruptActivePlayback]);

  const playAudioBlob = useCallback(
    async (blob: Blob, requestId: number): Promise<TtsPlaybackResult> => {
      if (requestId !== activeRequestIdRef.current) return "interrupted";

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);

      return await new Promise<TtsPlaybackResult>((resolve, reject) => {
        let settled = false;
        let cleanedUp = false;

        const cleanup = (reason: "completed" | "interrupted" | "error") => {
          if (cleanedUp) return;
          cleanedUp = true;
          audio.removeEventListener("ended", handleEnded);
          audio.removeEventListener("error", handleError);
          setIsPlaying(false);
          stopPlaybackAnalysis();
          if (reason !== "completed") {
            audio.pause();
            audio.currentTime = 0;
          }
          audio.src = "";
          URL.revokeObjectURL(url);
          if (activePlaybackRef.current?.requestId === requestId) {
            activePlaybackRef.current = null;
          }
        };

        const settle = (result: TtsPlaybackResult) => {
          if (settled) return;
          if (result === "completed") {
            handleEnded();
            return;
          }
          settled = true;
          cleanup("interrupted");
          resolve(result);
        };

        const fail = (reason: unknown) => {
          if (settled) return;
          settled = true;
          cleanup("error");
          reject(reason instanceof Error ? reason : new Error("Audio playback failed"));
        };

        const handleEnded = () => {
          if (settled) return;
          settled = true;
          if (activePlaybackRef.current?.requestId === requestId) {
            activePlaybackRef.current = null;
          }
          void waitForAudioTailFlush().finally(() => {
            cleanup("completed");
            resolve("completed");
          });
        };

        const handleError = () => {
          fail(new Error("Audio playback failed"));
        };

        activePlaybackRef.current = { requestId, resolve: settle };
        audio.addEventListener("ended", handleEnded, { once: true });
        audio.addEventListener("error", handleError, { once: true });
        audio
          .play()
          .then(() => {
            if (settled || requestId !== activeRequestIdRef.current) {
              settle("interrupted");
              return;
            }
            setIsPlaying(true);
            void startPlaybackAnalysis(audio);
          })
          .catch(fail);
      });
    },
    [startPlaybackAnalysis, stopPlaybackAnalysis]
  );

  const play = useCallback(async (text: string, locale: InterviewLocale = "en"): Promise<TtsPlaybackResult> => {
    const trimmedText = text.trim();
    if (!trimmedText) return "not_played";

    const sourceText = locale === "tr" ? text : trimmedText;
    const speechChunks = locale === "tr" ? [sourceText] : splitTextIntoSpeechChunks(sourceText, locale);
    if (speechChunks.length === 0) return "not_played";

    const utteranceKey = `${locale}:${speechChunks.join(" || ")}`;
    const now = Date.now();
    // Prevent accidental rapid-fire requests (common during transition states).
    if (now - lastCallAtRef.current < 900) return "not_played";
    // Prevent replaying the exact same text immediately.
    if (utteranceKey === lastUtteranceRef.current && now - lastCallAtRef.current < 3500) return "not_played";
    lastCallAtRef.current = now;
    lastUtteranceRef.current = utteranceKey;
    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;
    interruptActivePlayback("interrupted");

    setLoading(true);
    setIsPlaying(false);
    setError(null);
    outputLevelRef.current = 0;

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(
          speechChunks.length > 1 ? { chunks: speechChunks, locale } : { text: speechChunks[0], locale }
        ),
      });

      // A newer request took over while this one was in flight.
      if (requestId !== activeRequestIdRef.current) return "interrupted";

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const raw = (data as { error?: string }).error ?? "";
        const friendly = formatTtsError(raw) || `HTTP ${res.status}`;
        if (res.status === 429 || /too many requests/i.test(friendly)) {
          // Rate limit is an expected transient condition; don't report as exception.
          captureMessage("TTS rate-limited on client", {
            route: "client/useTTS",
            aiInterview: { stage: "generation", reason: "tts_error" },
            level: "warning",
          });
          return "not_played";
        }
        throw new Error(friendly);
      }

      const contentType = res.headers.get("Content-Type") || "";
      const blobs = contentType.includes("application/json")
        ? ((await res.json()) as { audioChunks?: string[] }).audioChunks?.map((chunk) => base64ToBlob(chunk)) ?? []
        : [await res.blob()];

      if (requestId !== activeRequestIdRef.current) return "interrupted";
      if (blobs.length === 0) {
        throw new Error("TTS request failed");
      }

      for (let i = 0; i < blobs.length; i += 1) {
        const playbackResult = await playAudioBlob(blobs[i]!, requestId);
        if (playbackResult !== "completed") {
          return playbackResult;
        }

        if (i < speechChunks.length - 1) {
          await wait(getSpeechChunkPauseMs(speechChunks[i]!));
          if (requestId !== activeRequestIdRef.current) return "interrupted";
        }
      }

      return "completed";
    } catch (e) {
      setError(mapTtsUserError(e instanceof Error ? e.message : ""));
      captureException(e, {
        route: "client/useTTS",
        aiInterview: { stage: "generation", reason: "tts_error" },
      });
      if (requestId === activeRequestIdRef.current) {
        setLoading(false);
      }
      return "not_played";
    } finally {
      if (requestId === activeRequestIdRef.current && activePlaybackRef.current == null) {
        setLoading(false);
      }
    }
  }, [interruptActivePlayback, playAudioBlob]);

  return { play, stop, loading, isPlaying, error, getOutputLevel: () => outputLevelRef.current };
}
