"use client";

import { MenuIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NAV_ITEMS } from "./nav-items";
import { SidebarNav } from "./sidebar-nav";

/** Desktop sidebar (md and up). */
export function DesktopSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 bg-sidebar p-3 md:block print:hidden">
      <nav aria-label="Main">
        <SidebarNav items={NAV_ITEMS} activeHref={pathname} />
      </nav>
    </aside>
  );
}

/** Below md the sidebar collapses into a sheet opened from the top bar. */
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="text-sidebar-foreground md:hidden" aria-label="Open menu">
            <MenuIcon aria-hidden="true" />
          </Button>
        }
      />
      <SheetContent side="left" className="w-64 bg-sidebar p-3 text-sidebar-foreground">
        <SheetHeader className="p-2">
          <SheetTitle className="text-sidebar-foreground">Fibatron</SheetTitle>
        </SheetHeader>
        <nav aria-label="Main">
          <SidebarNav items={NAV_ITEMS} activeHref={pathname} onNavigate={() => setOpen(false)} />
        </nav>
      </SheetContent>
    </Sheet>
  );
}
