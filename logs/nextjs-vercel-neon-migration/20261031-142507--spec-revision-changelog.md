# Spec revision changelog — nextjs-vercel-neon-migration

- Date: 20261031-142507
- Feature: nextjs-vercel-neon-migration (specs 01–04 and the overview)
- Phase: 1 (Spec)

Trigger: the author answered the remaining open questions one at a time (in conversation).

| Spec | Question | Answer | Changes |
|---|---|---|---|
| 01 | Login rate limit | 10 requests/min per IP | Behaviour, AC-21, OQ-1 resolved |
| 01 | Password policy | Minimum 12 characters, no other rules | Design (shared zod rule), AC-14; spec 02 Users screen |
| 02 | Delete toast wording | "<Resource> successfully deleted" / "Could not delete <Resource>: <message>" | OQ-1 resolved |
| 02 | Product sizes fields | Name only, like web3 | Reference table; OQ-2 resolved |
| 03 | Calculated columns | Plain Postgres views (computed at query time) | Design; OQ-1 resolved |
| 03 | Real rows for calculated-column tests | Extract from `../fib-om-v2-reference/migrations/` | Design (`scripts/extract-derived-fixture.ts`, `tests/fixtures/derived-columns.json`, no personal data); AC-16, new AC-17; ACs renumbered; OQ-2 resolved |
| 03 | Notcher empty feed / row order | Unknown; test on staging | OQ-3 resolved; spec 04 UAT step and AC-14 (three recorded runs) |
| 04 | Notcher host / source IP | IP not stable, no allowlist; host still to confirm before cutover | Cutover plan, AC-15; OQ-1 narrowed to the host |
| 04 | `seed-dummy` on staging | Wipe and replace all app data | `seed-dummy` truncates everything except `users`; new `seed-old --wipe-orders` (never production); AC-8, AC-9; OQ-2 resolved |
| 04 | Order id sequences | `seed-old` reads legacy max ids from the snapshot | OQ-3 resolved |
| 04 | Legacy data through CI | Trusted machine only | Removed `migrate-reference-data.yml`; `seed-old --target` with typed confirmation; credentials not in GitHub; AC-11/AC-12 replaced; ACs renumbered; overview O4.1, O7.3, O7.4 updated; OQ-4 resolved |

The overview's decision log (O3.1) now records all of the above, plus the legacy reference files location (O2.1).

Still open: spec 04 OQ-1, which production host the notcher software calls and what else that host serves (needed before cutover).

## Addendum

- Spec 04 OQ-1 resolved: the notcher calls `https://fibatron.com`, which serves nothing besides this app. Cutover plan rewritten for an apex primary domain with no `www` redirect; AC-15 now checks the feed on `fibatron.com` returns `200` with no redirect, and that MX/TXT records are unchanged. Overview O7.1 and O3.1 updated. No open questions remain.
- `www`: the author chose Vercel's default `fibatron.com` → `www.fibatron.com` redirect (`308`), including the feed, provided the notcher is proven on staging to follow it (spec 04 AC-14 new run (d)). Fallback: a host-based redirect in `next.config` that exempts `/vw-notcher-api`. Spec 03 notcher constraint, spec 04 cutover plan and AC-15, and overview O7.1/O3.1 updated.
- Schema dump: `../fib-om-v2-reference/migrations/` is the current dump; a newer one will follow and must be checked against before cutover (overview O2.1).
