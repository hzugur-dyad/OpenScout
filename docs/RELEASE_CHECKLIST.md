# Production release checklist (OpenScout)

Practical gate before and after shipping to production. The app lives in **`openscout-app/`**; Vercel **Root Directory** should be `openscout-app`.

---

## 1. Required environment variables (production)

Set these in **Vercel → Project → Settings → Environment Variables** for **Production** (and Preview if you test there).

| Area | Variable | Notes |
|------|----------|--------|
| **Supabase** | `NEXT_PUBLIC_SUPABASE_URL` | Real project URL (not CI placeholder host). |
| | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key. |
| | `SUPABASE_SERVICE_ROLE_KEY` | Server-only; never expose to the client. |
| **App** | `NEXT_PUBLIC_APP_URL` | Canonical public URL (e.g. `https://app.example.com`), not `http://localhost:3000`. |
| **Groq** | `GROQ_API_KEY` | Required for AI-backed flows (CV analysis, mock interview, etc.). |
| **TTS** | `GOOGLE_CLOUD_TTS_API_KEY` | Text-to-speech used in interview flows. |
| **Stripe** | `STRIPE_SECRET_KEY` | Live or test key per environment; not workflow placeholders. |
| | `STRIPE_WEBHOOK_SECRET` | From Stripe Dashboard for the deployed webhook URL. |
| | `STRIPE_CANDIDATE_PLUS_PRICE_ID` | Price IDs for candidate checkout. |
| | `STRIPE_CANDIDATE_PRO_PRICE_ID` | |
| | `STRIPE_EMPLOYER_GROWTH_PRICE_ID` | Employer checkout (`STRIPE_PRICE_ID` may alias growth). |
| | `STRIPE_EMPLOYER_SCALE_PRICE_ID` | |
| **Rate limits** | `UPSTASH_REDIS_REST_URL` | Required for distributed rate limiting in production. |
| | `UPSTASH_REDIS_REST_TOKEN` | |

### Optional (features stay off if unset)

| Area | Variable | Notes |
|------|----------|--------|
| **PostHog** | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Analytics; client uses public key. |
| **Sentry** | `NEXT_PUBLIC_SENTRY_DSN` and/or `SENTRY_DSN` | Error monitoring; server resolves either DSN. |
| | `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Source maps upload during build (optional). |
| **Resend** | — | Not used in the codebase today; if email is added, document keys here and in `scripts/validate-env.mjs`. |

---

## 2. Automated production env gate (optional)

The app pins **Build Command** in [`openscout-app/vercel.json`](../openscout-app/vercel.json) to `npm run build:vercel`, which runs [`scripts/vercel-build.mjs`](../openscout-app/scripts/vercel-build.mjs): **production env validation runs for Vercel Production only** (Preview skips it so placeholder preview env does not fail the build). Locally, `npm run build:vercel` always runs the production gate first.

Equivalent one-liner if you set the command only in the Vercel UI:

```bash
OPENSCOUT_ENV_PROFILE=production npm run validate-env && npm run build
```

This rejects obvious CI placeholders and localhost app URLs. **Do not** use this profile in local dev unless you intend to simulate production (or use `npm run build:vercel` for that).

Local informational report (always succeeds):

```bash
cd openscout-app && npm run validate-env
```

---

## 3. Required external services

- **Supabase** — Auth, database, storage as configured in the project.
- **Stripe** — Billing; webhook endpoint must match the deployed URL and signing secret.
- **Groq** — LLM API availability and quota.
- **Google Cloud TTS** — API enabled and key valid for the environment.
- **Upstash Redis** — For production rate limiting (app logs a warning if missing in production).

---

## 4. Database migrations

Apply all pending SQL migrations to the **production** Supabase project before or immediately after deploy (same order as in repo):

- Source: `openscout-app/supabase/migrations/`

Confirm critical paths that depend on recent columns/policies (employer workflow, mock interview audit, AI recommendation fields, etc.) match what production expects.

---

## 5. Smoke tests after deploy

Run through **Post-deploy smoke tests** in [docs/SMOKE_TESTS.md](./SMOKE_TESTS.md) on the production URL.

---

## 6. Monitoring

- **Sentry** — New release shows events; trigger a safe test error only in a non-user path if you use a dedicated test route (remove or protect such routes appropriately).
- **Logs** — Vercel/runtime logs for 5xx spikes after deploy.

---

## 7. Analytics

- **PostHog** — Verify events from a logged-in session (or staging) if analytics are enabled.

---

## 8. CI/CD reference

- Workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — install → validate-env (CI profile) → lint → clear `.next` → typecheck → tests → production build.
- **ESLint**: React Compiler hook rules are **warnings** (see `openscout-app/eslint.config.mjs`) so legacy patterns (effects, Three.js) do not block CI; **errors** (e.g. `prefer-const`, `react/no-unescaped-entities`) still fail the build.
- **Vercel Git integration**: deploy runs on Vercel’s side; ensure **Production Branch** is `main` and failing GitHub checks are **required** before merge (see [docs/CI_CD.md](./CI_CD.md)).
