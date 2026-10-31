import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Cache Components keeps recently visited routes mounted but hidden (Next.js
 * "Preserving UI state" guide), so label lookups must skip hidden elements.
 */
const visibleLabel = (page: Page, label: string): Locator => page.getByLabel(label, { exact: true }).filter({ visible: true });

/** Text, number, date, email and password inputs, by their label. */
export async function fillField(page: Page, label: string, value: string): Promise<void> {
  await visibleLabel(page, label).fill(value);
}

/** Native <select> (enum fields and select filters), by label and option text. */
export async function chooseOption(page: Page, label: string, option: string): Promise<void> {
  await visibleLabel(page, label).selectOption({ label: option });
}

export async function setSwitch(page: Page, label: string, on: boolean): Promise<void> {
  const sw = page.getByRole("switch", { name: label, exact: true });
  if ((await sw.getAttribute("aria-checked")) !== String(on)) await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", String(on));
}

/** Reference combobox: open, search, pick the option. */
export async function pickReference(page: Page, label: string, search: string, option: string): Promise<void> {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByPlaceholder("Search…").fill(search);
  await page.getByRole("option", { name: option, exact: true }).click();
  await expect(page.getByRole("combobox", { name: label, exact: true })).toContainText(option);
  // Wait for the popover to finish closing before the next combobox opens.
  await expect(page.getByPlaceholder("Search…")).toHaveCount(0);
}

export async function save(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

export async function expectToast(page: Page, text: string): Promise<void> {
  await expect(page.getByText(text, { exact: true })).toBeVisible();
}

export async function confirmDelete(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
}

/** A field's inline error message (field ids are per form instance, so select by field name). */
export function fieldError(page: Page, field: string): Locator {
  return page.locator(`[data-field-error="${field}"]`).filter({ visible: true });
}
