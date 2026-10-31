import { Suspense } from "react";
import { DesktopSidebar, MobileNav } from "@/components/app-shell/app-nav";
import { SignOutButton } from "@/components/app-shell/sign-out-button";
import { requireSession } from "@/lib/auth";

/** Reads the session, so it streams in behind the static shell (Cache Components). */
async function SignedInUser() {
  const session = await requireSession();
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-sidebar-foreground" data-testid="signed-in-email">
        {session.user?.email}
      </span>
      <SignOutButton />
    </div>
  );
}

async function Content({ children }: { children: React.ReactNode }) {
  // Defence in depth behind proxy.ts: never render app content without a session.
  await requireSession();
  return <>{children}</>;
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-sidebar">
      <header className="flex h-14 items-center justify-between gap-3 px-4 text-sidebar-foreground">
        <div className="flex items-center gap-2">
          <Suspense fallback={null}>
            <MobileNav />
          </Suspense>
          <span className="text-lg font-semibold">Fibatron</span>
        </div>
        <Suspense fallback={null}>
          <SignedInUser />
        </Suspense>
      </header>
      <div className="flex flex-1">
        <Suspense fallback={<aside className="hidden w-60 shrink-0 md:block" />}>
          <DesktopSidebar />
        </Suspense>
        <main className="flex-1 bg-background p-6 text-foreground">
          <Suspense fallback={null}>
            <Content>{children}</Content>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
