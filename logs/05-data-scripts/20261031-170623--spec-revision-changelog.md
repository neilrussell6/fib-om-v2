# Spec revision changelog — 04-data-scripts

- Date: 20261031-170623
- Feature: 04-data-scripts
- Phase: 1 (Spec)

Addresses non-blocking findings in `20261031-170623--spec-review--PASS.md`.

| Finding | Change |
|---|---|
| N1 | AC-18: "four recorded runs". |
| N2 | `seed-old` takes `<snapshot dir>` and restores its `mysqldump`. |
| N3 | `notcher-capture.sh` reads `NOTCHER_API_KEY`. |
| N4 | AC-11 also checks `seed-dummy --target staging` without `PRODUCTION_DB_HOST`. |
