import "server-only";

import Groq from "groq-sdk";

import {
  classifyStandardProviderFailoverError,
  hasProviderApiKeys,
  type ProviderKeyEnvConfig,
  withProviderKeyFailover,
} from "@/lib/provider-key-failover";

export const GROQ_KEY_ENV_CONFIG: ProviderKeyEnvConfig = {
  provider: "groq",
  singleKeyEnv: "GROQ_API_KEY",
  multiKeyEnv: "GROQ_API_KEYS",
  indexedKeyEnvPrefix: "GROQ_API_KEY_",
  notConfiguredMessage:
    "Groq API keys are not configured. Set GROQ_API_KEY, GROQ_API_KEYS, or indexed GROQ_API_KEY_1 style variables.",
};

type GroqChatCompletionCreate = Groq["chat"]["completions"]["create"];

type GroqClientLike = {
  chat: {
    completions: {
      create: GroqChatCompletionCreate;
    };
  };
};

export function hasGroqApiKeysConfigured(): boolean {
  return hasProviderApiKeys(GROQ_KEY_ENV_CONFIG);
}

export function getGroq(): GroqClientLike {
  return {
    chat: {
      completions: {
        create: (async (...args: Parameters<GroqChatCompletionCreate>) =>
          withProviderKeyFailover({
            config: GROQ_KEY_ENV_CONFIG,
            operationName: "groq.chat.completions.create",
            classifyError: classifyStandardProviderFailoverError,
            execute: async ({ key }) => {
              const client = new Groq({ apiKey: key });
              return client.chat.completions.create(...args);
            },
          })) as GroqChatCompletionCreate,
      },
    },
  };
}
