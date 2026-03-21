#!/usr/bin/env node
/**
 * OpenScout environment validation (CI + optional production gate).
 *
 * Profiles (OPENSCOUT_ENV_PROFILE or --profile=):
 *   local       — report only; always exits 0 (default)
 *   ci          — fail if required CI/build variables are missing or blank
 *   production  — fail if production looks misconfigured (placeholders, localhost app URL, etc.)
 *
 * Does not print secret values.
 */

function parseProfile(argv) {
  const fromEnv = process.env.OPENSCOUT_ENV_PROFILE?.trim().toLowerCase();
  if (fromEnv && ["local", "ci", "production"].includes(fromEnv)) return fromEnv;
  const arg = argv.find((a) => a.startsWith("--profile="));
  if (arg) {
    const p = arg.slice("--profile=".length).trim().toLowerCase();
    if (["local", "ci", "production"].includes(p)) return p;
  }
  return "local";
}

/** Variables the GitHub Actions workflow always injects (including placeholders). */
const CI_REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "GROQ_API_KEY",
  "GOOGLE_CLOUD_TTS_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_CANDIDATE_PLUS_PRICE_ID",
  "STRIPE_CANDIDATE_PRO_PRICE_ID",
  "STRIPE_EMPLOYER_GROWTH_PRICE_ID",
  "STRIPE_EMPLOYER_SCALE_PRICE_ID",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
];

/** Same keys must be real (non-placeholder) for production. */
const PRODUCTION_REQUIRED = [...CI_REQUIRED];

const PRODUCTION_OPTIONAL_FEATURES = [
  {
    name: "Sentry (errors)",
    anyOf: ["NEXT_PUBLIC_SENTRY_DSN", "SENTRY_DSN"],
  },
  {
    name: "PostHog (analytics)",
    anyOf: ["NEXT_PUBLIC_POSTHOG_KEY", "POSTHOG_KEY"],
  },
];

function isBlank(v) {
  return !String(v ?? "").trim();
}

function looksLikeCiPlaceholder(name, value) {
  const v = String(value ?? "").trim();
  if (!v) return true;
  const lower = v.toLowerCase();

  if (lower.includes("ci-placeholder")) return true;
  if (lower.includes("placeholder.supabase.co")) return true;
  if (/\.placeholder\b/i.test(v) || v.endsWith(".placeholder")) return true;

  if (name === "STRIPE_SECRET_KEY" && v === "sk_test_ci_placeholder") return true;
  if (name === "STRIPE_WEBHOOK_SECRET" && v === "whsec_ci_placeholder") return true;
  if (name.startsWith("STRIPE_") && name.endsWith("_PRICE_ID") && lower.startsWith("price_ci")) return true;

  if (name === "NEXT_PUBLIC_APP_URL") {
    if (lower === "http://localhost:3000" || lower.startsWith("http://127.0.0.1")) return true;
  }

  if (name === "GROQ_API_KEY" && v === "ci-placeholder") return true;
  if (name === "GOOGLE_CLOUD_TTS_API_KEY" && v === "ci-placeholder") return true;

  if (name === "NEXT_PUBLIC_SUPABASE_ANON_KEY" && lower.includes("placeholder")) return true;
  if (name === "SUPABASE_SERVICE_ROLE_KEY" && lower.includes("placeholder")) return true;

  return false;
}

function checkCi() {
  const missing = [];
  for (const key of CI_REQUIRED) {
    if (isBlank(process.env[key])) missing.push(key);
  }
  if (missing.length) {
    console.error(
      `[validate-env] CI profile: missing or empty variables:\n  - ${missing.join("\n  - ")}`,
    );
    process.exit(1);
  }
  console.log("[validate-env] CI profile: all required variables are set.");
}

function checkProduction() {
  const bad = [];
  for (const key of PRODUCTION_REQUIRED) {
    const val = process.env[key];
    if (isBlank(val)) bad.push(`${key} (empty)`);
    else if (looksLikeCiPlaceholder(key, val)) bad.push(`${key} (looks like a CI/placeholder value)`);
  }
  if (bad.length) {
    console.error(
      `[validate-env] production profile: fix these before shipping:\n  - ${bad.join("\n  - ")}`,
    );
    process.exit(1);
  }

  const optionalMissing = [];
  for (const { name, anyOf } of PRODUCTION_OPTIONAL_FEATURES) {
    const ok = anyOf.some((k) => !isBlank(process.env[k]));
    if (!ok) optionalMissing.push(name);
  }
  if (optionalMissing.length) {
    console.warn(
      `[validate-env] production profile: optional monitoring/analytics not configured:\n  - ${optionalMissing.join("\n  - ")}\n  (This is allowed; features stay disabled until env is set.)`,
    );
  }

  console.log("[validate-env] production profile: required variables look non-placeholder.");
}

function reportLocal() {
  console.log("[validate-env] local profile (informational only):\n");
  console.log("Required for a real production deploy (see docs/RELEASE_CHECKLIST.md):");
  for (const key of PRODUCTION_REQUIRED) {
    const set = !isBlank(process.env[key]);
    const suspicious = set && looksLikeCiPlaceholder(key, process.env[key]);
    console.log(`  ${key}: ${!set ? "MISSING" : suspicious ? "SET (suspicious / placeholder-like)" : "set"}`);
  }
  console.log("\nOptional features (any one of each group):");
  for (const { name, anyOf } of PRODUCTION_OPTIONAL_FEATURES) {
    const ok = anyOf.some((k) => !isBlank(process.env[k]));
    console.log(`  ${name}: ${ok ? "configured" : "not configured"}`);
  }
  console.log("\nRESEND: not referenced in the app codebase today; add validation here if email is introduced.");
}

const profile = parseProfile(process.argv.slice(2));

if (profile === "ci") {
  checkCi();
} else if (profile === "production") {
  checkProduction();
} else {
  reportLocal();
}


