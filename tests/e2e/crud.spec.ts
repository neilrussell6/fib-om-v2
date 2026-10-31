import { expect, type Page, test } from "@playwright/test";
import { createFixture, type Fixture, removeFixture } from "../helpers/fixtures";
import { expectToast, fillField, pickReference, save, confirmDelete } from "./form-helpers";

// AC-5: for each resource, create → list → detail → edit → delete, with the success toasts.
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
    key: "clients", path: "/clients", singular: "Client",
    create: async (p, t) => (await fillField(p, "Name", `${t} Client`), `${t} Client`),
    edit: async (p, t) => (await fillField(p, "Name", `${t} Client Edited`), `${t} Client Edited`),
    find: (t) => `name=${t}`,
  },
  {
    key: "product_categories", path: "/product-categories", singular: "Product Category",
    create: async (p, t) => (await fillField(p, "Name", `${t} Cat`), `${t} Cat`),
    edit: async (p, t) => (await fillField(p, "Name", `${t} Cat Edited`), `${t} Cat Edited`),
    find: (t) => `name=${t}`,
  },
  {
    key: "product_types", path: "/product-types", singular: "Product Type",
    create: async (p, t) => {
      await fillField(p, "Name", `${t} Type`);
      await fillField(p, "Code", `${t}C`);
      await fillField(p, "MM per Pleat", "12");
      return `${t} Type`;
    },
    edit: async (p, t) => (await fillField(p, "Name", `${t} Type Edited`), `${t} Type Edited`),
    find: (t) => `name=${t}`,
  },
  {
    key: "product_sizes", path: "/product-sizes", singular: "Product Size",
    create: async (p, t) => (await fillField(p, "Name", `${t} Size`), `${t} Size`),
    edit: async (p, t) => (await fillField(p, "Name", `${t} Size Edited`), `${t} Size Edited`),
    find: (t) => `name=${t}`,
  },
  {
    key: "product_media", path: "/product-media", singular: "Product Media",
    create: async (p, t) => {
      await fillField(p, "Name", `${t} Media`);
      await fillField(p, "Code", `${t}M`);
      await fillField(p, "Pleat Spacing", "4");
      return `${t} Media`;
    },
    edit: async (p, t) => (await fillField(p, "Name", `${t} Media Edited`), `${t} Media Edited`),
    find: (t) => `name=${t}`,
  },
  {
    key: "products", path: "/products", singular: "Product",
    create: async (p, t) => {
      await fillField(p, "Name", `${t} Product`);
      await pickReference(p, "Category", fx.names.category, fx.names.category);
      await pickReference(p, "Type", fx.names.type, `${fx.names.typeCode} · ${fx.names.type}`);
      await pickReference(p, "Size", fx.names.size, fx.names.size);
      await pickReference(p, "Media", fx.names.media, `${fx.names.mediaCode} · ${fx.names.media}`);
      return `${t} Product`;
    },
    edit: async (p, t) => (await fillField(p, "Name", `${t} Product Edited`), `${t} Product Edited`),
    find: (t) => `name=${t}`,
  },
  {
    key: "delivery_dockets", path: "/delivery-dockets", singular: "Delivery Docket", createGoesToDetail: true,
    // Identified by its docket number (the zero-padded id), read from the URL after create.
    create: async (p) => (await pickReference(p, "To Client", fx.names.otherClient, fx.names.otherClient), ""),
    edit: async (p) => (await pickReference(p, "To Client", fx.names.client, fx.names.client), ""),
    find: () => `to_client=${encodeURIComponent(fx.tag)}&pageSize=100`,
  },
  {
    key: "orders", path: "/orders", singular: "Order",
    create: async (p, t) => {
      await pickReference(p, "Client", fx.names.client, fx.names.client);
      await fillField(p, "Order Number", `${t}-ON`);
      await fillField(p, "Due Date", "2026-12-24");
      return `${t}-ON`;
    },
    edit: async (p, t) => (await fillField(p, "Order Number", `${t}-ON2`), `${t}-ON2`),
    find: (t) => `order_number=${t}`,
  },
  {
    key: "order_items", path: "/order-items", singular: "Order Item",
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

    // Detail (row click on the record's own cell; some first cells are links to other records)
    await row.getByRole("cell", { name: listText, exact: true }).click();
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

    // Delete
    await editedRow.getByRole("link", { name: "Edit" }).click();
    await confirmDelete(page);
    await expectToast(page, `${c.singular} successfully deleted`);
    await expect(page).toHaveURL(new RegExp(`${c.path}(\\?.*)?$`));
  });
}
