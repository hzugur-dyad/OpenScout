"use client";

import { useState, useCallback, useRef } from "react";
import type { InterviewLocale } from "@/lib/interview-locale";
import { captureException, captureMessage } from "@/lib/monitoring";
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

export function useTTS() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRequestIdRef = useRef(0);
  const lastCallAtRef = useRef(0);
  const lastUtteranceRef = useRef<string>("");
  const activePlaybackRef = useRef<{
    requestId: number;
    resolve: (result: TtsPlaybackResult) => void;
  } | null>(null);

  const interruptActivePlayback = useCallback((result: TtsPlaybackResult) => {
    const activePlayback = activePlaybackRef.current;
    activePlaybackRef.current = null;
    if (activePlayback) {
      activePlayback.resolve(result);
    }
    setLoading(false);
  }, []);

  const stop = useCallback(() => {
    activeRequestIdRef.current += 1;
    interruptActivePlayback("interrupted");
  }, [interruptActivePlayback]);

  const play = useCallback(async (text: string, locale: InterviewLocale = "en"): Promise<TtsPlaybackResult> => {
    const trimmedText = text.trim();
    if (!trimmedText) return "not_played";

    const utteranceKey = `${locale}:${trimmedText}`;
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
    setError(null);

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmedText, locale }),
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

      const blob = await res.blob();
      if (requestId !== activeRequestIdRef.current) return "interrupted";
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);

      return await new Promise<TtsPlaybackResult>((resolve, reject) => {
        let settled = false;
        let cleanedUp = false;

        const cleanup = () => {
          if (cleanedUp) return;
          cleanedUp = true;
          audio.removeEventListener("ended", handleEnded);
          audio.removeEventListener("error", handleError);
          audio.pause();
          audio.currentTime = 0;
          audio.src = "";
          URL.revokeObjectURL(url);
          if (activePlaybackRef.current?.requestId === requestId) {
            activePlaybackRef.current = null;
          }
          if (requestId === activeRequestIdRef.current) {
            setLoading(false);
          }
        };

        const settle = (result: TtsPlaybackResult) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(result);
        };

        const fail = (reason: unknown) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(reason instanceof Error ? reason : new Error("Audio playback failed"));
        };

        const handleEnded = () => {
          settle("completed");
        };

        const handleError = () => {
          fail(new Error("Audio playback failed"));
        };

        activePlaybackRef.current = { requestId, resolve: settle };
        audio.addEventListener("ended", handleEnded, { once: true });
        audio.addEventListener("error", handleError, { once: true });
        audio.play().catch(fail);
      });
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
  }, [interruptActivePlayback]);

  return { play, stop, loading, error };
}
