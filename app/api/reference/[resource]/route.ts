import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchReferences } from "@/lib/db/reference-search";
import { isId } from "@/lib/ids";
import { isResourceKey } from "@/lib/resources/types";

/** Reference-combobox options (spec 02): at most 25, signed-in staff only. */
export async function GET(request: Request, { params }: RouteContext<"/api/reference/[resource]">) {
  if (!(await auth())?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { resource } = await params;
  if (!isResourceKey(resource)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? undefined;
  const clientId = url.searchParams.get("clientId") ?? undefined;
  // Spec 09 B1: a malformed id is the caller's error, not a 500.
  if ([id, clientId].some((v) => v !== undefined && v !== "" && !isId(v))) {
    return NextResponse.json({ error: "invalid id" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const options = await searchReferences(resource, { q: url.searchParams.get("q") ?? undefined, id, clientId });
  return NextResponse.json(options, { headers: { "Cache-Control": "no-store" } });
}
