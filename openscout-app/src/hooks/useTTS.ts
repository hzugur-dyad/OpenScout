"use client";

import { useState, useCallback, useRef } from "react";
import type { InterviewLocale } from "@/lib/interview-locale";
import { captureException, captureMessage } from "@/lib/monitoring";
import { mapTtsUserError } from "@/lib/user-facing-errors";

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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const activeRequestIdRef = useRef(0);
  const lastCallAtRef = useRef(0);
  const lastUtteranceRef = useRef<string>("");

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setLoading(false);
  }, []);

  const play = useCallback(async (text: string, locale: InterviewLocale = "en") => {
    const trimmedText = text.trim();
    if (!trimmedText) return;

    const utteranceKey = `${locale}:${trimmedText}`;
    const now = Date.now();
    // Prevent accidental rapid-fire requests (common during transition states).
    if (now - lastCallAtRef.current < 900) return;
    // Prevent replaying the exact same text immediately.
    if (utteranceKey === lastUtteranceRef.current && now - lastCallAtRef.current < 3500) return;
    lastCallAtRef.current = now;
    lastUtteranceRef.current = utteranceKey;
    const requestId = ++activeRequestIdRef.current;

    stop();

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmedText, locale }),
      });

      // A newer request took over while this one was in flight.
      if (requestId !== activeRequestIdRef.current) return;

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
          return;
        }
        throw new Error(friendly);
      }

      const blob = await res.blob();
      if (requestId !== activeRequestIdRef.current) return;
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      await new Promise<void>((resolve, reject) => {
        audio.onended = () => {
          resolve();
        };
        audio.onerror = () => {
          reject(new Error("Audio playback failed"));
        };
        audio.play().catch(reject);
      });
    } catch (e) {
      setError(mapTtsUserError(e instanceof Error ? e.message : ""));
      captureException(e, {
        route: "client/useTTS",
        aiInterview: { stage: "generation", reason: "tts_error" },
      });
    } finally {
      if (requestId === activeRequestIdRef.current) {
        stop();
      }
    }
  }, [stop]);

  return { play, stop, loading, error };
}
