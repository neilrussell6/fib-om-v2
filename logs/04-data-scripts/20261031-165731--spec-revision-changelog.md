# Spec revision changelog — 04-data-scripts

- Date: 20261031-165731
- Feature: 04-data-scripts
- Phase: 1 (Spec)

Addresses `20261031-165731--spec-review--FAIL.md` and spec 03's second-pass B1.

| Finding | Change |
|---|---|
| Spec 03 B1 | New section "Notcher production capture": `notcher-capture.sh`, `notcher-capture-check.ts`, the docket test capture; cutover steps include the capture checks; new automated and operational ACs; ACs renumbered. |
| B1 | Decommission rewritten for production PHP + MySQL; v1 tidy-up as its own step; AC-22 rewritten, new AC-23. |
| N1 | MySQL client tools; test setup MySQL source/scratch + Postgres target; row-count AC; `SOURCE_MYSQL_URL` in AC-15; "Not imported" lists production MySQL tables. |
| N2 | Categories v1 doesn't know get all `show_*` flags off (logged); AC-3 updated. |
| N3 | Reference to `.env.tpl` operator variables (spec 01). |
| Questions | Old PHP site at `old.fibatron.com` for 30 days, no technical lock; production DNS stays on PHP until the switchover after staging testing. |
