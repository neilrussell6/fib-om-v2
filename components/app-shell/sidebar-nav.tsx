import Link from "next/link";
import { cn } from "@/lib/utils";
import type { NavItem } from "./nav-items";

function isActive(href: string, activeHref: string): boolean {
  return href === "/" ? activeHref === "/" : activeHref === href || activeHref.startsWith(`${href}/`);
}

export function SidebarNav({
  items,
  activeHref,
  onNavigate,
}: {
  items: NavItem[];
  activeHref: string;
  onNavigate?: () => void;
}) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map(({ label, href, icon: Icon }) => {
        const active = isActive(href, activeHref);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground outline-none",
                "hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                active && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary",
              )}
            >
              <Icon data-testid="nav-icon" aria-hidden="true" className="size-4 shrink-0" />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
