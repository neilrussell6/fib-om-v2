import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

/** Spec 01: the Dashboard has a heading and no other content for now. */
export default function DashboardPage() {
  return <h1 className="text-2xl font-semibold text-secondary">Dashboard</h1>;
}
