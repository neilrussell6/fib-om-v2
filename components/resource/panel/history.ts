/**
 * Panel and dialog history (spec 07 fix 2, layered in spec 08). A panel or create
 * dialog opened from the list adds one history entry; closing it goes back instead
 * of adding another, so the next Back leaves the list. One loaded directly (reload,
 * shared link) or whose list URL changed while open closes with `replace`, so
 * closing never leaves the app.
 *
 * The "opened from the list" marker is a list in sessionStorage with one URL per
 * open layer (a panel, and a dialog over it), so opening the dialog doesn't wipe the
 * panel's entry. Every storage access is guarded: without storage, or with anything
 * that isn't a list of strings stored, closing simply replaces.
 */

export type PanelRouter = {
  push: (href: string, options?: { scroll?: boolean }) => void;
  replace: (href: string, options?: { scroll?: boolean }) => void;
  back: () => void;
  refresh: () => void;
};

const KEY = "panel-opened";
/** A panel and a dialog: a few entries at most; older ones are dropped. */
const MAX = 4;

/** `pathname?search` for an href or the current location, so equal URLs compare equal. */
function normalise(href: string): string {
  const u = new URL(href, "http://panel.local");
  return `${u.pathname}${u.search}`;
}

const currentUrl = () => `${window.location.pathname}${window.location.search}`;

function read(): string[] {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return [];
    const list: unknown = JSON.parse(raw);
    return Array.isArray(list) && list.every((x) => typeof x === "string") ? list : [];
  } catch {
    return []; // storage unavailable, or the old single-URL value
  }
}

function write(list: string[]): void {
  try {
    if (!list.length) window.sessionStorage.removeItem(KEY);
    else window.sessionStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch {
    // Storage unavailable: closing falls back to replace.
  }
}

function add(href: string): void {
  const url = normalise(href);
  write([...read().filter((x) => x !== url), url]);
}

/** Records that the layer at `href` was opened from the list (the toast's View action). */
export function markOpenedFromList(href: string): void {
  add(href);
}

/**
 * Opens a panel (`key` "item") or the create dialog (`key` "new") from the list. When
 * the key isn't in the URL yet it's a new layer: mark it and push. When it is (switching
 * rows in an open panel) replace, so history stays "list → panel", and hand the entry
 * on only when the current panel was itself opened from the list.
 */
export function openPanel(router: PanelRouter, href: string, key = "item"): void {
  const alreadyOpen = new URLSearchParams(window.location.search).has(key);
  if (!alreadyOpen) {
    add(href);
    router.push(href, { scroll: false });
    return;
  }
  const list = read();
  const current = normalise(currentUrl());
  if (list.includes(current)) write(list.map((x) => (x === current ? normalise(href) : x)));
  router.replace(href, { scroll: false });
}

/**
 * Closes the top layer: back when it was opened from the list, otherwise replace;
 * refresh after a save. Afterwards only the layer underneath (`baseHref`) keeps an
 * entry, so nothing stale is left.
 */
export function closePanel(router: PanelRouter, baseHref: string, { saved }: { saved: boolean }): void {
  const list = read();
  const marked = list.includes(normalise(currentUrl()));
  const base = normalise(baseHref);
  write(list.filter((x) => x === base));
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

/** Drops a layer's entry when it goes away without closing (navigating elsewhere, or a docket's replace to its page). */
export function clearOpenedMarker(ownHref: string): void {
  const own = normalise(ownHref);
  const list = read();
  if (list.includes(own)) write(list.filter((x) => x !== own));
}
