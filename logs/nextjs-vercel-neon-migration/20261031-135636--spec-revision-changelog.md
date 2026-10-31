# Spec revision changelog — nextjs-vercel-neon-migration

- Date: 20261031-135636
- Feature: nextjs-vercel-neon-migration
- Phase: 1 (Spec)

Trigger: the author answered the open questions in conversation (not a spec-review FAIL).

## Changes to `artifacts/specs/nextjs-vercel-neon-migration/spec.md`

| Answer | Sections changed |
|---|---|
| OQ-2 docket rules confirmed | Open questions (the Fibatron client id is still open) |
| OQ-4 recreate users, add a Users admin screen | B1 sidebar, B6, B10, D3.1, D8, Out of scope; new AC-92, AC-93 |
| OQ-5 no later import of old orders | B10, D11.2 step 5, Out of scope |
| OQ-6 snake_case renames | D5.1, D6 (explicit legacy `json_build_object` now required), D7.3 |
| OQ-7 skip orphaned products | D5.1, D7.3, D7.4, AC-76, AC-77 |
| OQ-8 `main`, not `master` | D3, D9.1, D9.3 |
| OQ-10 schema dump to be provided | D1.1 (the dump is the authority); fixture rows still open as OQ-10 |
| OQ-11 Vitest + Playwright | D3 |
| OQ-12 four delivery phases | D12 rewritten as phases, with acceptance criteria mapped to each; Dashboard added (B1, AC-2, AC-3, new AC-91); D7 rewritten as `scripts/data.ts` with snapshot / seed-old / seed-dummy (D3.1, D6.1, D7.2, D9.3, AC-75, AC-83, new AC-94–96) |
| OQ-13 JWT sessions | B6, D3, AC-70 |

## New open questions

- OQ-15 Dashboard content and where Dashboard and Users go in the sidebar.
- OQ-16 Data script: what the snapshot is, and whether `seed-dummy` must refuse to run against staging or production.
- OQ-17 One spec with four phases, or one feature per phase.

## Still open

OQ-1 (the answer "yes" doesn't choose between the two options), OQ-2 (Fibatron client id), OQ-3, OQ-9, OQ-10 (fixture rows), OQ-14.
