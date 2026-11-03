import { query } from "@/lib/db";
import { queryConfig, UnknownKeyError } from "@/lib/db/list-query";
import { isId } from "@/lib/ids";
import type { ResourceKey } from "@/lib/resources";

export const OPTIONS_LIMIT = 25;

export type ReferenceOption = { id: number; label: string };

/**
 * Options for a reference combobox: at most 25, matching the search text
 * anywhere and case-insensitively, or a single option by id (to label a
 * stored value). Delivery dockets can be narrowed to one client.
 */
export async function searchReferences(
  key: ResourceKey,
  opts: { q?: string; id?: number | string; clientId?: number | string },
): Promise<ReferenceOption[]> {
  const { options } = queryConfig(key);
  // A malformed id never reaches Postgres, where the bigint cast would fail the request (spec 09 B1).
  for (const [name, v] of [["id", opts.id], ["clientId", opts.clientId]] as const) {
    if (v !== undefined && v !== "" && !isId(v)) throw new UnknownKeyError(`Invalid ${name}: ${String(v)}`);
  }
  const where: string[] = [];
  const values: unknown[] = [];
  if (opts.id !== undefined && opts.id !== "") {
    values.push(opts.id);
    where.push(`id = $${values.length}::bigint`);
  }
  if (opts.q?.trim()) {
    values.push(opts.q.trim().replace(/[\\%_]/g, (c) => `\\${c}`));
    where.push(`(${options.label}) ILIKE '%' || $${values.length} || '%'`);
  }
  if (opts.clientId !== undefined && opts.clientId !== "" && options.byClientColumn) {
    values.push(opts.clientId);
    where.push(`${options.byClientColumn} = $${values.length}::bigint`);
  }
  const rows = await query<{ id: string; label: string }>(
    `SELECT id, ${options.label} AS label FROM ${options.source}
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY ${options.orderBy} LIMIT ${OPTIONS_LIMIT}`,
    values,
  );
  return rows.map((r) => ({ id: Number(r.id), label: r.label }));
}
