# Known Issues & Backlog

Items still open or deferred. Fixed items (login redirect, mock result server-side, job category single source, README/env) are no longer listed here.

---

## Optional / Deferred

- **Rate limit:** No rate limit on `/api/referral/attribute` or `/api/job-applications`. Consider adding per-IP or per-user limits if abuse or rewards are a concern.
- **Scout Pass:** Shared pass links do not expire and cannot be revoked. Consider expiry or slug regeneration for new credentials.
- **Subscription lapse:** When a company’s subscription is canceled, existing job listings are not removed; only new inserts are limited to 1 (by design). Document in product/help if needed.

---

## Quality & Ops (backlog)

- **Tests:** No unit or E2E tests; no test script in `package.json`. Add tests for critical APIs (auth, job-applications, cv-analysis) and/or CI lint/type-check.
- **Loading / UX:** Inconsistent loading/skeleton across pages.
- **i18n:** Mixed Turkish/English strings; no i18n structure.
- **Accessibility:** No systematic ARIA/keyboard/screen-reader review.
- **Monitoring:** No error tracking or analytics integration.

---

For full status and completion estimate, see [PROJECT_STATUS_REPORT.md](PROJECT_STATUS_REPORT.md).
