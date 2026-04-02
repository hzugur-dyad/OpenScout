import "server-only";

import { logInfo, logWarn } from "@/lib/logger";

const DEFAULT_PROVIDER_KEY_COOLDOWN_MS = 5 * 60 * 1000;

export type ProviderKeyEnvConfig = {
  provider: string;
  singleKeyEnv: string;
  multiKeyEnv: string;
  indexedKeyEnvPrefix: string;
  notConfiguredMessage: string;
  cooldownMs?: number;
};

export type ProviderKeyHandle = {
  index: number;
  key: string;
  maskedKey: string;
  sourceEnv: string;
};

export type ProviderKeyFailoverDecision =
  | {
      retryable: true;
      errorType: "invalid_key" | "quota_exceeded" | "rate_limited" | "billing" | "provider_quota";
      status?: number;
      cooldownMs?: number;
    }
  | {
      retryable: false;
    };

type ProviderPoolState = {
  signature: string;
  currentKeyIndex: number;
  cooldownUntilByKeyIndex: Map<number, number>;
};

const providerPoolState = new Map<string, ProviderPoolState>();

export function __resetProviderKeyFailoverStateForTests(): void {
  providerPoolState.clear();
}

export class MissingProviderApiKeysError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingProviderApiKeysError";
  }
}

export class ProviderKeysCoolingDownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderKeysCoolingDownError";
  }
}

export class ProviderRequestError extends Error {
  readonly provider: string;
  readonly status?: number;
  readonly code?: string;

  constructor(args: { provider: string; message: string; status?: number; code?: string }) {
    super(args.message);
    this.name = "ProviderRequestError";
    this.provider = args.provider;
    this.status = args.status;
    this.code = args.code;
  }
}

function trimKey(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function maskKey(key: string): string {
  if (key.length <= 8) return "*".repeat(key.length);
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

function parseCommaSeparatedKeys(raw: string, sourceEnv: string): Array<{ key: string; sourceEnv: string }> {
  return raw
    .split(",")
    .map((entry) => trimKey(entry))
    .filter((entry): entry is string => Boolean(entry))
    .map((key) => ({ key, sourceEnv }));
}

function parseIndexedKeys(prefix: string): Array<{ key: string; sourceEnv: string }> {
  return Object.entries(process.env)
    .filter(([name, value]) => {
      if (!name.startsWith(prefix)) return false;
      if (!/^\d+$/.test(name.slice(prefix.length))) return false;
      return Boolean(trimKey(value));
    })
    .sort(([left], [right]) => Number(left.slice(prefix.length)) - Number(right.slice(prefix.length)))
    .map(([sourceEnv, value]) => ({ key: String(value).trim(), sourceEnv }));
}

function buildProviderSignature(keys: ProviderKeyHandle[]): string {
  return keys.map((entry) => entry.key).join("\u0000");
}

function getProviderPoolState(config: ProviderKeyEnvConfig, keys: ProviderKeyHandle[]): ProviderPoolState {
  const signature = buildProviderSignature(keys);
  const existing = providerPoolState.get(config.provider);
  if (existing && existing.signature === signature) {
    if (existing.currentKeyIndex >= keys.length) {
      existing.currentKeyIndex = 0;
    }
    return existing;
  }

  const created: ProviderPoolState = {
    signature,
    currentKeyIndex: 0,
    cooldownUntilByKeyIndex: new Map<number, number>(),
  };
  providerPoolState.set(config.provider, created);
  return created;
}

function buildCandidateOrder(length: number, startIndex: number): number[] {
  const normalizedStart = startIndex >= 0 ? startIndex % length : 0;
  return Array.from({ length }, (_, offset) => (normalizedStart + offset) % length);
}

function getAvailableCandidateOrder(state: ProviderPoolState, keys: ProviderKeyHandle[]): number[] {
  const ordered = buildCandidateOrder(keys.length, state.currentKeyIndex);
  const now = Date.now();
  return ordered.filter((keyIndex) => (state.cooldownUntilByKeyIndex.get(keyIndex) ?? 0) <= now);
}

function readConfiguredProviderKeys(config: ProviderKeyEnvConfig): ProviderKeyHandle[] {
  const collected: Array<{ key: string; sourceEnv: string }> = [];

  const multi = trimKey(process.env[config.multiKeyEnv]);
  if (multi) {
    collected.push(...parseCommaSeparatedKeys(multi, config.multiKeyEnv));
  }

  collected.push(...parseIndexedKeys(config.indexedKeyEnvPrefix));

  const single = trimKey(process.env[config.singleKeyEnv]);
  if (single) {
    collected.push({ key: single, sourceEnv: config.singleKeyEnv });
  }

  const seen = new Set<string>();
  const deduped = collected.filter((entry) => {
    if (seen.has(entry.key)) return false;
    seen.add(entry.key);
    return true;
  });

  return deduped.map((entry, index) => ({
    index,
    key: entry.key,
    maskedKey: maskKey(entry.key),
    sourceEnv: entry.sourceEnv,
  }));
}

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const maybeError = error as { status?: unknown };
  return typeof maybeError.status === "number" ? maybeError.status : undefined;
}

function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const maybeError = error as {
    code?: unknown;
    error?: { code?: unknown; type?: unknown };
  };

  if (typeof maybeError.code === "string") return maybeError.code;
  if (typeof maybeError.error?.code === "string") return maybeError.error.code;
  if (typeof maybeError.error?.type === "string") return maybeError.error.type;
  return undefined;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (!error || typeof error !== "object") return String(error ?? "Unknown provider error");

  const maybeError = error as {
    message?: unknown;
    error?: { message?: unknown };
  };

  if (typeof maybeError.error?.message === "string") return maybeError.error.message;
  if (typeof maybeError.message === "string") return maybeError.message;
  return String(error);
}

export function hasProviderApiKeys(config: ProviderKeyEnvConfig): boolean {
  return readConfiguredProviderKeys(config).length > 0;
}

export function classifyStandardProviderFailoverError(error: unknown): ProviderKeyFailoverDecision {
  const status = getErrorStatus(error);
  const code = getErrorCode(error)?.toLowerCase() ?? "";
  const message = getErrorMessage(error).toLowerCase();

  if (status === 401 || code.includes("invalid")) {
    return { retryable: true, errorType: "invalid_key", status };
  }

  if (status === 402) {
    return { retryable: true, errorType: "quota_exceeded", status };
  }

  if (status === 429 || code.includes("rate_limit")) {
    return { retryable: true, errorType: "rate_limited", status };
  }

  if (message.includes("billing")) {
    return { retryable: true, errorType: "billing", status };
  }

  if (
    message.includes("quota") ||
    message.includes("insufficient_quota") ||
    message.includes("resource exhausted") ||
    message.includes("resource has been exhausted") ||
    message.includes("rate limit")
  ) {
    return { retryable: true, errorType: "provider_quota", status };
  }

  return { retryable: false };
}

export async function withProviderKeyFailover<T>(args: {
  config: ProviderKeyEnvConfig;
  operationName: string;
  classifyError?: (error: unknown) => ProviderKeyFailoverDecision;
  execute: (key: ProviderKeyHandle) => Promise<T>;
}): Promise<T> {
  const { config, operationName, execute } = args;
  const classifyError = args.classifyError ?? classifyStandardProviderFailoverError;
  const keys = readConfiguredProviderKeys(config);

  if (keys.length === 0) {
    throw new MissingProviderApiKeysError(config.notConfiguredMessage);
  }

  const state = getProviderPoolState(config, keys);
  const candidates = getAvailableCandidateOrder(state, keys);

  if (candidates.length === 0) {
    logWarn(`${config.provider} API keys are cooling down`, {
      provider: config.provider,
      operation: operationName,
      configured_key_count: keys.length,
    });
    throw new ProviderKeysCoolingDownError(
      `${config.provider} API keys are temporarily unavailable because all configured keys are cooling down.`,
    );
  }

  const originalIndex = state.currentKeyIndex % keys.length;
  let lastRetryableError: unknown;

  for (const keyIndex of candidates) {
    const activeKey = keys[keyIndex];

    try {
      const result = await execute(activeKey);
      state.cooldownUntilByKeyIndex.delete(keyIndex);
      if (state.currentKeyIndex !== keyIndex) {
        state.currentKeyIndex = keyIndex;
      }
      if (keyIndex !== originalIndex) {
        logInfo(`${config.provider} switched to backup key #${activeKey.index + 1}`, {
          provider: config.provider,
          operation: operationName,
          key_index: activeKey.index + 1,
          masked_key: activeKey.maskedKey,
        });
      }
      return result;
    } catch (error) {
      const decision = classifyError(error);
      if (!decision.retryable) {
        throw error;
      }

      lastRetryableError = error;
      state.currentKeyIndex = (keyIndex + 1) % keys.length;
      state.cooldownUntilByKeyIndex.set(
        keyIndex,
        Date.now() + (decision.cooldownMs ?? config.cooldownMs ?? DEFAULT_PROVIDER_KEY_COOLDOWN_MS),
      );

      logWarn(`${config.provider} API key failed`, {
        provider: config.provider,
        operation: operationName,
        key_index: activeKey.index + 1,
        masked_key: activeKey.maskedKey,
        source_env: activeKey.sourceEnv,
        error_type: decision.errorType,
        status: decision.status,
      });
    }
  }

  logWarn(`${config.provider} exhausted all configured API keys`, {
    provider: config.provider,
    operation: operationName,
    configured_key_count: keys.length,
  });

  throw lastRetryableError instanceof Error
    ? lastRetryableError
    : new ProviderKeysCoolingDownError(`${config.provider} API keys are temporarily unavailable.`);
}
