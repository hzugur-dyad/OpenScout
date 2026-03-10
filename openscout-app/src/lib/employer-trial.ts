const TRIAL_DURATION_DAYS = 7;

export function getTrialStatus(trialStartedAt: string | null): {
  isInTrial: boolean;
  daysLeft: number;
  trialExpired: boolean;
} {
  if (!trialStartedAt) {
    return { isInTrial: false, daysLeft: 0, trialExpired: true };
  }

  const start = new Date(trialStartedAt).getTime();
  const now = Date.now();
  const elapsed = now - start;
  const totalMs = TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;
  const remaining = totalMs - elapsed;

  if (remaining <= 0) {
    return { isInTrial: false, daysLeft: 0, trialExpired: true };
  }

  return {
    isInTrial: true,
    daysLeft: Math.ceil(remaining / (24 * 60 * 60 * 1000)),
    trialExpired: false,
  };
}
