# Spec revision changelog — 07-list-panels

- Date: 20261102-093758
- Feature: 07-list-panels
- Phase: 1 (Spec)
- Addresses: `20261102-093758--spec-review--FAIL.md`

- **Blocking 1 (stale list after Save):** fix 2 now says the list reloads after a Save; Design →
  `history.ts` gives `closePanel(router, baseHref, { saved })`, which calls `router.refresh()`
  after `back()`/`replace()` when `saved` is true; AC-17 checks the row shows the saved value.
- **Blocking 2 (heading and link per resource):** added `ResourceUi.titleField` (Design →
  Config) with the value for every resource and the email fallback for users; "identifying cell"
  became "title cell" throughout; AC-1 names the title column per list (Name, not Category, on
  Products); AC-6 lists the expected headings; AC-12 checks a nameless user's link shows the
  email.
- **Non-blocking 1 (leftover marker):** `PanelShell` clears the `panel-opened` key on unmount
  without close; fix 2 lists when closing replaces; AC-17 gains the navigate-away check.
- **Non-blocking 2 (refusal display):** Save → Error names the toast "Could not edit
  <Singular>: <message>"; AC-8 names the docket refusal toast and says nothing is written.
- **Non-blocking 3 (own password):** Users' Password says saving your own signs you out (as on the
  edit page); AC-12's password checks use another user.
- **Non-blocking 4 (list changes with a panel open):** new "Changing the list with a panel open"
  rule (panel and unsaved edits kept); fix 2 says a later close replaces; AC-14 gains the
  switch-tab check.
- The four Summary decisions are unchanged (the author didn't change them).
