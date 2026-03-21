"use client";

import { useState, useCallback, useRef } from "react";
import type { InterviewLocale } from "@/lib/interview-locale";
import { captureException } from "@/lib/monitoring";

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
    if (!text.trim()) return;

    stop();

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), locale }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const raw = (data as { error?: string }).error ?? `TTS failed: ${res.status}`;
        const friendly = formatTtsError(raw);
        throw new Error(friendly);
      }

      const blob = await res.blob();
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
      setError(e instanceof Error ? e.message : "TTS failed");
      captureException(e, {
        route: "client/useTTS",
        aiInterview: { stage: "generation", reason: "tts_error" },
      });
    } finally {
      stop();
    }
  }, [stop]);

  return { play, stop, loading, error };
}
