# Spec revision changelog — 09-review-fixes

- Date: 20261102-211524
- Feature: 09-review-fixes
- Phase: 1 (Spec)
- Addresses: the author's request at spec validation ("analyse the amount of e2e tests, can any of
  them be converted to integration tests … same question for integration to unit"). The author
  approved adding the analysis as proposed.

## Changes

- **Summary:** added a "test pyramid rebalanced" bullet under Tests and CI.
- **Design:** new section "T — test pyramid".
  - **Baseline**, measured 2026-11-02: e2e 201 (~10 min), integration 185 (~50 s, ~37 s of it
    CLI spawns), unit 277.
  - **The rule** for what may leave e2e and what stays.
  - **E1–E14**, each with the test that now covers the behaviour:
    - proxy matcher unit
    - CRUD lifecycle integration
    - `RecordPanel` field render unit
    - `signInAction` rate-limit integration
    - a single merged axe sweep
    - removals already covered lower down
  - **I1–I3 and I5:**
    - CLI refusals move to unit tests, with one spawn per CLI kept
    - `createUser` runs in-process
    - the `filterWhere` builder is exported and unit-tested
    - `db.test` is renamed
  - **Expected counts:** e2e ~143, integration ~161, unit ~330.
  - **Mapping file:** `tests/MOVED.md`.
- **Acceptance criteria:**
  - New AC-16 (e2e ≤ 145, with the `MOVED.md` mapping checked by a unit test).
  - New AC-17 (the new lower-level tests).
  - New AC-18 (integration → unit).
  - New AC-19 (integration ≤ 25 s; e2e time recorded, with no gate).
  - The old AC-16 ("all pass") is now AC-20.
- **Out of scope:** moving pre-SQL integration tests to unit (I4), and changing what the e2e tests
  that stay assert.
- Spec 01 AC-19 references in the T tables are written as "spec 01 AC-19", so they can't be
  confused with this spec's AC-19.
