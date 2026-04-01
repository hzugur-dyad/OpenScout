import type { ChatCompletionCreateParamsNonStreaming } from "groq-sdk/resources/chat/completions";
import { GROQ_JSON_OBJECT_RESPONSE_FORMAT } from "@/lib/ai/prompts";
import { getGroq } from "@/lib/groq";
import {
  GROQ_MOCK_INTERVIEW_SCORING_MODEL,
  GROQ_MOCK_INTERVIEW_THINKING_MODEL,
} from "@/lib/mock-interview/versioning";

export type GroqMessage = ChatCompletionCreateParamsNonStreaming["messages"][number];

export function getGroqThinkingModel(): string {
  return GROQ_MOCK_INTERVIEW_THINKING_MODEL;
}

export function getGroqScoringModel(): string {
  return GROQ_MOCK_INTERVIEW_SCORING_MODEL;
}

export async function createGroqJsonCompletion(args: {
  model: string;
  messages: GroqMessage[];
  temperature: number;
}): Promise<string> {
  const groq = getGroq();
  const completion = await groq.chat.completions.create({
    model: args.model,
    temperature: args.temperature,
    response_format: GROQ_JSON_OBJECT_RESPONSE_FORMAT,
    messages: args.messages,
  });

  return completion.choices[0]?.message?.content?.trim() ?? "";
}
