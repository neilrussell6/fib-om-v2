"use client";

import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ResourceKey } from "@/lib/resources/types";

type Option = { id: number; label: string };

const DEBOUNCE_MS = 250;

async function fetchOptions(resource: ResourceKey, params: Record<string, string>): Promise<Option[]> {
  const res = await fetch(`/api/reference/${resource}?${new URLSearchParams(params)}`);
  if (!res.ok) return [];
  return res.json();
}

/**
 * Server-searching combobox for a reference field (spec 02): debounced search,
 * 25 options at a time, fully keyboard operable (Enter opens, type, arrows,
 * Enter picks, Escape closes).
 */
export function ReferenceCombobox({
  id,
  resource,
  value,
  onChange,
  clientId,
  allowClear,
  invalid,
  describedBy,
}: {
  id: string;
  resource: ResourceKey;
  value: string;
  onChange: (value: string) => void;
  /** Narrows options to one client (delivery dockets). */
  clientId?: string;
  allowClear?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [picked, setSelected] = useState<Option | null>(null);
  const request = useRef(0);
  // The option shown is the one matching the current value (cleared values show nothing).
  const selected = picked && String(picked.id) === value ? picked : null;

  // Label for the current value (edit forms and URL filters only have the id).
  useEffect(() => {
    if (!value || selected) return;
    let cancelled = false;
    fetchOptions(resource, { id: value }).then((r) => {
      if (!cancelled) setSelected(r[0] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [value, resource, selected]);

  // Debounced server search while open.
  useEffect(() => {
    if (!open) return;
    const n = ++request.current;
    const timer = setTimeout(async () => {
      const params: Record<string, string> = { q: search };
      if (clientId !== undefined) params.clientId = clientId;
      const r = await fetchOptions(resource, params);
      if (n === request.current) setOptions(r);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open, search, resource, clientId]);

  const needsClient = clientId !== undefined && clientId === "";

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-sm outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive",
        )}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected?.label ?? "Select…"}</span>
        <ChevronsUpDownIcon aria-hidden="true" className="size-4 shrink-0 opacity-60" />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) min-w-64 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search…" value={search} onValueChange={setSearch} autoFocus />
          <CommandList>
            <CommandEmpty>{needsClient ? "Choose a client first" : "No matches"}</CommandEmpty>
            {allowClear && value ? (
              <CommandItem
                value="__none__"
                onSelect={() => {
                  onChange("");
                  setSelected(null);
                  setOpen(false);
                }}
              >
                None
              </CommandItem>
            ) : null}
            {needsClient
              ? null
              : options.map((o) => (
                  <CommandItem
                    key={o.id}
                    value={String(o.id)}
                    onSelect={() => {
                      setSelected(o);
                      onChange(String(o.id));
                      setOpen(false);
                    }}
                  >
                    {o.label}
                    {String(o.id) === value ? <CheckIcon aria-hidden="true" className="ml-auto size-4" /> : null}
                  </CommandItem>
                ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
