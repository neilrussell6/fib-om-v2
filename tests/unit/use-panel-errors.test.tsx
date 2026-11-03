// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePanelErrors } from "@/components/resource/panel/use-panel-errors";

// Spec 09 Tests and CI: panel error handling (spec 06 AC-23, shared since spec 07).
afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

type S = "details" | "attributes";
const sectionOf = (name: string): S | null => (name === "height" ? "details" : name === "clip_type" ? "attributes" : null);

const setup = () => {
  const setFocus = vi.fn();
  const hook = renderHook(() => usePanelErrors<S>({ sectionOf, focusOrder: ["part_number", "height", "clip_type"], setFocus, idPrefix: "p" }));
  return { hook, setFocus };
};

describe("09 usePanelErrors", () => {
  it("starts with every section closed, and toggle flips one", () => {
    const { hook } = setup();
    expect(hook.result.current.open).toEqual({});
    act(() => hook.result.current.toggle("details"));
    expect(hook.result.current.open).toEqual({ details: true });
    act(() => hook.result.current.toggle("details"));
    expect(hook.result.current.open).toEqual({ details: false });
  });

  it("opens every section holding an error and focuses the first field in focus order", () => {
    const input = document.createElement("input");
    input.id = "p-height";
    document.body.append(input);
    const { hook, setFocus } = setup();
    act(() => hook.result.current.showErrors({ clip_type: "bad", height: "bad" }));
    expect(hook.result.current.open).toEqual({ details: true, attributes: true });
    expect(setFocus).toHaveBeenCalledWith("height");
    expect(document.activeElement).toBe(input);
  });

  it("focuses a field outside any section without opening one", () => {
    const { hook, setFocus } = setup();
    act(() => hook.result.current.showErrors({ part_number: "required" }));
    expect(hook.result.current.open).toEqual({});
    expect(setFocus).toHaveBeenCalledWith("part_number");
  });

  it("falls back to the first error's field when none is in focus order", () => {
    const { hook, setFocus } = setup();
    act(() => hook.result.current.showErrors({ other: "x" }));
    expect(setFocus).toHaveBeenCalledWith("other");
  });

  it("does nothing for no errors", () => {
    const { hook, setFocus } = setup();
    act(() => hook.result.current.showErrors({}));
    expect(setFocus).not.toHaveBeenCalled();
  });
});
