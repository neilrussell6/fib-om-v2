"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Panel error handling (spec 06 AC-23, shared since spec 07): expand every
 * section holding an error and focus the first invalid field, in `focusOrder`,
 * once its section has rendered.
 */
export function usePanelErrors<S extends string>({
  sectionOf,
  focusOrder,
  setFocus,
  idPrefix,
}: {
  sectionOf: (name: string) => S | null;
  focusOrder: string[];
  setFocus: (name: string) => void;
  idPrefix: string;
}) {
  const [open, setOpen] = useState<Partial<Record<S, boolean>>>({});
  // The first invalid field, focused after its section has expanded (a ref: no extra render).
  const focusField = useRef<string | null>(null);

  useEffect(() => {
    const name = focusField.current;
    if (!name) return;
    focusField.current = null;
    setFocus(name);
    document.getElementById(`${idPrefix}-${name}`)?.focus();
  });

  const showErrors = (errs: Record<string, unknown>) => {
    const names = Object.keys(errs);
    if (!names.length) return;
    const sections = new Set(names.map(sectionOf).filter((s): s is S => s !== null));
    focusField.current = focusOrder.find((n) => names.includes(n)) ?? names[0];
    // Always re-render, so the effect above runs even when no section had to expand.
    setOpen((o) => ({ ...o, ...Object.fromEntries([...sections].map((s) => [s, true])) }));
  };

  const toggle = (s: S) => setOpen((o) => ({ ...o, [s]: !o[s] }));

  return { open, toggle, showErrors };
}
