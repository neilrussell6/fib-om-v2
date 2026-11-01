import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

/** Spec 01: the Dashboard has a heading and no other content for now. */
export default function DashboardPage() {
  return <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-foreground">Dashboard</h1>;
}
