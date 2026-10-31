"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { parseAsString, useQueryStates } from "nuqs";
import { useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FilterDef } from "@/lib/resources/types";
import { NumberInput } from "./number-input";
import { ReferenceCombobox } from "./reference-combobox";

const TEXT_DEBOUNCE_MS = 300;

/** A text-like filter keeps local state and writes to the URL after a short pause. */
function DebouncedInput({ id, filter, value, onCommit }: { id: string; filter: FilterDef; value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  // Follow URL changes made elsewhere (Clear, Clear all, back/forward) without an effect.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
  }
  useEffect(() => {
    if (draft === value) return;
    const t = setTimeout(() => onCommit(draft), TEXT_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [draft, value, onCommit]);
  const props = { id, value: draft, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value) };
  if (filter.kind === "number") return <NumberInput {...props} />;
  return <Input {...props} type={filter.kind === "date" ? "date" : "text"} />;
}

/**
 * List filters (spec 02): some always shown, the rest added from "Add filter";
 * every value lives in the URL (nuqs) so a filtered list can be bookmarked.
 */
export function FilterBar({ filters }: { filters: FilterDef[] }) {
  const parsers = useMemo(
    () => Object.fromEntries([...filters.map((f) => [f.key, parseAsString]), ["page", parseAsString]]),
    [filters],
  );
  const [values, setValues] = useQueryStates(parsers, { shallow: false, history: "replace" });
  const [added, setAdded] = useState<string[]>([]);
  // Unique per instance: a hidden, preserved list page can hold the same filters.
  const idPrefix = useId();

  const visible = filters.filter((f) => f.alwaysShown || added.includes(f.key) || values[f.key]);
  const hidden = filters.filter((f) => !visible.includes(f));
  const active = filters.filter((f) => values[f.key]);

  // Any filter change goes back to page 1.
  const set = (key: string, value: string) => setValues({ [key]: value || null, page: null });

  return (
    <section aria-label="Filters" className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
      {visible.map((f) => {
        const value = (values[f.key] as string | null) ?? "";
        return (
          <div key={f.key} className="flex flex-col gap-1">
            <Label htmlFor={`${idPrefix}-filter-${f.key}`}>{f.label}</Label>
            <div className="flex items-center gap-1">
              <div className="w-48">
                {f.kind === "reference" ? (
                  <ReferenceCombobox id={`${idPrefix}-filter-${f.key}`} resource={f.ref!} value={value} onChange={(v) => set(f.key, v)} />
                ) : f.kind === "select" ? (
                  <select
                    id={`${idPrefix}-filter-${f.key}`}
                    value={value}
                    onChange={(e) => set(f.key, e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">All</option>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <DebouncedInput id={`${idPrefix}-filter-${f.key}`} filter={f} value={value} onCommit={(v) => set(f.key, v)} />
                )}
              </div>
              {value ? (
                <Button type="button" variant="ghost" size="icon" aria-label={`Clear ${f.label} filter`} onClick={() => set(f.key, "")}>
                  <XIcon aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          </div>
        );
      })}
      {hidden.length ? (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button type="button" variant="outline" />}>
            <PlusIcon aria-hidden="true" />
            Add filter
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {hidden.map((f) => (
              <DropdownMenuItem key={f.key} onClick={() => setAdded((a) => [...a, f.key])}>
                {f.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {active.length ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setAdded([]);
            setValues(Object.fromEntries([...filters.map((f) => [f.key, null]), ["page", null]]));
          }}
        >
          Clear all
        </Button>
      ) : null}
    </section>
  );
}
