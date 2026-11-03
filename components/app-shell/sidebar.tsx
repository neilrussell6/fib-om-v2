import { cookies } from "next/headers";
import { Suspense } from "react";
import { requireSession } from "@/lib/auth";
import { SidebarFrame } from "./sidebar-frame";
import { SIDEBAR_COOKIE, type SidebarState } from "./sidebar-state";
import { SignOutButton } from "./sign-out-button";

/** Name if set and not blank, otherwise the email (spec 06). */
export function displayName(user: { name?: string | null; email: string }): string {
  return user.name?.trim() || user.email;
}

/**
 * Avatar, name (or email) and Sign out. Reads the session, so it streams in. The name comes
 * from the session check's own lookup (spec 09 P2), so there's no second `users` query; a
 * token from before that change, or one kept after a failed lookup, shows the email.
 */
async function SidebarUser() {
  const session = await requireSession();
  const shown = displayName({ name: session.user?.name, email: session.user?.email ?? "" });
  return (
    <div data-testid="sidebar-user" className="flex items-center gap-2.5">
      <div
        data-testid="avatar"
        aria-hidden="true"
        className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-avatar text-[13px] font-semibold text-white"
      >
        {shown.charAt(0).toUpperCase()}
      </div>
      <div className="sidebar-label flex min-w-0 flex-col items-start whitespace-nowrap">
        <span className="max-w-[150px] truncate text-[13px] font-medium" data-testid="signed-in-email">
          {shown}
        </span>
        <SignOutButton />
      </div>
    </div>
  );
}

/** Reads the collapse cookie; kept inside Suspense so the static shell stays prerenderable. */
async function SidebarWithState() {
  const value = (await cookies()).get(SIDEBAR_COOKIE)?.value;
  const state: SidebarState | undefined = value === "open" || value === "collapsed" ? value : undefined;
  return (
    <SidebarFrame
      initialState={state}
      withActivePath
      footer={
        <Suspense fallback={null}>
          <SidebarUser />
        </Suspense>
      }
    />
  );
}

/**
 * The desktop sidebar (spec 06). The fallback is the same frame in its no-cookie
 * layout, so the width never changes while the page loads.
 */
export function Sidebar() {
  return (
    <Suspense fallback={<SidebarFrame />}>
      <SidebarWithState />
    </Suspense>
  );
}
