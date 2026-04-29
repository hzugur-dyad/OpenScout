# Release Checklist

Use this before merging to `main` or running a production deployment.

## Vercel

- Root Directory is `openscout-app`.
- Build command is `npm run build:vercel`.
- Required production environment variables are set.
- No placeholder or localhost values remain in production env.
- Groq and TTS provider keys are present in Vercel `Production`.
- Upstash production variables are present. Rate limits now fail closed without them.
- Apply the latest Supabase migration before switching traffic.

## Local verification

- Run `npm run validate-env -- --profile=production` against production-like env values.
- Run `npx tsc --noEmit`.
- Run tests relevant to the changed area.
- Check the affected user flows locally.
- Verify marketing consent banner and conversion events if GA4 / Ads / Meta / Hotjar envs are set.

## Production smoke test

- Homepage loads.
- Login works.
- CV analysis works.
- Mock interview generation works.
- Mock interview scoring works.
- TTS works if interview voice changed.
- Stripe checkout and webhook work if billing changed.
- Candidate pricing success flow emits purchase tracking after redirect.
- Employer pricing success flow verifies the Stripe session and emits purchase tracking after redirect.

## Rollback discipline

- Keep the previous successful deployment available.
- Prefer fixing broken Vercel env values over weakening env validation.
- Avoid bundling unrelated risky changes into release hotfixes.
