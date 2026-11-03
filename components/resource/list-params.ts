import { getResource } from "@/lib/resources";
import type { ResourceKey } from "@/lib/resources/types";

/**
 * List URL helpers (spec 02, 07, 08), kept free of server-only imports so they can be
 * unit tested and shared by every list page (spec 09).
 */

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** The list's "New …" link: the list's current query plus `new=1` (spec 08). */
export const newHref = (path: string, query: string) => `${path}?${query ? `${query}&` : ""}new=1`;

/** The current URL's query without the `drop` keys (so opening and closing a panel or dialog keeps the list as it is). */
export function queryWithout(sp: Record<string, string | string[] | undefined>, ...drop: string[]): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (drop.includes(k) || v === undefined) continue;
    for (const x of Array.isArray(v) ? v : [v]) params.append(k, x);
  }
  return params.toString();
}

/** The list query's params from the URL: only the resource's own filter keys and column sort keys (spec 02). */
export function listParamsFromUrl(resourceKey: ResourceKey, sp: Record<string, string | string[] | undefined>) {
  const ui = getResource(resourceKey);
  const filters = Object.fromEntries(ui.list.filters.map((f) => [f.key, first(sp[f.key])]).filter(([, v]) => v)) as Record<string, string>;
  const sortParam = first(sp.sort);
  const sort = ui.list.columns.some((c) => c.key === sortParam) ? sortParam : undefined;
  const dirParam = first(sp.dir);
  const dir: "asc" | "desc" | undefined = sort ? (dirParam === "desc" ? "desc" : "asc") : undefined;
  return { filters, sort, dir, page: Number(first(sp.page)) || 1, pageSize: Number(first(sp.pageSize)) || undefined };
}
