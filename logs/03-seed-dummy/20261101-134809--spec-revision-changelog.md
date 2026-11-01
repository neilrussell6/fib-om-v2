# Spec revision changelog — 03-seed-dummy

- Date: 20261101-134809
- Feature: 03-seed-dummy
- Phase: 2 (Tasks)

Follows decision T1 in `20261101-134809--task-review--FAIL.md`.

| Section | Change |
|---|---|
| User-visible behaviour | `.env` is read only with `--target local`; `--target staging` uses the session environment alone. An empty `PRODUCTION_DB_HOST` or `FROM_CLIENT_ID` counts as unset. |
| Changes from the original | New bullet: `.env` only for local. |
