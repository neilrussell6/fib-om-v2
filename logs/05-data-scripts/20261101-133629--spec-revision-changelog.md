# Spec revision changelog — 05-data-scripts

- Date: 20261101-133629
- Feature: 05-data-scripts
- Phase: 1 (Spec)

Follows the author's decisions on `logs/03-seed-dummy/20261101-133629--spec-review--FAIL.md` that affect `seed-old`.

| Decision | Change |
|---|---|
| D5 | Mapping from MySQL: v1's category names, renames, additions and flags come from `lib/data/v1-categories.ts` (built in spec 03). |
| D8 | Production guard: `--target local` accepts only `localhost`, `127.0.0.1` or `db.localtest.me`. |
