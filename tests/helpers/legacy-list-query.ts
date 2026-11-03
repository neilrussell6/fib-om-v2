// Test-only oracle (spec 09 P1, AC-6): the single-statement list query as it was before the
// ids + count rewrite, kept so the new listRecords can be compared against it on fixture data.
// Copied from lib/db/list-query.ts at commit 21694ed; it reuses the exported builder pieces
// only for filters, so its SQL shape (one SELECT with count(*) OVER ()) stays the old one.
import { withDb } from "./test-db";
import { QUERIES } from "@/lib/db/queries";
import { getResource, type ResourceKey } from "@/lib/resources";

export async function legacyListIds(
  key: ResourceKey,
  opts: { where?: string[]; values?: unknown[]; sort?: string; dir?: "asc" | "desc"; page?: number; pageSize?: number },
): Promise<{ ids: number[]; total: number }> {
  const cfg = QUERIES[key];
  const ui = getResource(key);
  const where = opts.where ?? [];
  const values = [...(opts.values ?? [])];
  const sort = opts.sort ?? ui.list.defaultSort.key;
  const column = cfg.sorts[sort];
  const dir = opts.dir ?? (opts.sort ? "asc" : ui.list.defaultSort.dir);
  const direction = dir === "desc" ? "DESC" : "ASC";
  const pageSize = opts.pageSize ?? 25;
  const page = opts.page ?? 1;
  values.push(pageSize, (page - 1) * pageSize);
  const rows = await withDb(async (c) =>
    (
      await c.query(
        `SELECT ${cfg.select}, count(*) OVER () AS __total FROM ${cfg.source}
         ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
         ORDER BY ${column} ${direction} NULLS LAST, id ${direction}
         LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values,
      )
    ).rows,
  );
  return { ids: rows.map((r) => Number(r.id)), total: rows.length ? Number(rows[0].__total) : 0 };
}
