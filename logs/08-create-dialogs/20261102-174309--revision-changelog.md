# Revision changelog — 08-create-dialogs

- Date: 20261102-174309
- Feature: 08-create-dialogs
- Phase: 4 (Review)
- Addresses: `20261102-173958--review--FAIL.md`

- **Finding 1 (low, disabled controls look enabled):** the hydration fieldset in
  `components/resource/create/create-dialog.tsx` and `components/resource/panel/panel-shell.tsx` now
  applies `[&_:disabled]:opacity-100` only while not hydrated, so afterwards disabled controls (the
  stepper's − at 1, "Adding…", the panels' "Saving…") fade as usual.
- Tests: `tests/e2e/create-dialogs.spec.ts` AC-10 checks the stepper's − at 1 has opacity 0.5, and
  AC-13 checks "Adding…" has opacity 0.5 while saving.

## Verification

- Lint: clean. Typecheck: clean. Unit: 24 files, 277/277 passed.
- **Not run:** integration and e2e. The local Postgres on :5432 was down and Docker isn't available
  in this WSL distro. The author chose to commit without them (2026-11-02). The two new e2e opacity
  checks have not been run yet.
