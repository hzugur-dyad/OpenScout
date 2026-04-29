# Deployment Guide

This project deploys from the `openscout-app` directory.

## Vercel setup

1. Import the repository into Vercel.
2. Set the Root Directory to `openscout-app`.
3. Set the build command to `npm run build:vercel`.
4. Keep the install command as `npm install`.
5. Use the default Next.js framework preset.

## Required production variables

These variables must exist and must not contain placeholder values in `Production`:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GROQ_API_KEYS` or `GROQ_API_KEY_<n>`
- `GOOGLE_CLOUD_TTS_API_KEYS` or `GOOGLE_CLOUD_TTS_API_KEY_<n>`
- `STRIPE_SECRET_KEY`
- `STRIPE_CANDIDATE_PLUS_PRICE_ID`
- `STRIPE_CANDIDATE_PRO_PRICE_ID`
- `STRIPE_EMPLOYER_GROWTH_PRICE_ID`
- `STRIPE_EMPLOYER_SCALE_PRICE_ID`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

These are optional, but if configured they must be real values:

- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_SENTRY_DSN` or `SENTRY_DSN`
- `NEXT_PUBLIC_POSTHOG_KEY` or `POSTHOG_KEY`
- `NEXT_PUBLIC_GA4_MEASUREMENT_ID`
- `NEXT_PUBLIC_GOOGLE_ADS_ID`
- `NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_CONVERSION_LABEL`
- `NEXT_PUBLIC_GOOGLE_ADS_CHECKOUT_CONVERSION_LABEL`
- `NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_CONVERSION_LABEL`
- `NEXT_PUBLIC_META_PIXEL_ID`
- `NEXT_PUBLIC_HOTJAR_ID`
- `NEXT_PUBLIC_HOTJAR_SV`

Use [.env.example](/C:/Users/ugurs/Desktop/OpenScout/openscout-app/.env.example) as the reference list. Copy values from local `.env.local` into Vercel manually.

## Build-time validation

`npm run build:vercel` runs `scripts/validate-env.mjs` in production mode before `next build`.

The deployment will stop early when:

- a required variable is missing
- a required variable is empty
- a placeholder-like value is still present
- `NEXT_PUBLIC_APP_URL` points to localhost

## Environment scopes

At minimum, set required variables in:

- `Production`

Recommended:

- `Preview`
- `Development`

## Common fixes

### Missing `GROQ_API_KEY`

Add `GROQ_API_KEY` in Vercel Project Settings -> Environment Variables, then redeploy.

### Localhost app URL

Set `NEXT_PUBLIC_APP_URL` to the real production domain, for example `https://openscout.app`.

### Missing Upstash config

Set both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Production rate limits now fail closed when these are missing.

### Placeholder Stripe webhook secret

Replace `STRIPE_WEBHOOK_SECRET` with the real signing secret from Stripe.

### Marketing tracking

Set any combination of:

- `NEXT_PUBLIC_GA4_MEASUREMENT_ID`
- `NEXT_PUBLIC_GOOGLE_ADS_ID`
- `NEXT_PUBLIC_META_PIXEL_ID`
- `NEXT_PUBLIC_HOTJAR_ID`

The site now shows a consent banner before loading these trackers.
