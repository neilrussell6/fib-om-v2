import { expect, type Page, test } from "@playwright/test";
import { createFixture, type Fixture, removeFixture } from "../helpers/fixtures";
import { expectToast, fillField, pickReference, save, confirmDelete } from "./form-helpers";

// AC-5: create → list → detail → edit → delete, with the success toasts. Spec 09 T E2: every
// resource's lifecycle is an integration test (tests/integration/crud-lifecycle.test.ts); the
// browser flow keeps one simple resource (Users) and one with references (Order Items).
let fx: Fixture;
test.beforeAll(async () => {
  fx = await createFixture();
});
test.afterAll(() => removeFixture(fx.tag));

type Case = {
  key: string;
  path: string;
  singular: string;
  /** Fills the create form; returns text that identifies the new record in the list and detail page. */
  create: (page: Page, t: string) => Promise<string>;
  /** Changes one field on the edit form; returns the new identifying text. */
  edit: (page: Page, t: string) => Promise<string>;
  /** List URL query that narrows the list to the new record. */
  find: (t: string) => string;
  /** Docket creation goes to the detail page instead of the list. */
  createGoesToDetail?: boolean;
  /** Text that identifies the row in the list when the identifying field isn't a list column. */
  rowText?: () => string;
  /** Spec 06: a row click opens the edit panel, not the detail page (every list since spec 07). */
  panel?: boolean;
};

const cases: Case[] = [
  {
    key: "users", path: "/users", singular: "User",
    create: async (p, t) => {
      await fillField(p, "Email", `${t}@example.com`);
      await fillField(p, "Password", "crud-password-123");
      return `${t}@example.com`;
    },
    edit: async (p, t) => {
      await fillField(p, "Email", `${t}-edited@example.com`);
      return `${t}-edited@example.com`;
    },
    find: (t) => `email=${t}`,
  },
  {
    key: "order_items", path: "/order-items", singular: "Order Item", panel: true,
    // The list (spec 02) shows client, order number, dates and status, not the part number.
    rowText: () => fx.names.orderNumber,
    create: async (p, t) => {
      await pickReference(p, "Order", fx.names.orderNumber, `${fx.names.orderNumber} · ${fx.names.client}`);
      await pickReference(p, "Product", fx.names.product, fx.names.product);
      await fillField(p, "Part Number", `${t}-PN`);
      for (const [label, v] of [["Quantity", "3"], ["Height", "400"], ["Width", "500"], ["Depth", "48"]]) await fillField(p, label, v);
      return `${t}-PN`;
    },
    edit: async (p, t) => (await fillField(p, "Part Number", `${t}-PN2`), `${t}-PN2`),
    find: (t) => `part_number=${t}`,
  },
];

for (const c of cases) {
  test(`AC-5 ${c.singular}: create, list, detail, edit, delete`, async ({ page }) => {
    const t = `${fx.tag}${c.key.replace(/_/g, "")}`;

    // Create
    await page.goto(`${c.path}/new`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Create a ${c.singular}`);
    let created = await c.create(page, t);
    await save(page);
    await expectToast(page, `${c.singular} successfully created`);
    if (c.createGoesToDetail) {
      await expect(page).toHaveURL(new RegExp(`${c.path}/\\d+$`));
      created = new URL(page.url()).pathname.split("/").pop()!.padStart(6, "0");
    } else await expect(page).toHaveURL(new RegExp(`${c.path}(\\?.*)?$`));

    // List
    await page.goto(`${c.path}?${c.find(t)}`);
    const listText = c.rowText?.() ?? created;
    const row = page.getByRole("row").filter({ hasText: listText }).first();
    await expect(row).toBeVisible();

    // Detail (row click on the record's own cell; some first cells are links to other records).
    // Spec 06 AC-16 / spec 07 AC-1: the row opens the edit panel; the detail page is still reachable by URL.
    await row.getByRole("cell", { name: listText, exact: true }).last().click();
    await expect(page).toHaveURL(/[?&]item=\d+/);
    await expect(page.getByRole("region", { name: `Edit ${c.singular.toLowerCase()}` })).toBeVisible();
    await page.goto(`${c.path}/${new URL(page.url()).searchParams.get("item")}`);
    await expect(page).toHaveURL(new RegExp(`${c.path}/\\d+$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(c.singular);
    await expect(page.getByRole("main")).toContainText(created);

    // Edit
    await page.getByRole("link", { name: "Edit", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Edit ${c.singular}`);
    const edited = (await c.edit(page, t)) || created;
    await save(page);
    await expectToast(page, `${c.singular} successfully updated`);
    await page.goto(`${c.path}?${c.find(t)}`);
    const editedRow = page.getByRole("row").filter({ hasText: c.rowText?.() ?? edited }).first();
    await expect(editedRow).toBeVisible();

    // Delete (from the edit page, reached by URL: panels have no Delete, spec 07).
    await editedRow.getByRole("cell", { name: c.rowText?.() ?? edited, exact: true }).last().click();
    await expect(page).toHaveURL(/[?&]item=\d+/);
    await page.goto(`${c.path}/${new URL(page.url()).searchParams.get("item")}/edit`);
    await confirmDelete(page);
    await expectToast(page, `${c.singular} successfully deleted`);
    await expect(page).toHaveURL(new RegExp(`${c.path}(\\?.*)?$`));
  });
}
