import { describe, expect, it } from "vitest";

import {
  AUDIO_SPEECH_DEBOUNCE_MS,
  analyzeAudioLevel,
  calculateByteTimeDomainRms,
  createAudioSpeechState,
  deriveAudioSpeechThresholds,
} from "@/lib/mock-interview/speech-silence";

describe("calculateByteTimeDomainRms", () => {
  it("returns zero for silence", () => {
    const samples = new Uint8Array(32).fill(128);

    expect(calculateByteTimeDomainRms(samples)).toBe(0);
  });

  it("returns a positive rms for non-silent samples", () => {
    const samples = new Uint8Array([128, 128, 160, 96, 160, 96, 128, 128]);

    expect(calculateByteTimeDomainRms(samples)).toBeGreaterThan(0.15);
  });
});

describe("deriveAudioSpeechThresholds", () => {
  it("uses low defaults when there is no ambient noise baseline", () => {
    expect(deriveAudioSpeechThresholds(null)).toEqual({
      holdThreshold: 0.012,
      startThreshold: 0.018,
    });
  });

  it("raises thresholds as the tracked noise floor rises", () => {
    const quiet = deriveAudioSpeechThresholds(0.003);
    const noisy = deriveAudioSpeechThresholds(0.012);

    expect(noisy.holdThreshold).toBeGreaterThan(quiet.holdThreshold);
    expect(noisy.startThreshold).toBeGreaterThan(quiet.startThreshold);
  });
});

describe("analyzeAudioLevel", () => {
  it("ignores short spikes that do not survive the debounce window", () => {
    const baseState = createAudioSpeechState();
    const firstFrame = analyzeAudioLevel({
      state: baseState,
      rms: 0.024,
      now: 1_000,
    });
    const spikeEnd = analyzeAudioLevel({
      state: firstFrame.nextState,
      rms: 0.011,
      now: 1_000 + AUDIO_SPEECH_DEBOUNCE_MS - 20,
    });

    expect(firstFrame.shouldRefreshSpeech).toBe(false);
    expect(spikeEnd.shouldRefreshSpeech).toBe(false);
    expect(spikeEnd.nextState.isSpeechActive).toBe(false);
  });

  it("requires sustained speech before refreshing the silence clock", () => {
    const baseState = createAudioSpeechState();
    const candidate = analyzeAudioLevel({
      state: baseState,
      rms: 0.024,
      now: 2_000,
    });
    const qualified = analyzeAudioLevel({
      state: candidate.nextState,
      rms: 0.024,
      now: 2_000 + AUDIO_SPEECH_DEBOUNCE_MS,
    });

    expect(candidate.shouldRefreshSpeech).toBe(false);
    expect(qualified.shouldRefreshSpeech).toBe(true);
    expect(qualified.nextState.isSpeechActive).toBe(true);
  });

  it("marks the end of speech once levels fall below the hold threshold", () => {
    const activeState = {
      noiseFloor: 0.004,
      speechCandidateStartedAt: null,
      isSpeechActive: true,
    };

    const decision = analyzeAudioLevel({
      state: activeState,
      rms: 0.005,
      now: 3_000,
    });

    expect(decision.didSpeechEnd).toBe(true);
    expect(decision.shouldRefreshSpeech).toBe(false);
    expect(decision.nextState.isSpeechActive).toBe(false);
  });
});
