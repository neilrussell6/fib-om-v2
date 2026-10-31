# Spec revision changelog — 01-users-auth

- Date: 20261031-233437
- Feature: 01-users-auth
- Phase: 4 (Review of `02-basic-crud`)

Two author decisions taken during the review of `02-basic-crud` change this (already completed) feature.

| Change | Why | Where |
|---|---|---|
| `atlas migrate lint` removed from `ci.yml`; `atlas migrate validate` kept | `migrate lint` needs Atlas Pro since v0.38; the CI step would always fail | Design (CI / deploy), AC-16; overview O4, O7.3 |
| `users.session_version`, carried in the JWT and checked on every auth check; bumped on sign-out and password change | Sign-out didn't always stick: a link prefetch in flight at sign-out re-issued the rolling session cookie after the sign-out response. Auth.js doesn't support database sessions with credentials, so the author chose this over replacing Auth.js | Design (Session version), AC-7; overview O3.1, O4 |

Consequence noted to the author: sign-out ends that user's sessions on every device.
