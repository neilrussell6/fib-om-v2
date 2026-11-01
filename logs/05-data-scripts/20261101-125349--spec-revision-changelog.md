# Spec revision changelog — 05-data-scripts

- Date: 20261101-125349
- Feature: 05-data-scripts
- Phase: 1 (Spec)

Author request: extract the dummy-data seed script into its own feature, built next. `seed-dummy` moved to the new `03-seed-dummy`; `03-custom-behaviour` and `04-data-scripts` were renamed to `04-custom-behaviour` and `05-data-scripts` (spec and log folders), and references across the specs, overview, `.env.tpl` and `proxy.ts` updated. Past progress entries and logs keep the old paths as written.

| Section | Change |
|---|---|
| Header | Depends on `03-seed-dummy` (production guard) and `04-custom-behaviour` (notcher feed); note on the extraction. |
| Summary | Two scripts; `seed-dummy` pointed at spec 03. |
| User-visible behaviour | `seed-dummy` bullet removed. |
| Design | `seed-dummy` section removed; the production guard is built in spec 03 and reused by `seed-old`. |
| AC-9, AC-10 | Struck out, pointing at spec 03's AC-1 to AC-4 and AC-6 (numbering kept so other AC references stay valid). |
| AC-11 | `seed-dummy` cases removed (now spec 03's AC-7). |
| AC-15 | `seed-dummy` removed (now spec 03's AC-9). |
| Out of scope | "`seed-dummy` against production" removed. |
| OQ-2 | Marked as moved to spec 03's OQ-1. |
