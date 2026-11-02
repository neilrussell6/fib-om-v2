# Spec revision changelog — 08-create-dialogs

- Date: 20261102-152411
- Feature: 08-create-dialogs
- Phase: 1 (Spec)
- Addresses: `20261102-152411--spec-review--FAIL.md`

- **Blocking 1 (one marker for two layers):** Design → History now stores the `panel-opened`
  marker as a list of URLs, one per open layer, with the rules for open, row switch, close and
  `clearOpenedMarker(ownHref)`, and treats a malformed or old single-string value as empty.
  AC-12 gains the panel → dialog → Cancel → close panel → one Back check and the unit-test list.
- **Non-blocking 1 (focus after Create another):** Add → success with Create another focuses the
  first field that was reset (Product on Order Items); AC-5 checks it.
- **Non-blocking 2 (narrow screens):** decision 6 is limited to 1024px and wider; Opening and
  Components say that below 1024px a URL with `?item` and `?new=1` shows only the dialog and the
  sheet returns on close; AC-12 gains the 800px check.
- The six Summary decisions are otherwise unchanged.
