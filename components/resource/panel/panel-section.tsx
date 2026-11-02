"use client";

import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** A collapsible panel section with its error count (spec 06, shared since spec 07). */
export function PanelSection({
  id,
  title,
  open,
  onToggle,
  errorCount,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  errorCount: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className="flex items-center justify-between text-left text-[13px] font-medium text-label outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span>
          {title}
          {errorCount ? <span className="text-destructive">{` · ${errorCount} error${errorCount === 1 ? "" : "s"}`}</span> : null}
        </span>
        <ChevronDownIcon aria-hidden="true" className={cn("size-4 text-icon-muted transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div id={id} className="grid gap-4 sm:grid-cols-2">
          {children}
        </div>
      ) : null}
    </div>
  );
}
