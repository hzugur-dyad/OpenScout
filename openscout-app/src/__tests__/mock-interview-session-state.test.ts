import { describe, expect, it } from "vitest";
import {
  canUseManualMicCommit,
  getNextSilenceTransition,
  isMicLocked,
} from "@/lib/mock-interview/session-state";

describe("mock interview session state helpers", () => {
  it("repeats once on the first silent listen window and escalates on the second", () => {
    expect(getNextSilenceTransition(0)).toEqual({
      nextStrike: 1,
      turnKind: "silence",
    });

    expect(getNextSilenceTransition(1)).toEqual({
      nextStrike: 0,
      turnKind: "silence_escalate",
    });
  });

  it("locks the mic while Nova is speaking or thinking", () => {
    expect(
      isMicLocked({
        step: "interview",
        isSessionReady: true,
        isListening: false,
        isAiResponding: true,
        isAiSpeaking: false,
      })
    ).toBe(true);

    expect(
      isMicLocked({
        step: "interview",
        isSessionReady: true,
        isListening: false,
        isAiResponding: false,
        isAiSpeaking: true,
      })
    ).toBe(true);
  });

  it("unlocks the mic once the session is ready and Nova is done speaking", () => {
    expect(
      isMicLocked({
        step: "interview",
        isSessionReady: true,
        isListening: false,
        isAiResponding: false,
        isAiSpeaking: false,
      })
    ).toBe(false);
  });

  it("allows manual mic tap only while already listening", () => {
    expect(
      canUseManualMicCommit({
        step: "interview",
        isSessionReady: true,
        isListening: false,
        isAiResponding: false,
        isAiSpeaking: false,
      })
    ).toBe(false);

    expect(
      canUseManualMicCommit({
        step: "interview",
        isSessionReady: true,
        isListening: true,
        isAiResponding: false,
        isAiSpeaking: false,
      })
    ).toBe(true);
  });
});
