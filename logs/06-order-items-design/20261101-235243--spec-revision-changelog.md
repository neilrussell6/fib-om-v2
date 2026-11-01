# Spec revision changelog — 06-order-items-design

- Date: 20261101-235243
- Feature: 06-order-items-design
- Phase: 3 (Implementation)

The author resolved a conflict found during implementation: the Theme table's avatar `#d4762a` failed AC-7 (white initial at 3.27:1).

- Design → Theme: `--avatar` is now `#b06223` (4.55:1), recorded as a second intended colour deviation next to `#697175`.
- The AC-2 unit test value was updated to match (`tests/unit/theme-contrast.test.ts`).
