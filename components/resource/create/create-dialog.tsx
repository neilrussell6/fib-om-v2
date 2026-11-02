"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { clearOpenedMarker, closePanel } from "../panel/history";

const noopSubscribe = () => () => {};
/** False during server render and hydration, true once React owns the inputs. */
const useHydrated = () => useSyncExternalStore(noopSubscribe, () => true, () => false);

const visible = (el: Element) => el.getClientRects().length > 0;

/** The first field in the dialog body: an input, select, textarea or combobox trigger. */
const FIELD_SELECTOR =
  'input:not([type="hidden"]):not([readonly]):not([aria-hidden="true"]), select, textarea, [role="combobox"], [role="switch"]';

export type CreateCloser = {
  close: (opts: { saved: boolean }) => void;
  /** Set when the dialog leaves by its own close or navigation, so unmounting doesn't clear a marker it already consumed. */
  closed: React.RefObject<boolean>;
};

/** Closing for a create dialog (spec 08): the panels' history rules, back to the list URL without `new`. */
export function useCreateCloser(baseHref: string): CreateCloser {
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

/**
 * The create dialog's frame (spec 08, from the design's "New order item" popup):
 * overlay, header with title, description and ×, a scrolling body, and the footer with
 * Create another, Cancel and Add. Escape, × , Cancel and an overlay click close it,
 * asking "Discard changes?" first when anything was entered. The fields are its children.
 */
export function CreateDialog({
  title,
  description,
  addLabel,
  allowCreateAnother,
  createAnother,
  onCreateAnotherChange,
  isDirty,
  pending,
  onSubmit,
  closer,
  children,
}: {
  title: string;
  description: string;
  addLabel: string;
  allowCreateAnother: boolean;
  createAnother: boolean;
  onCreateAnotherChange: (v: boolean) => void;
  isDirty: boolean;
  pending: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  closer: CreateCloser;
  children: React.ReactNode;
}) {
  const hydrated = useHydrated();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const anotherId = useId();
  const { close, closed } = closer;

  // When the dialog goes away: drop a marker a close didn't consume, and return focus to
  // the list's "New …" button (unless a panel sheet took over below 1024px).
  useEffect(() => {
    const ownUrl = `${window.location.pathname}${window.location.search}`;
    const closedRef = closed;
    return () => {
      if (!closedRef.current) clearOpenedMarker(ownUrl);
      requestAnimationFrame(() => {
        if ([...document.querySelectorAll('[role="dialog"]')].some(visible)) return;
        [...document.querySelectorAll<HTMLElement>("[data-create-trigger]")].find(visible)?.focus();
      });
    };
  }, [closed]);

  const requestClose = useCallback(() => {
    if (isDirty) setConfirmOpen(true);
    else close({ saved: false });
  }, [isDirty, close]);

  const firstField = () => bodyRef.current?.querySelector<HTMLElement>(FIELD_SELECTOR) ?? null;

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        // Escape, an overlay click or ×: the URL decides when the dialog is gone.
        if (!next && !confirmOpen) requestClose();
      }}
    >
      <DialogPortal>
        <DialogOverlay data-create-dialog-overlay="" className="bg-[rgba(18,30,34,.42)] supports-backdrop-filter:backdrop-blur-none" />
        <DialogPrimitive.Popup
          aria-modal="true"
          initialFocus={() => firstField() ?? true}
          finalFocus={false}
          className="create-dialog fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-48px)] w-[calc(100%-48px)] max-w-[560px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[10px] bg-background text-foreground shadow-[0_24px_60px_rgba(0,0,0,.22)] outline-none max-sm:inset-0 max-sm:h-dvh max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none"
        >
          <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col" aria-label={title}>
            {/* Controls stay disabled until hydration, so nothing typed before then is lost (spec 06 fix).
                Only then are they kept from looking faded; afterwards disabled controls fade as usual (review 08). */}
            <fieldset disabled={!hydrated} className={cn("contents", !hydrated && "[&_:disabled]:opacity-100")}>
              <div className="flex items-start justify-between gap-4 border-b border-border px-6 pt-5 pb-4">
                <div className="flex flex-col gap-1">
                  <DialogTitle render={<h2 />} className="font-sans text-xl leading-tight font-semibold tracking-[-0.01em]">
                    {title}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">{description}</DialogDescription>
                </div>
                <button
                  type="button"
                  onClick={requestClose}
                  aria-label="Close"
                  title="Close"
                  className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-pill focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <XIcon aria-hidden="true" className="size-[17px]" />
                </button>
              </div>

              <div ref={bodyRef} data-create-dialog-body="" className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-auto px-6 py-5">
                {children}
              </div>

              <div data-create-dialog-footer="" className="flex items-center gap-2 border-t border-border bg-surface px-6 py-3.5">
                {allowCreateAnother ? (
                  <label htmlFor={anotherId} className="flex items-center gap-2 text-sm text-label">
                    <Checkbox id={anotherId} checked={createAnother} onCheckedChange={(v) => onCreateAnotherChange(Boolean(v))} />
                    Create another
                  </label>
                ) : null}
                <Button type="button" variant="outline" className="ml-auto" onClick={requestClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Adding…" : addLabel}
                </Button>
              </div>
            </fieldset>
          </form>

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
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}
