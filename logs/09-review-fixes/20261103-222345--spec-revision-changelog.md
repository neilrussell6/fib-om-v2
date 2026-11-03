# Spec revision changelog — 09-review-fixes

- Date: 20261103-222345
- Feature: 09-review-fixes
- Phase: 4 (Review)
- Addresses: the author's decision at PR validation: "pass, relax AC-19 to 50 s".

## Changes

- **AC-19, spec:** the integration run-time target goes from ≤ 25 s to ≤ 50 s, measured by
  vitest's reported Duration. The measured 45.7 s meets it.
- **AC-19, tasks:** the matching checklist item now says ≤ 50 s.

## Why

The time that's left is in tests the spec keeps on purpose, so further pyramid moves can't
recover it. Those tests are the `seed-dummy` throwaway database, bcrypt at cost 12, the two
CLI spawns, and the new B2/P1/parity integration tests. See
`20261103-222345--review--PASS.md`, finding 1.
