export const AUDIO_SILENCE_TIMEOUT_MS = 4_000;
export const AUDIO_SPEECH_DEBOUNCE_MS = 180;
export const AUDIO_NOISE_FLOOR_ALPHA = 0.08;
export const AUDIO_NOISE_FLOOR_MAX = 0.014;
export const AUDIO_SPEECH_HOLD_THRESHOLD_MIN = 0.012;
export const AUDIO_SPEECH_HOLD_THRESHOLD_MAX = 0.024;
export const AUDIO_SPEECH_START_THRESHOLD_MIN = 0.018;
export const AUDIO_SPEECH_START_THRESHOLD_MAX = 0.032;
export const AUDIO_SPEECH_HOLD_MULTIPLIER = 1.8;
export const AUDIO_SPEECH_START_MULTIPLIER = 1.35;

export type AudioSpeechState = {
  noiseFloor: number | null;
  speechCandidateStartedAt: number | null;
  isSpeechActive: boolean;
};

export type AudioSpeechThresholds = {
  holdThreshold: number;
  startThreshold: number;
};

export type AudioSpeechDecision = {
  nextState: AudioSpeechState;
  thresholds: AudioSpeechThresholds;
  shouldRefreshSpeech: boolean;
  didSpeechEnd: boolean;
};

export function createAudioSpeechState(): AudioSpeechState {
  return {
    noiseFloor: null,
    speechCandidateStartedAt: null,
    isSpeechActive: false,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function calculateByteTimeDomainRms(data: ArrayLike<number>): number {
  if (!data.length) return 0;

  let sum = 0;
  for (let index = 0; index < data.length; index += 1) {
    const value = data[index] ?? 128;
    const normalized = (value - 128) / 128;
    sum += normalized * normalized;
  }

  return Math.sqrt(sum / data.length);
}

export function deriveAudioSpeechThresholds(noiseFloor: number | null): AudioSpeechThresholds {
  const baseNoiseFloor = clamp(noiseFloor ?? 0, 0, AUDIO_NOISE_FLOOR_MAX);
  const holdThreshold = clamp(
    Math.max(AUDIO_SPEECH_HOLD_THRESHOLD_MIN, baseNoiseFloor * AUDIO_SPEECH_HOLD_MULTIPLIER),
    AUDIO_SPEECH_HOLD_THRESHOLD_MIN,
    AUDIO_SPEECH_HOLD_THRESHOLD_MAX
  );
  const startThreshold = clamp(
    Math.max(AUDIO_SPEECH_START_THRESHOLD_MIN, holdThreshold * AUDIO_SPEECH_START_MULTIPLIER),
    AUDIO_SPEECH_START_THRESHOLD_MIN,
    AUDIO_SPEECH_START_THRESHOLD_MAX
  );

  return {
    holdThreshold,
    startThreshold,
  };
}

function updateNoiseFloor(previous: number | null, rms: number): number | null {
  if (rms > AUDIO_NOISE_FLOOR_MAX) {
    return previous;
  }

  if (previous === null) {
    return rms;
  }

  return previous + (rms - previous) * AUDIO_NOISE_FLOOR_ALPHA;
}

export function analyzeAudioLevel(params: {
  state: AudioSpeechState;
  rms: number;
  now: number;
}): AudioSpeechDecision {
  const { state, rms, now } = params;
  const thresholds = deriveAudioSpeechThresholds(state.noiseFloor);

  if (state.isSpeechActive) {
    if (rms >= thresholds.holdThreshold) {
      return {
        nextState: {
          noiseFloor: state.noiseFloor,
          speechCandidateStartedAt: null,
          isSpeechActive: true,
        },
        thresholds,
        shouldRefreshSpeech: true,
        didSpeechEnd: false,
      };
    }

    return {
      nextState: {
        noiseFloor: updateNoiseFloor(state.noiseFloor, rms),
        speechCandidateStartedAt: null,
        isSpeechActive: false,
      },
      thresholds,
      shouldRefreshSpeech: false,
      didSpeechEnd: true,
    };
  }

  if (rms >= thresholds.startThreshold) {
    const speechCandidateStartedAt = state.speechCandidateStartedAt ?? now;
    if (now - speechCandidateStartedAt >= AUDIO_SPEECH_DEBOUNCE_MS) {
      return {
        nextState: {
          noiseFloor: state.noiseFloor,
          speechCandidateStartedAt: null,
          isSpeechActive: true,
        },
        thresholds,
        shouldRefreshSpeech: true,
        didSpeechEnd: false,
      };
    }

    return {
      nextState: {
        noiseFloor: state.noiseFloor,
        speechCandidateStartedAt,
        isSpeechActive: false,
      },
      thresholds,
      shouldRefreshSpeech: false,
      didSpeechEnd: false,
    };
  }

  return {
    nextState: {
      noiseFloor: updateNoiseFloor(state.noiseFloor, rms),
      speechCandidateStartedAt: null,
      isSpeechActive: false,
    },
    thresholds,
    shouldRefreshSpeech: false,
    didSpeechEnd: false,
  };
}
