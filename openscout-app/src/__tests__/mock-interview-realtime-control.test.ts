import { describe, expect, it } from "vitest";
import { resolveAuthoritativeRealtimeControl } from "@/lib/mock-interview/realtime-control";

describe("resolveAuthoritativeRealtimeControl", () => {
  it("uses the model control when it matches the server plan", () => {
    const resolved = resolveAuthoritativeRealtimeControl({
      expectedControl: {
        questionId: "q_01_generated",
        attempt: 1,
        isFollowup: false,
        shouldEnd: false,
        endReason: null,
      },
      modelControl: {
        questionId: "q_01_generated",
        attempt: 1,
        isFollowup: false,
        shouldEnd: false,
        endReason: "",
      },
    });

    expect(resolved.mismatch).toBe(false);
    expect(resolved.effectiveControl).toEqual({
      questionId: "q_01_generated",
      attempt: 1,
      isFollowup: false,
      shouldEnd: false,
      endReason: "",
    });
  });

  it("keeps the server control when the realtime tool output conflicts", () => {
    const expectedControl = {
      questionId: "q_02_generated",
      attempt: 1,
      isFollowup: false,
      shouldEnd: false,
      endReason: null,
    };

    const resolved = resolveAuthoritativeRealtimeControl({
      expectedControl,
      modelControl: {
        questionId: "q_01_generated",
        attempt: 2,
        isFollowup: true,
        shouldEnd: false,
        endReason: null,
      },
    });

    expect(resolved.mismatch).toBe(true);
    expect(resolved.effectiveControl).toEqual(expectedControl);
  });

  it("falls back to the expected server control when the tool call is missing", () => {
    const expectedControl = {
      questionId: "q_03_generated",
      attempt: 1,
      isFollowup: false,
      shouldEnd: true,
      endReason: "target_questions_completed",
    };

    const resolved = resolveAuthoritativeRealtimeControl({
      expectedControl,
      modelControl: null,
    });

    expect(resolved.mismatch).toBe(false);
    expect(resolved.effectiveControl).toEqual(expectedControl);
  });
});
