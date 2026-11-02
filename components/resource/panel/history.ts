/**
 * Panel history (spec 07, fix 2). A panel opened from the list adds one history
 * entry; closing it goes back to the list instead of adding another, so the next
 * Back leaves the list. A panel loaded directly (reload, shared link) or whose
 * list URL changed while open closes with `replace`, so closing never leaves the app.
 *
 * The "opened from the list" marker is the panel URL in sessionStorage. Every
 * storage access is guarded: without storage, closing simply replaces.
 */

export type PanelRouter = {
  push: (href: string, options?: { scroll?: boolean }) => void;
  replace: (href: string, options?: { scroll?: boolean }) => void;
  back: () => void;
  refresh: () => void;
};

const KEY = "panel-opened";

/** `pathname?search` for an href or the current location, so equal URLs compare equal. */
function normalise(href: string): string {
  const u = new URL(href, "http://panel.local");
  return `${u.pathname}${u.search}`;
}

const currentUrl = () => `${window.location.pathname}${window.location.search}`;

function read(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function write(href: string | null): void {
  try {
    if (href === null) window.sessionStorage.removeItem(KEY);
    else window.sessionStorage.setItem(KEY, normalise(href));
  } catch {
    // Storage unavailable: closing falls back to replace.
  }
}

/** Records that the panel at `href` was opened from the list (the toast's View action). */
export function markOpenedFromList(href: string): void {
  write(href);
}

/**
 * Opens a panel from the list. With no panel open it marks the target and pushes;
 * with a panel already open it replaces (so history stays "list → panel") and hands
 * the marker on only when the current panel was itself opened from the list.
 */
export function openPanel(router: PanelRouter, href: string): void {
  const panelOpen = new URLSearchParams(window.location.search).has("item");
  if (!panelOpen) {
    write(href);
    router.push(href, { scroll: false });
    return;
  }
  const marked = read() === normalise(currentUrl());
  write(marked ? href : null);
  router.replace(href, { scroll: false });
}

/** Closes the panel: back to the list when it was opened from there, otherwise replace; refresh after a save. */
export function closePanel(router: PanelRouter, baseHref: string, { saved }: { saved: boolean }): void {
  const marked = read() === normalise(currentUrl());
  write(null);
  if (!marked) {
    router.replace(baseHref, { scroll: false });
    if (saved) router.refresh();
    return;
  }
  // Going back restores the cached list from before the save, so refresh once back there.
  if (saved) afterBack(() => router.refresh());
  router.back();
}

/** Runs `fn` once the Back navigation has landed (popstate), or at once where that can't be observed. */
function afterBack(fn: () => void): void {
  if (typeof window.addEventListener !== "function") {
    fn();
    return;
  }
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    window.removeEventListener("popstate", run);
    // Let the router apply the restored entry before refreshing it.
    setTimeout(fn, 0);
  };
  window.addEventListener("popstate", run);
  setTimeout(run, 1000);
}

/** Clears the marker when a panel goes away without closing, unless a newer panel's marker replaced it. */
export function clearOpenedMarker(ownHref: string): void {
  if (read() === normalise(ownHref)) write(null);
}
