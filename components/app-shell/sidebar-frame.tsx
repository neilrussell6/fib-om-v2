"use client";

import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { NAV_GROUPS } from "./nav-items";
import { SidebarNav } from "./sidebar-nav";
import { SIDEBAR_COOKIE, type SidebarState } from "./sidebar-state";

const ONE_YEAR = 60 * 60 * 24 * 365;
/** Matches the CSS default in globals.css: open from 1280px when no cookie is set. */
const OPEN_BY_DEFAULT = "(min-width: 1280px)";

function subscribeWide(onChange: () => void) {
  const mq = window.matchMedia(OPEN_BY_DEFAULT);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
/** Whether the no-cookie default is "open"; the server snapshot assumes open (hydration-safe). */
function useOpenByDefault(): boolean {
  return useSyncExternalStore(subscribeWide, () => window.matchMedia(OPEN_BY_DEFAULT).matches, () => true);
}

/** Reads the active path; only rendered inside a Suspense boundary (dynamic routes). */
function ActiveNav() {
  return <SidebarNav groups={NAV_GROUPS} activeHref={usePathname()} />;
}

/**
 * The desktop sidebar (spec 06). Width comes from `data-state` (the cookie) or,
 * with no cookie, from a media query in globals.css, so the first paint is right.
 * The Suspense fallback renders this same frame without state, path or footer.
 */
export function SidebarFrame({
  initialState,
  withActivePath = false,
  footer,
}: {
  initialState?: SidebarState;
  withActivePath?: boolean;
  footer?: React.ReactNode;
}) {
  const [state, setState] = useState<SidebarState | undefined>(initialState);
  const openByDefault = useOpenByDefault();
  const effective: SidebarState = state ?? (openByDefault ? "open" : "collapsed");

  const toggle = () => {
    const next: SidebarState = effective === "open" ? "collapsed" : "open";
    document.cookie = `${SIDEBAR_COOKIE}=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
    setState(next);
  };

  const label = effective === "open" ? "Collapse sidebar" : "Expand sidebar";
  return (
    <aside
      data-testid="sidebar"
      data-state={state}
      aria-label="Sidebar"
      className="sidebar hidden shrink-0 flex-col gap-[18px] overflow-hidden border-r border-sidebar-border bg-sidebar px-2.5 py-4 md:flex print:hidden"
    >
      <div className="flex min-h-8 items-center justify-between gap-2">
        <div className="sidebar-label px-2 text-lg font-semibold tracking-[-0.01em] whitespace-nowrap text-foreground">Fibatron</div>
        <button
          type="button"
          onClick={toggle}
          aria-label={label}
          title={label}
          className="sidebar-toggle mr-auto flex h-8 w-[34px] shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          <PanelLeftCloseIcon aria-hidden="true" className="sidebar-icon-open size-[18px]" />
          <PanelLeftOpenIcon aria-hidden="true" className="sidebar-icon-collapsed size-[18px]" />
        </button>
      </div>
      <nav aria-label="Main">{withActivePath ? <ActiveNav /> : <SidebarNav groups={NAV_GROUPS} />}</nav>
      <div className="mt-auto border-t border-sidebar-border px-1 pt-2.5">{footer}</div>
    </aside>
  );
}
