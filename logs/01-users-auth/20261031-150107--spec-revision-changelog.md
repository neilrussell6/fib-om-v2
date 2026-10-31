# Spec revision changelog — 01-users-auth

- Date: 20261031-150107
- Feature: 01-users-auth
- Phase: 1 (Spec)

Addresses `20261031-150107--spec-review--FAIL.md`.

| Finding | Change |
|---|---|
| B1 rate limit too broad + Hobby plan | Firewall rule replaced by an in-app limiter on the `/login` sign-in Server Action: 10 attempts/min per IP, `login_attempts` table, IP from `x-real-ip`; refusal message "Too many sign-in attempts. Try again in a minute." (wording chosen by the reviser; change if needed). Old operational AC-21 removed; new automated AC-19; operational ACs renumbered to AC-20–22. |
| N1 | `updateAge` 15 minutes; AC-6 updated. |
| N2, N3 | Dummy-hash compare for unknown emails; email trimmed and lowercased; AC-5 updated. |
| N4 | gitleaks in CI; AC-16, AC-18 updated. |
| N5 | `atlas migrate lint` with Docker dev DB (`postgres/17`); AC-16 updated. |
| N6 | `STAGING_DOMAIN` repo variable = `staging.fibatron.com`; AC-17, AC-20 updated. |
| N7 | `bg.jpg` copied into `public/`. |
| Questions | Vercel Hobby, staging domain, Postgres 17 recorded in spec Design and overview (O3.1, O7.1, O7.4). |
