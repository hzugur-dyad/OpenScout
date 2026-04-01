export type ExpectedRealtimeControl = {
  questionId: string;
  attempt: number;
  isFollowup: boolean;
  shouldEnd: boolean;
  endReason: string | null;
};

export type ModelRealtimeControl = {
  questionId: string;
  attempt: number;
  isFollowup: boolean;
  shouldEnd: boolean;
  endReason: string | null;
};

export type RealtimeControlResolution = {
  effectiveControl: ExpectedRealtimeControl | ModelRealtimeControl | null;
  mismatch: boolean;
};

function normalizeReason(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function isSameControl(
  expected: ExpectedRealtimeControl,
  actual: ModelRealtimeControl
): boolean {
  return (
    expected.questionId === actual.questionId &&
    expected.attempt === actual.attempt &&
    expected.isFollowup === actual.isFollowup &&
    expected.shouldEnd === actual.shouldEnd &&
    normalizeReason(expected.endReason) === normalizeReason(actual.endReason)
  );
}

export function resolveAuthoritativeRealtimeControl(args: {
  expectedControl: ExpectedRealtimeControl | null;
  modelControl: ModelRealtimeControl | null;
}): RealtimeControlResolution {
  const { expectedControl, modelControl } = args;
  if (expectedControl && modelControl) {
    return {
      effectiveControl: isSameControl(expectedControl, modelControl) ? modelControl : expectedControl,
      mismatch: !isSameControl(expectedControl, modelControl),
    };
  }

  if (expectedControl) {
    return {
      effectiveControl: expectedControl,
      mismatch: false,
    };
  }

  return {
    effectiveControl: modelControl,
    mismatch: false,
  };
}
