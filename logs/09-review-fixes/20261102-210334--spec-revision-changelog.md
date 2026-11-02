# Spec revision changelog — 09-review-fixes

- Date: 20261102-210334
- Feature: 09-review-fixes
- Phase: 1 (Spec)
- Addresses: `20261102-210301--spec-review--FAIL.md`

## Blocking

- **B1, coverage thresholds:**
  - `lib/auth.ts` and `lib/db/index.ts` are left out of the `lib/**` threshold but still reported.
  - The six helper files are named by path. `referenceLabel` is covered via
    `lib/resources/index.ts` under `lib/**`.
  - Added the fallback rule (round down to 5, recorded in the implementation changelog).
  - AC-15 is rewritten to match. OQ3 is removed.
- **B2, `test:coverage` running `neon`:**
  - The Neon smoke test is dropped, per the author: the Tests and CI section, Summary bullet,
    old AC-16, the Out-of-scope line and OQ4 are all gone.
  - `test:coverage` is still pinned to `--project unit --project integration`.
  - Old AC-17 is renumbered to AC-16.

## Author's answers

- **Coverage report-only:**
  - The CI coverage step runs with `continue-on-error: true` after the unchanged unit and
    integration steps, and the report is always uploaded.
  - AC-15 checks this through a `project-config` test of `ci.yml`.
  - The Summary bullet is reworded, and "thresholds that fail CI" is added to Out of scope.
- **Benchmark size:**
  - The seed is now 100,000 order items and 45,000 orders (~2.2 items per order), sized from the
    v1 production counts (28,484 items / 13,275 orders, checked 2026-11-02).
  - User-visible §5 and AC-14 are updated. The 300 ms gate is unchanged.
- **B2 refuse:** kept, so no design change. OQ1 is removed.
- Open questions are replaced by the list of settled decisions.

## Non-blocking (all applied)

- **P3:** removed the create dialog from the forms that pass `referenceLabel`, and noted that
  create dialogs are unchanged.
- **AC-11:** "first server HTML" is replaced by "as soon as the panel or filter bar renders",
  for both row-click and direct-URL loads.
- **P2:**
  - added the new `checkSessionVersion` lookup type and return value, the lookup-error
    behaviour, `token.name` on sign-in, and the `name ?? email` sidebar fallback;
  - added `getSessionUser`'s `isId` guard;
  - added the `session-version.test.ts` update to the unit-test list.
- **AC-9:** the `users-name.test.ts` `getUserDisplay` block is rewritten for `getSessionUser`,
  keeping its three cases.

## Deliberately skipped

- The AC-6 reference-query detail (withdrawn at validation; tasks.md pins it down).
