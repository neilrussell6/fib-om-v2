"use client";

import { parseAsString, useQueryStates } from "nuqs";
import { useRef } from "react";
import type { Option } from "@/lib/resources";
import { cn } from "@/lib/utils";

/**
 * Status tabs with counts (spec 06, generalised in spec 07): All, then one tab
 * per status option. Writes `?status=` (absent = All) and goes back to page 1,
 * keeping `?item` so an open panel stays open. Arrow keys move between tabs;
 * Enter or Space selects.
 */
export function StatusTabs({ counts, active, options }: { counts: Record<string, number>; active: string; options: Option[] }) {
  const TABS = [{ value: "", label: "All" }, ...options];
  const [, setQuery] = useQueryStates({ status: parseAsString, page: parseAsString, item: parseAsString }, { shallow: false });
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const select = (value: string) => setQuery({ status: value || null, page: null });

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    refs.current[(i + step + TABS.length) % TABS.length]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Status"
      className="flex gap-6 overflow-x-auto border-b border-border [scrollbar-width:none] print:hidden"
    >
      {TABS.map((t, i) => {
        const selected = t.value === active;
        const count = t.value ? (counts[t.value] ?? 0) : total;
        return (
          <button
            key={t.value || "all"}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => select(t.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 pb-3 text-sm whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            <span data-testid="tab-count" className="rounded-[10px] bg-pill px-1.5 py-px text-xs font-normal text-muted-foreground">
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
