# Spec revision changelog — 03-custom-behaviour

- Date: 20261031-165253
- Feature: 03-custom-behaviour
- Phase: 1 (Spec)

Addresses `20261031-165253--spec-review--FAIL.md`.

| Finding | Change |
|---|---|
| B1 | Production capture and capture check removed from Design and ACs (moved to spec 04); CI golden test no longer waits on them; Out of scope updated. |
| B2 | New rule "Blank text is \"\", not null" with the list of text fields; new AC. |
| N1 | New rule "Integers are always unquoted numbers"; new AC. |
| Question | New rule for `order.deliverydocket` (`{}` / `null`); synthetic fixture covers orders with and without a docket; new AC. |

ACs renumbered (now AC-1 to AC-34). Spec 04 gained the capture scripts, the docket test capture and three ACs.
