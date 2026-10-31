import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchReferences } from "@/lib/db/reference-search";
import { isResourceKey } from "@/lib/resources/types";

/** Reference-combobox options (spec 02): at most 25, signed-in staff only. */
export async function GET(request: Request, { params }: RouteContext<"/api/reference/[resource]">) {
  if (!(await auth())?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { resource } = await params;
  if (!isResourceKey(resource)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const url = new URL(request.url);
  const options = await searchReferences(resource, {
    q: url.searchParams.get("q") ?? undefined,
    id: url.searchParams.get("id") ?? undefined,
    clientId: url.searchParams.get("clientId") ?? undefined,
  });
  return NextResponse.json(options, { headers: { "Cache-Control": "no-store" } });
}
