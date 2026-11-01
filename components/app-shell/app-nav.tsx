"use client";

import { MenuIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NAV_GROUPS } from "./nav-items";
import { SidebarNav } from "./sidebar-nav";

/** Below md the sidebar becomes a sheet opened from the slim mobile bar. */
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
            <MenuIcon aria-hidden="true" />
          </Button>
        }
      />
      <SheetContent side="left" className="w-64 bg-sidebar p-3 text-sidebar-foreground">
        <SheetHeader className="p-2">
          <SheetTitle className="text-foreground">Fibatron</SheetTitle>
        </SheetHeader>
        <nav aria-label="Main">
          <SidebarNav groups={NAV_GROUPS} activeHref={pathname} onNavigate={() => setOpen(false)} />
        </nav>
      </SheetContent>
    </Sheet>
  );
}
