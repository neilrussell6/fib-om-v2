"use client";

import { ArrowUpRightIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { clearOpenedMarker, closePanel } from "./history";

const NARROW = "(max-width: 1023.98px)";

function subscribeNarrow(cb: () => void) {
  const mq = window.matchMedia(NARROW);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
/** Below 1024px the panel is a sheet over the list; the server renders the side panel (hidden there by CSS). */
const useNarrow = () => useSyncExternalStore(subscribeNarrow, () => window.matchMedia(NARROW).matches, () => false);

const noopSubscribe = () => () => {};
/** False during server render and hydration, true once React owns the inputs. */
const useHydrated = () => useSyncExternalStore(noopSubscribe, () => true, () => false);

export type PanelCloser = { close: (opts: { saved: boolean }) => void; closed: React.RefObject<boolean> };

/** Closing for a panel (spec 07 fix 2): back to the list when opened from it, else replace; refresh after a save. */
export function usePanelCloser(baseHref: string): PanelCloser {
  const router = useRouter();
  const closed = useRef(false);
  const close = useCallback(
    ({ saved }: { saved: boolean }) => {
      closed.current = true;
      closePanel(router, baseHref, { saved });
    },
    [router, baseHref],
  );
  return { close, closed };
}

const visible = (el: Element) => el.getClientRects().length > 0;

/**
 * The edit panel's frame (spec 06, shared by every list since spec 07): the side
 * panel or (below 1024px) a sheet, the header, the hydration guard, focus on open
 * and back to the row on close, Escape, "Discard changes?", and the footer.
 * The resource-specific fields are its children.
 */
export function PanelShell({
  regionLabel,
  caption,
  captionClassName,
  heading,
  subLink,
  detail,
  itemId,
  isDirty,
  pending,
  onSubmit,
  closer,
  covered = false,
  children,
}: {
  /** Accessible name of the panel, e.g. "Edit client". */
  regionLabel: string;
  caption: React.ReactNode;
  captionClassName?: string;
  heading: string;
  subLink?: { href: string; label: string } | null;
  detail: { href: string; label: string };
  itemId: string;
  isDirty: boolean;
  pending: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  closer: PanelCloser;
  /**
   * The create dialog is open on top (spec 08): the panel ignores Escape, and below 1024px
   * its sheet isn't shown, so only one modal layer is open. It stays mounted, keeping its
   * edits and its history entry, and comes back when the dialog closes.
   */
  covered?: boolean;
  children: React.ReactNode;
}) {
  const narrow = useNarrow();
  const hydrated = useHydrated();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { close, closed } = closer;

  // Focus the heading when the panel opens (and when it moves between side panel and sheet).
  useEffect(() => {
    headingRef.current?.focus();
  }, [narrow]);

  // When the panel goes away: return focus to its row's title link, and drop a
  // "opened from the list" marker that a close didn't consume (spec 07 fix 2).
  useEffect(() => {
    const ownUrl = `${window.location.pathname}${window.location.search}`;
    const closedRef = closed;
    return () => {
      if (!closedRef.current) clearOpenedMarker(ownUrl);
      requestAnimationFrame(() => {
        if (![...document.querySelectorAll("[data-panel]")].some(visible)) {
          // The visible one: Next keeps recently visited routes mounted but hidden, and a hidden
          // list can hold a link with the same id (review 07, finding 1).
          [...document.querySelectorAll<HTMLElement>(`[data-item-link="${itemId}"]`)].find(visible)?.focus();
        }
      });
    };
  }, [itemId, closed]);

  const requestClose = useCallback(() => {
    if (isDirty) setConfirmOpen(true);
    else close({ saved: false });
  }, [isDirty, close]);

  // Escape closes (or asks first), unless something inside already handled it.
  useEffect(() => {
    if (narrow || covered) return; // the sheet handles Escape itself; the dialog on top owns it
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || confirmOpen) return;
      if (document.querySelector('[data-slot="popover-content"], [role="listbox"]')) return;
      requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [requestClose, confirmOpen, narrow, covered]);

  const body = (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col" aria-label={regionLabel.replace(/^Edit /, "")}>
      {/* Controls stay disabled until hydration, so nothing typed before then is lost (spec 06 fix). */}
      <fieldset disabled={!hydrated} className="contents [&_:disabled]:opacity-100">
        <div className="flex flex-col gap-2 border-b border-border px-6 py-5">
          <div className="flex items-center justify-between">
            <span className={cn("text-[13px] text-muted-foreground", captionClassName)}>{caption}</span>
            <button
              type="button"
              onClick={requestClose}
              aria-label="Close"
              title="Close"
              className="flex size-[30px] items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <XIcon aria-hidden="true" className="size-[17px]" />
            </button>
          </div>
          <h2 ref={headingRef} tabIndex={-1} className="text-[22px] leading-tight font-semibold tracking-[-0.01em] text-pretty break-words outline-none">
            {heading}
          </h2>
          {subLink ? (
            <Link href={subLink.href} className="text-sm">
              {subLink.label}
            </Link>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-6 py-5">{children}</div>

        <div className="flex items-center gap-2 border-t border-border px-6 py-4">
          <Link href={detail.href} className="flex items-center gap-1.5 text-sm">
            {detail.label} <ArrowUpRightIcon aria-hidden="true" className="size-3.5" />
          </Link>
          <Button type="button" variant="outline" className="ml-auto" onClick={requestClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </fieldset>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>Your changes haven&apos;t been saved.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Keep editing
            </Button>
            <Button
              type="button"
              onClick={() => {
                setConfirmOpen(false);
                close({ saved: false });
              }}
            >
              Discard
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );

  if (narrow) {
    if (covered) return null;
    return (
      <Sheet open onOpenChange={(next) => (next ? null : requestClose())}>
        <SheetContent side="right" showCloseButton={false} aria-label={regionLabel} data-panel="" className="w-full gap-0 bg-surface p-0 sm:max-w-[400px]">
          <SheetTitle className="sr-only">{regionLabel}</SheetTitle>
          {body}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <section
      aria-label={regionLabel}
      data-panel=""
      // Fix 3 (spec 07): hidden below 1024px, so narrow screens never flash the side panel before the sheet.
      className="flex w-[min(400px,42vw)] min-w-[320px] shrink-0 flex-col border-l border-border bg-surface max-lg:hidden print:hidden"
    >
      {body}
    </section>
  );
}
