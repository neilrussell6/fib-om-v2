import { query } from "@/lib/db";
import { type FilterSql, QUERIES, type QueryConfig } from "@/lib/db/queries";
import { getResource, isResourceKey, type ResourceKey } from "@/lib/resources";

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

export class UnknownKeyError extends Error {}

export function normalisePageSize(n: unknown): number {
  const v = Number(n);
  return (PAGE_SIZES as readonly number[]).includes(v) ? v : DEFAULT_PAGE_SIZE;
}

export type ListParams = {
  filters?: Record<string, string | undefined>;
  sort?: string;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type ListResult = {
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
  sort: string;
  dir: "asc" | "desc";
};

export function queryConfig(key: string): QueryConfig {
  if (!isResourceKey(key)) throw new UnknownKeyError(`Unknown resource: ${key}`);
  return QUERIES[key];
}

/** Escapes LIKE wildcards so user text matches literally. */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const INT_RANGE = { integer: [-2147483648, 2147483647], bigint: [1, Number.MAX_SAFE_INTEGER] } as const;

/**
 * Whether a URL filter value fits its column type. Invalid values (a mistyped
 * date, a non-numeric id) are ignored rather than sent to Postgres, where the
 * cast would fail the whole page (review 02, finding 1).
 */
function isValidValue(f: FilterSql, value: string, options?: string[]): boolean {
  if (f.kind === "contains") return true;
  switch (f.cast) {
    case "date": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const d = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
    }
    case "integer":
    case "bigint": {
      if (!/^-?\d+$/.test(value)) return false;
      const n = Number(value);
      const [min, max] = INT_RANGE[f.cast];
      return n >= min && n <= max;
    }
    default:
      // Enum columns: only the filter's own options.
      return options ? options.includes(value) : true;
  }
}

function condition(f: FilterSql, param: number): string {
  switch (f.kind) {
    case "contains":
      return `${f.column} ILIKE '%' || $${param} || '%'`;
    case "eq":
      return f.cast ? `${f.column} = $${param}::${f.cast}` : `${f.column} = $${param}`;
    case "gte":
      return `${f.column} >= $${param}::${f.cast}`;
    case "lte":
      return `${f.column} <= $${param}::${f.cast}`;
  }
}

/**
 * One page of a resource's list, filtered and sorted only by allowlisted keys,
 * with the total from count(*) OVER () in the same query (overview O5).
 */
export async function listRecords(key: ResourceKey, params: ListParams): Promise<ListResult> {
  const cfg = queryConfig(key);
  const ui = getResource(key);

  const where: string[] = [];
  const values: unknown[] = [];
  for (const [name, raw] of Object.entries(params.filters ?? {})) {
    const f = cfg.filters[name];
    if (!f) throw new UnknownKeyError(`Unknown filter: ${name}`);
    if (raw === undefined || raw.trim() === "") continue;
    const value = raw.trim();
    const options = ui.list.filters.find((x) => x.key === name)?.options?.map((o) => o.value);
    if (!isValidValue(f, value, options)) continue;
    values.push(f.kind === "contains" ? likeEscape(value) : value);
    where.push(condition(f, values.length));
  }

  const sort = params.sort ?? ui.list.defaultSort.key;
  const column = cfg.sorts[sort];
  if (!column) throw new UnknownKeyError(`Unknown sort: ${sort}`);
  const dir = params.dir ?? (params.sort ? "asc" : ui.list.defaultSort.dir);
  const direction = dir === "desc" ? "DESC" : "ASC";

  const pageSize = normalisePageSize(params.pageSize);
  const page = Math.max(1, Math.floor(Number(params.page) || 1));
  values.push(pageSize, (page - 1) * pageSize);

  const rows = await query<Record<string, unknown>>(
    `SELECT ${cfg.select}, count(*) OVER () AS __total FROM ${cfg.source}
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY ${column} ${direction} NULLS LAST, id ${direction}
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  const total = rows.length ? Number(rows[0].__total) : 0;
  for (const r of rows) delete r.__total;
  return { rows, total, page, pageSize, sort, dir };
}
