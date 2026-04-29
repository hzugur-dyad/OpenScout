export type InterviewTranscriptEntry = {
  role: "user" | "assistant";
  content: string;
};

export function normalizeInterviewTranscriptText(text: string): string {
  return text.replace(/\r\n/g, "\n").split("\n").map((line) => line.trimEnd()).join("\n").trim();
}

export function buildInterviewTranscript(entries: ReadonlyArray<InterviewTranscriptEntry>): string {
  return normalizeInterviewTranscriptText(entries.map((entry) => `${entry.role}: ${entry.content}`).join("\n"));
}
