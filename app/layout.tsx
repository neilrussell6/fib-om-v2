import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Spec 06: the design's type, self-hosted by next/font (no runtime request to Google).
const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans", display: "swap" });
/**
 * Spec 06 AC-5: applies the sidebar cookie before first paint, so the sidebar's Suspense
 * fallback already has the chosen width (no jump when the streamed sidebar arrives).
 */
const SIDEBAR_BOOT = `try{var m=document.cookie.match(/(?:^|; )sidebar=(open|collapsed)/);if(m)document.documentElement.dataset.sidebar=m[1]}catch(e){}`;

const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Fibatron", template: "%s · Fibatron" },
  description: "Fibatron order management",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SIDEBAR_BOOT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <NuqsAdapter>{children}</NuqsAdapter>
        <Toaster />
      </body>
    </html>
  );
}
