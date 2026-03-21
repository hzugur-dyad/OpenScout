# CI/CD (GitHub Actions + Vercel)

## Branching strategy

| Branch        | Role |
|---------------|------|
| **`main`**    | Production-ready code. Merges here deploy to production (Vercel) and should always pass CI. |
| **`guncelleme`** | Integration / ongoing development branch. Day-to-day updates land here first; when stable, open a **pull request into `main`**. |

### Purpose of `guncelleme`

Use **`guncelleme`** as the shared working branch for updates and changes so `main` stays release-quality. Flow:

1. Work on `guncelleme` (or on short-lived branches below).
2. Open a PR **`guncelleme` → `main`** when you want a release cut (or merge locally after review, following your team rules).

### Create `guncelleme` from `main` (first time on a clone)

If the branch does not exist yet on the remote:

```bash
git fetch origin
git checkout main
git pull origin main
git checkout -b guncelleme
git push -u origin guncelleme
```

### Use the existing remote branch locally

If `guncelleme` already exists on GitHub:

```bash
git fetch origin
git checkout -b guncelleme origin/guncelleme
# or (Git 2.23+): git switch guncelleme  # if upstream is set after first fetch
```

### Feature branches from `guncelleme`

For isolated work (optional):

```bash
git checkout guncelleme
git pull origin guncelleme
git checkout -b feature/your-short-description
# ... commit work ...
git push -u origin feature/your-short-description
```

Then open a PR **`feature/...` → `guncelleme`**. After merge, delete the feature branch. When ready to ship, PR **`guncelleme` → `main`**.

### CI and branches

GitHub Actions runs on **push to `main`** and **pull requests targeting `main`** only (see workflow). Pushes to `guncelleme` alone do not run that workflow; **opening a PR into `main`** runs the full CI pipeline before merge.

## What runs in GitHub Actions

Workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)

| Step        | Command              |
|------------|----------------------|
| Install    | `npm ci` (in `openscout-app/`) |
| Env check  | `npm run validate-env` (`OPENSCOUT_ENV_PROFILE=ci`) — fails if required CI env keys are empty |
| Lint       | `npm run lint` (0 ESLint **errors** required; some React Compiler rules are warnings — see `openscout-app/eslint.config.mjs`) |
| Clean      | `rm -rf .next` — avoids stale generated types breaking `tsc` |
| Typecheck  | `npx tsc --noEmit`   |
| Tests      | `npx vitest run`     |
| Build      | `npm run build` (production Next.js build) |

Triggers: **push** to `main`, **pull_request** targeting `main`.

Any step failure fails the workflow job; nothing downstream runs in the same job.

### Branch protection (recommended; configured in GitHub, not in this repo)

To keep broken code off `main`:

1. **Settings → Branches → Branch protection rules** for `main`.
2. Enable **Require a pull request before merging** (optional but recommended).
3. Enable **Require status checks to pass before merging** and require the check named **Lint, typecheck, test, build** (or the workflow name as GitHub displays it).
4. Optionally **Require branches to be up to date before merging**.

Fork PRs still get CI with placeholder env; the optional Vercel CLI deploy job skips forks.

### Production env gate (Vercel build)

Optional stricter check before build (rejects placeholder-style values — see [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)):

```bash
OPENSCOUT_ENV_PROFILE=production npm run validate-env && npm run build
```

Local dev: run `npm run validate-env` (default **local** profile) for a read-only summary; it always exits 0.

## GitHub Actions secrets (optional but recommended)

Set under **Settings → Secrets and variables → Actions → Secrets** for the repository.

These mirror production so CI builds match real env. If a secret is **not** set, the workflow uses **placeholders** so lint/typecheck/tests/build still run (including fork PRs).

| Secret | Purpose |
|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (baked into client bundle) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase access |
| `NEXT_PUBLIC_APP_URL` | Canonical app URL (SEO, links) |
| `GROQ_API_KEY` | AI features |
| `GOOGLE_CLOUD_TTS_API_KEY` | TTS for interviews |
| `STRIPE_SECRET_KEY` | Stripe server API |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification |
| `STRIPE_CANDIDATE_PLUS_PRICE_ID` | Checkout |
| `STRIPE_CANDIDATE_PRO_PRICE_ID` | Checkout |
| `STRIPE_EMPLOYER_GROWTH_PRICE_ID` | Checkout |
| `STRIPE_EMPLOYER_SCALE_PRICE_ID` | Checkout |
| `UPSTASH_REDIS_REST_URL` | Rate limiting (optional) |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiting (optional) |
| `NEXT_PUBLIC_POSTHOG_KEY` | Analytics (optional) |
| `NEXT_PUBLIC_POSTHOG_HOST` | Analytics (optional) |

**Never commit** real values; use Secrets (or Vercel Environment Variables for runtime deploys).

## Vercel: two supported modes

### A) Vercel GitHub integration (recommended)

1. Import the repo in [Vercel](https://vercel.com) and set **Root Directory** to `openscout-app`.
2. Configure **Production Branch** = `main` and environment variables in the Vercel project.
3. Leave **Actions Variable** `ENABLE_VERCEL_CLI` unset or not `true`.

Result: Vercel deploys **production** from `main` and **preview** deployments from other branches/PRs. GitHub Actions only validates code (no duplicate deploy).

### B) Deploy from GitHub Actions (Vercel CLI)

Use this only if you intentionally want Actions to run `vercel deploy` (e.g. custom gates). **Turn off** automatic Git deployments for the same project in Vercel to avoid double builds.

1. Repository **variable** (not secret): **Settings → Secrets and variables → Actions → Variables**  
   - Name: `ENABLE_VERCEL_CLI`  
   - Value: `true`

2. Repository **secrets**:

| Secret | Where to get it |
|--------|------------------|
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID` | Project `.vercel/project.json` after `vercel link`, or Team/Project settings |
| `VERCEL_PROJECT_ID` | Same as above |

Behavior in the workflow:

- **`deploy-vercel` runs only after `ci` succeeds** (`needs: ci`). If lint, typecheck, tests, or build fail, deploy does not run.
- **Push to `main`** → deploy with `--prod` (production).
- **Pull request** (same-repo only; forks skipped) → preview deploy; the action can comment the preview URL on the PR when `GITHUB_TOKEN` has `pull-requests: write`.

### Deploy path when using Vercel Git integration only

If `ENABLE_VERCEL_CLI` is **not** `true`, GitHub Actions **does not deploy**. Vercel deploys from its own Git connection. In that setup, **merge discipline + required CI checks** are the quality gate; Vercel still builds the merged commit — keep Vercel build logs monitored.

Release and smoke-test guidance: [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md), [SMOKE_TESTS.md](./SMOKE_TESTS.md).

## Vercel environment variables

Configure all `NEXT_PUBLIC_*` and server secrets in the Vercel project **Environment Variables** for Preview and Production. GitHub Secrets for CI are separate from Vercel’s runtime env unless you duplicate values in both places.
