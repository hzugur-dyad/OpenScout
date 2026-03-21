# Production Readiness Report — OpenScout

**Date:** March 2025  
**Scope:** Full repository scan, env validation, security, build, performance. No new features added.

---

## 1. Full Project Check

### Broken imports
- **None found.** All `@/` and relative imports resolve; no missing modules reported.

### Unused files
- **None identified.** All components under `src/components/` are referenced (e.g. `OnboardingStepper` → onboarding page, `InviteFriendCard` → dashboard). All API routes and pages are in use.

### Unused environment variables
- **Referenced in code:**  
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `GOOGLE_CLOUD_TTS_API_KEY`, `NEXT_PUBLIC_APP_URL` (optional fallback in scout-credential).
- **`.env.local.example`:** Does not list `GOOGLE_CLOUD_TTS_API_KEY` or `NEXT_PUBLIC_APP_URL`. **Recommendation:** Add them so production env is documented (TTS required for interview voice; `NEXT_PUBLIC_APP_URL` optional for pass URLs).

### Duplicate utilities
- **`getClientIp(request)`** is implemented in two places:
  - `src/app/api/referral/attribute/route.ts`
  - `src/app/api/tts/route.ts`  
  Same logic (x-forwarded-for, first IP, fallback `"unknown"`). **Recommendation:** Move to e.g. `src/lib/request-utils.ts` and import in both routes to avoid drift.

### Dead code
- No obvious dead code. Logger and rate-limit are used; no orphaned helpers found.

---

## 2. Environment Validation

| Variable | Used in | Required / optional |
|----------|---------|----------------------|
| **Supabase** | | |
| `NEXT_PUBLIC_SUPABASE_URL` | server.ts, client.ts, middleware | **Required** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | server.ts, client.ts, middleware | **Required** |
| `SUPABASE_SERVICE_ROLE_KEY` | server.ts (createAdminClient), scout-pass route, verify-session | **Optional** (Scout Pass public links; admin ops) |
| **Groq** | | |
| `GROQ_API_KEY` | lib/groq.ts → cv-analysis, mock-interview, mock-interview/result | **Required** |
| **Stripe** | | |
| `STRIPE_SECRET_KEY` | create-checkout-session, verify-session, stripe-webhook | **Optional** (employer subscriptions) |
| `STRIPE_PRICE_ID` | create-checkout-session | **Optional** |
| `STRIPE_WEBHOOK_SECRET` | stripe-webhook (signature verification) | **Optional** (needed if using webhooks) |
| **Google TTS** | | |
| `GOOGLE_CLOUD_TTS_API_KEY` | api/tts/route.ts | **Optional** (interview voice; 500 if missing) |
| **App URL** | | |
| `NEXT_PUBLIC_APP_URL` | scout-credential (pass URL base) | **Optional** (falls back to `request.nextUrl.origin`) |
| **Upstash (rate limits)** | | |
| `UPSTASH_REDIS_REST_URL` | `src/lib/rate-limit.ts` | **Recommended in production** (limits disabled if missing) |
| `UPSTASH_REDIS_REST_TOKEN` | `src/lib/rate-limit.ts` | **Recommended in production** (both required for Redis) |

---

## 3. Security Check

### Auth checks in APIs
- **Authenticated routes** (require user):  
  referral/attribute, job-applications, mock-interview, mock-interview/result, cv-analysis, tts (rate key by user or IP), employer/create-checkout-session, employer/verify-session, scout-credential, referral/my-code.  
  All use `createClient()` + `supabase.auth.getUser()` and return 401 when no user.
- **Stripe webhook:** No user auth; uses `stripe.webhooks.constructEvent(body, signature, webhookSecret)` to verify request.
- **Scout-pass [slug] (GET):** Public by design; uses service role to read credential by slug (no auth).

### RLS coverage
- **profiles, work_experiences, educations, job_preferences, professional_links, cv_analyses, mock_interviews, job_applications:** Own-row policies (user_id = auth.uid() or equivalent).
- **companies, job_listings:** Owner policies; job_listings has public SELECT for `is_active = true`.
- **job_applications:** Employers can view only for their listings; migration 010 restricts to companies with `stripe_subscription_status = 'active'`.
- **referral_codes, referrals, scout_credentials:** Own-row or appropriate role checks.

### Rate limits (Upstash Redis)
All limits use sliding windows via `@upstash/ratelimit`. If `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are unset, limits are **disabled** (requests still succeed); production logs a **warn** plus an **error** with `rate_limits_disabled: true` on first detection.

- **Per kind / preset (see `src/lib/rate-limit.ts`):**  
  - `/api/referral/attribute` — 10/hour; key: user id if logged in, else IP (runs before 401).  
  - `/api/job-applications` — 5/hour per user.  
  - `/api/cv-analysis`, `/api/cv-analysis/auto` — 5/minute per user.  
  - `/api/mock-interview` — 60/hour per user.  
  - `/api/mock-interview/result` — 5/minute per user.  
  - `/api/tts` — 30/hour; user id or IP if unauthenticated.  
  - `/api/stripe-webhook` — lenient preset (200/minute) per IP (before body/signature work).  
  - `/api/employer/applications/[applicationId]` (PATCH) — moderate preset (60/minute) per user.  
  - `/api/candidate/public-profile-link` (GET) — lenient preset (200/minute) per user.  
  - `/api/employer/create-checkout-session`, `/api/candidate/create-checkout-session`, `/api/employer/verify-session` — **strict** (20/minute) per user.  
  - `/api/scout-credential` — **moderate** (60/minute) per user.  
  - `/api/referral/my-code` — **lenient** per user or IP before 401.  
  - `/api/scout-pass/[slug]`, `/api/og/result/[id]`, `/api/og/profile/[slug]` — **lenient** per IP.

### Sensitive data in logs
- **Logger** (`src/lib/logger.ts`): Only logs `message` and optional `data`; for errors, logs `error.name` and `error.message` (no stack or body). Comment instructs not to log passwords, tokens, or full request bodies.
- **APIs:** Log calls use endpoint names and reasons (e.g. validation failed, Groq failed); no PII or secrets in log payloads.

---

## 4. Build Check

- **TypeScript:** `npm run build` completes with **no type errors** (fixes applied during this audit).
- **Fixes applied:**
  - `employer/[jobId]/applications/page.tsx`: Typed `applications` and cast Supabase join result to avoid `profiles` array vs object mismatch.
  - `jobs/[jobId]/apply/page.tsx`: Cast `jobData` via `unknown` for Supabase join type.
  - `mock-interview/[sessionId]/page.tsx`: `recognition.onerror` handler cast to satisfy `() => void` while still accepting event.
  - `mock-interview/page.tsx`: `useState<string>(JOB_TITLES[0])` so `setJobCategory(e.target.value)` is valid.
  - `job-applications/route.ts`: `strengths`/`improvements` from raw report filtered to `string[]`.
  - `cv-analysis/page.tsx`: Wrapped content using `useSearchParams()` in `<Suspense>` to satisfy Next.js prerender.
- **Build warning:** Next.js reports that the **middleware** file convention is deprecated in favor of **proxy**. Non-blocking for launch; plan migration when upgrading.

---

## 5. Performance Check

### Slow queries
- No N+1 or heavy joins identified in the scanned routes. Application list and detail pages use single or minimal queries. Consider indexes on `job_applications(job_id)`, `mock_interviews(user_id, job_category)`, `cv_analyses(user_id, job_id)` if not already present (migration 011 adds indexes for job_id on cv_analyses and mock_interviews).

### Large API payloads
- **mock-interview:** Full `messages` array sent each request; grows with conversation. Acceptable for typical interview length; consider trimming or summarizing very long sessions if needed later.
- **cv-analysis:** File and text sent to Groq; MAX_FILE_BYTES 10MB and MAX_TEXT_LENGTH (TTS) 5000 chars already limit size.
- **job-applications:** Small JSON body; no concern.

### Unnecessary re-renders
- No audit of React hooks (useCallback/useMemo) performed. Client components use standard patterns; no obvious global re-render risks from this scan.

---

## 6. Summary and Recommendations

| Area | Status | Action |
|------|--------|--------|
| Imports | OK | None |
| Unused files | OK | None |
| Env vars | OK | Document `GOOGLE_CLOUD_TTS_API_KEY` and `NEXT_PUBLIC_APP_URL` in `.env.local.example` |
| Duplicate code | Minor | Extract `getClientIp` to shared util |
| Auth / RLS / rate limits | OK | Set Upstash env vars in production; monitor `rate_limits_disabled` logs if missing |
| Logging | OK | No sensitive data logged |
| Build | OK | Passes after type and Suspense fixes |
| Performance | OK | No critical issues; indexes in place for job_id lookups |

**Verdict:** The project is **production-ready** from a build, env, security, and logging perspective. Address the small documentation and duplication items when convenient; monitor usage and add rate limits or query tuning if needed.
