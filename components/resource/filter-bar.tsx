"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { parseAsString, useQueryStates } from "nuqs";
import { useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { FilterDef } from "@/lib/resources/types";
import { NumberInput } from "./number-input";
import { ReferenceCombobox } from "./reference-combobox";

const TEXT_DEBOUNCE_MS = 300;

/** A control drawn inside the inline-label box: no border, background or ring of its own. */
const BARE = "h-full min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0 dark:bg-transparent";

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
  const props = { id, value: draft, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value), className: BARE };
  if (filter.kind === "number") return <NumberInput {...props} />;
  return <Input {...props} type={filter.kind === "date" ? "date" : "text"} />;
}

/**
 * List filters (spec 02): some always shown, the rest added from "Add filter";
 * every value lives in the URL (nuqs) so a filtered list can be bookmarked.
 */
export function FilterBar({ filters, labels }: { filters: FilterDef[]; /** Reference filters' current labels, from the server (spec 09 P3). */ labels?: Record<string, string> }) {
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
    <section aria-label="Filters" className="flex flex-wrap items-center gap-2 py-3.5 print:hidden">
      {visible.map((f) => {
        const value = (values[f.key] as string | null) ?? "";
        const id = `${idPrefix}-filter-${f.key}`;
        return (
          // Spec 06: the label sits inside the control, e.g. "Client  Select… ⇅".
          <div
            key={f.key}
            className={cn(
              "flex h-[34px] items-center gap-1.5 rounded-md border border-input bg-background pr-1 pl-3 text-sm focus-within:border-ring",
              f.kind === "reference" ? "w-60" : f.kind === "date" ? "w-56" : "w-52",
            )}
          >
            <label htmlFor={id} className="shrink-0 whitespace-nowrap text-muted-foreground">
              {f.label}
            </label>
            <div className="flex h-full min-w-0 flex-1 items-center pr-2">
                {f.kind === "reference" ? (
                  <ReferenceCombobox id={id} resource={f.ref!} value={value} onChange={(v) => set(f.key, v)} label={labels?.[f.key]} bare />
                ) : f.kind === "select" ? (
                  <select
                    id={id}
                    value={value}
                    onChange={(e) => set(f.key, e.target.value)}
                    className="h-full w-full min-w-0 bg-transparent text-sm outline-none"
                  >
                    <option value="">All</option>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <DebouncedInput id={id} filter={f} value={value} onCommit={(v) => set(f.key, v)} />
                )}
            </div>
            {value ? (
              <Button type="button" variant="ghost" size="icon-xs" aria-label={`Clear ${f.label} filter`} onClick={() => set(f.key, "")}>
                <XIcon aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        );
      })}
      {hidden.length ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex h-[34px] items-center gap-1.5 rounded-md border border-dashed border-dash px-3 text-sm text-muted-foreground outline-none hover:bg-row-hover focus-visible:ring-2 focus-visible:ring-ring"
              />
            }
          >
            <PlusIcon aria-hidden="true" className="size-3.5" />
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
          variant="link"
          className="h-[34px] px-2 text-sm"
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
