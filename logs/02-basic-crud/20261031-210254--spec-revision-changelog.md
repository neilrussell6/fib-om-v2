# Spec revision changelog — 02-basic-crud

- Date: 20261031-210254
- Feature: 02-basic-crud
- Phase: 2 (Tasks)

Author decision at "validate tasks" (`20261031-210254--task-review--FAIL.md`, question): the schema check against the production MySQL dump moves to `04-data-scripts`.

| Change | Where |
|---|---|
| Schema is written from v1's reference files; the MySQL check is done in spec 04 | Spec 02 Design (Schema), Required fields note |
| Spec 04 gains the check: every production column the import needs must exist; missing ones added by a new (expand-only) migration | Spec 04 Design (Mapping from MySQL) |
