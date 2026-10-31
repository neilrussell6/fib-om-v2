# Spec revision changelog — 02-basic-crud

- Date: 20261031-150418
- Feature: 02-basic-crud
- Phase: 1 (Spec)

Addresses `20261031-150418--spec-review--FAIL.md`.

| Finding | Change |
|---|---|
| B1 | "Required fields" rule added under Reference data; schema note that only required fields are `NOT NULL`; new AC-31. |
| N1 | Orders form: docket combobox limited to the order's client, server refusal message; new AC-32. |
| N2 | Error table and Design list display names. |
| N4 | Docket create error "sender client is not configured"; new AC-33. |
| Question | Users can't delete themselves or the last user; new AC-34. |
- 20261031-161807: schema source wording: written from v1's reference files, checked against the production MySQL dump.
