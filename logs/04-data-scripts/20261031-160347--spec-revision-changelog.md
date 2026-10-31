# Spec revision changelog — 04-data-scripts

- Date: 20261031-160347
- Feature: 04-data-scripts
- Phase: 1 (Spec)

Trigger: author decision that production (PHP app on MySQL) is the data source; v1's DigitalOcean Postgres never went live.

| Change | Where |
|---|---|
| `snapshot.sh` uses `mysqldump` of production MySQL (`SOURCE_MYSQL_URL`) and runs the notcher capture in the same run | Behaviour, AC-1 |
| `seed-old` restores into a scratch MySQL container and maps to the new schema (v1 pgloader config + Doctrine entities + newer dump) | Behaviour, Design "Mapping from MySQL" |
| v1's reference-data changes applied on import: category renames, four added categories, per-category `show_*` flags; `markup`/`price*` not imported | Design, Transforms, AC-3, AC-4 |
| Legacy max ids from MySQL | Step 6, AC-5 |
| Checksums computed in TypeScript across MySQL and Postgres | Verification |
| New OQ-5: production MySQL version and read-only credentials | Open questions |
- 20261031-161259: validation decisions applied (required-fields skip rule, PRODUCTION_DB_HOST guard, no RESTART IDENTITY, snapshot handling; new AC-10–12; ACs renumbered to AC-19; cross-references updated).
- 20261031-161731: OQ-5 resolved: production MySQL 5.7 (scratch container mysql:5.7); a read-only user will be created for snapshot.sh.
- 20261031-161807: the coming dump is production MySQL, the authority for the import mapping.
