import { Suspense } from "react";
import { MobileNav } from "@/components/app-shell/app-nav";
import { Sidebar } from "@/components/app-shell/sidebar";
import { requireSession } from "@/lib/auth";

async function Content({ children }: { children: React.ReactNode }) {
  // Defence in depth behind proxy.ts: never render app content without a session.
  await requireSession();
  return <>{children}</>;
}

/**
 * The app shell (spec 06): a collapsible sidebar beside the page, no top bar.
 * Below md a slim bar opens the same navigation in a sheet.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex h-screen min-h-[600px] flex-1 overflow-hidden bg-background print:block print:h-auto print:overflow-visible">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-sidebar px-3 md:hidden print:hidden">
          <Suspense fallback={null}>
            <MobileNav />
          </Suspense>
          <span className="text-base font-semibold">Fibatron</span>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto px-4 pt-7 pb-4 md:px-8 print:overflow-visible print:p-0">
          <Suspense fallback={null}>
            <Content>{children}</Content>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
