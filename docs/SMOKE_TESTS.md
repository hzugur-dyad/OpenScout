# Post-deploy smoke tests (OpenScout)

Manual checklist for **production** (or staging with production-like config). No browser automation required; execute in order that matches your access (candidate vs employer).

Tick items as you go. If anything fails, roll forward only after fixing or accepting known risk.

---

## Auth

- [ ] Sign up / sign in (email or configured provider).
- [ ] Sign out and sign in again.
- [ ] Protected dashboard route redirects when logged out.

---

## Onboarding

- [ ] Complete or resume onboarding without 500 errors.
- [ ] Data persists after refresh (Supabase).

---

## CV analysis

- [ ] Upload or submit a CV for analysis.
- [ ] Receive a structured result (no hung spinner; check API/network for 4xx/5xx).

---

## Mock interview

- [ ] Start a mock interview session.
- [ ] Audio/TTS path works if used (Google TTS key valid).
- [ ] Session can be completed or saved as designed.

---

## Interview result

- [ ] View interview result in-app after completion.
- [ ] If applicable, **public** result link loads for a share token/slug you control (no private data leaked).

---

## Job apply (candidate)

- [ ] Open a job detail page and submit an application (or primary apply flow).
- [ ] Confirmation or status updates as expected.

---

## Employer applications

- [ ] Employer account can see incoming applications for a posting.
- [ ] Status/workflow actions (shortlist, reject, etc., per your product) succeed.

---

## Stripe

- [ ] Candidate checkout opens Stripe Checkout (test mode on staging, live only on production when intended).
- [ ] Webhook: after a test purchase, subscription or entitlement updates in app (check Stripe dashboard + app).
- [ ] Employer plan checkout (growth/scale) same as above for your flows.

---

## Referral link

- [ ] Referral or scout-pass link attributes signup or reward per product rules.
- [ ] Invalid or expired referral does not break the landing experience.

---

## Public result / profile pages

- [ ] Public mock interview result page (if enabled) shows only intended public fields.
- [ ] Public candidate profile slug page loads and redacts internal IDs.

---

## Rate limiting & APIs (quick)

- [ ] Normal usage does not hit 429; intentional abuse path (if you test) behaves as configured (Upstash in production).

---

## Analytics & errors (if configured)

- [ ] PostHog (or equivalent) receives at least one event from this session.
- [ ] Sentry shows no unexpected spike right after deploy (optional test error excluded).
