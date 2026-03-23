/** Client-safe copy helpers for Scout Pass / Scout Score sharing. */

export function scoutPassLinkedinText(url: string): string {
  return `I earned an AI-verified Scout Score on OpenScout — one credential recruiters can trust. See the credential and start your own: ${url}`;
}

export function scoutPassTwitterText(url: string): string {
  return `AI-verified Scout Score on OpenScout — interview readiness in one link. Get yours: ${url}`;
}
