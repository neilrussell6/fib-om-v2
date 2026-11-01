import Link from "next/link";
import { cn } from "@/lib/utils";
import type { NavGroup } from "./nav-items";

function isActive(href: string, activeHref: string | undefined): boolean {
  if (activeHref === undefined) return false;
  return href === "/" ? activeHref === "/" : activeHref === href || activeHref.startsWith(`${href}/`);
}

/**
 * The grouped navigation (spec 06). Labels and group headings carry the
 * `sidebar-label` class, which the collapsed sidebar hides (see globals.css);
 * each link keeps its name through `aria-label` and a `title` tooltip.
 */
export function SidebarNav({
  groups,
  activeHref,
  onNavigate,
  collapsed,
}: {
  groups: NavGroup[];
  activeHref?: string;
  onNavigate?: () => void;
  /** Forces the icon-only layout (otherwise the sidebar's data-state / media query decides). */
  collapsed?: boolean;
}) {
  return (
    <div className="flex flex-col gap-[18px]">
      {groups.map((g) => (
        <div key={g.label} className="flex flex-col gap-0.5">
          <div
            className={cn(
              "sidebar-label px-2.5 pb-1.5 text-[11px] tracking-[0.08em] whitespace-nowrap text-subtle-foreground uppercase",
              collapsed && "hidden",
            )}
          >
            {g.label}
          </div>
          <ul className="flex flex-col gap-0.5">
            {g.items.map(({ label, href, icon: Icon }) => {
              const active = isActive(href, activeHref);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-label={label}
                    title={label}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-[34px] items-center gap-2.5 rounded-md px-2.5 text-sm whitespace-nowrap text-label no-underline outline-none",
                      "hover:bg-accent hover:no-underline focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                      active && "bg-primary font-medium text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                    )}
                  >
                    <Icon data-testid="nav-icon" aria-hidden="true" className="size-[17px] shrink-0" />
                    <span className={cn("sidebar-label", collapsed && "hidden")}>{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
