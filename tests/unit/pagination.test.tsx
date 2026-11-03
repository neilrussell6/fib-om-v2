// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Spec 09 User-visible 4 / AC-7: the list footer past the last page.
vi.mock("nuqs", () => ({ parseAsString: {}, useQueryStates: () => [{}, vi.fn()] }));
afterEach(cleanup);

const load = async () => (await import("@/components/resource/pagination")).Pagination;

describe("09 AC-7 Pagination", () => {
  it("shows 'Showing 0–0 of <total>' past the last page, with Prev enabled", async () => {
    const Pagination = await load();
    render(<Pagination total={312} page={999} pageSize={25} />);
    expect(screen.getByText("Showing 0–0 of 312")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Previous page" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "Next page" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows 'No results' when the total is 0", async () => {
    const Pagination = await load();
    render(<Pagination total={0} page={1} pageSize={25} />);
    expect(screen.getByText("No results")).toBeTruthy();
  });

  it("shows the range on a normal page", async () => {
    const Pagination = await load();
    render(<Pagination total={312} page={2} pageSize={25} />);
    expect(screen.getByText("Showing 26–50 of 312")).toBeTruthy();
  });

  it("the last page ends at the total", async () => {
    const Pagination = await load();
    render(<Pagination total={312} page={13} pageSize={25} />);
    expect(screen.getByText("Showing 301–312 of 312")).toBeTruthy();
  });
});
