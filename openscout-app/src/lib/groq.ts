import Groq from "groq-sdk";

function getGroq(): Groq {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not configured");
  return new Groq({ apiKey: key });
}

export { getGroq };
