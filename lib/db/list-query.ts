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
  /** Status tab (spec 06/07): only for resources with `list.statusTabs`; unknown values mean All. */
  status?: string;
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
 * The WHERE conditions and values for a resource's allowlisted URL filters. Parameters are
 * numbered from `offset + 1`. Pure: no database access (spec 09, unit tested).
 */
export function filterWhere(
  key: ResourceKey,
  filters: Record<string, string | undefined>,
  offset = 0,
): { where: string[]; values: unknown[] } {
  const cfg = queryConfig(key);
  const ui = getResource(key);
  const where: string[] = [];
  const values: unknown[] = [];
  for (const [name, raw] of Object.entries(filters)) {
    const f = cfg.filters[name];
    if (!f) throw new UnknownKeyError(`Unknown filter: ${name}`);
    if (raw === undefined || raw.trim() === "") continue;
    const value = raw.trim();
    const options = ui.list.filters.find((x) => x.key === name)?.options?.map((o) => o.value);
    if (!isValidValue(f, value, options)) continue;
    values.push(f.kind === "contains" ? likeEscape(value) : value);
    where.push(condition(f, offset + values.length));
  }
  return { where, values };
}

/** The resource's status column, enum type and allowed values; throws for a resource without tabs (spec 07). */
function statusConfig(key: ResourceKey): { column: string; enumType: string; values: string[] } {
  const tabs = getResource(key).list.statusTabs;
  const col = queryConfig(key).statusColumn;
  if (!tabs || !col) throw new UnknownKeyError(`No status tabs on ${key}`);
  return { ...col, values: tabs.options.map((o) => o.value) };
}

/**
 * The status tab's condition as parameter `$param`, or null for an unknown status (All).
 * Throws for a resource without status tabs (spec 07).
 */
export function statusCondition(key: ResourceKey, status: string, param: number): { condition: string; value: string } | null {
  const st = statusConfig(key);
  if (!st.values.includes(status)) return null;
  return { condition: `${st.column} = $${param}::${st.enumType}`, value: status };
}

/**
 * The ORDER BY for an allowlisted sort key, with id as the tie-break in the same direction.
 * No sort means the resource's default sort and direction; an explicit sort defaults to asc.
 */
export function orderBy(key: ResourceKey, sort?: string, dir?: "asc" | "desc"): { sort: string; dir: "asc" | "desc"; sql: string } {
  const ui = getResource(key);
  const s = sort ?? ui.list.defaultSort.key;
  const column = queryConfig(key).sorts[s];
  if (!column) throw new UnknownKeyError(`Unknown sort: ${s}`);
  const d = dir ?? (sort ? "asc" : ui.list.defaultSort.dir);
  const direction = d === "desc" ? "DESC" : "ASC";
  return { sort: s, dir: d, sql: `${column} ${direction} NULLS LAST, id ${direction}` };
}

/**
 * One page of a resource's list, filtered and sorted only by allowlisted keys (overview O5).
 *
 * Spec 09 P1: a page of ids and the total are two statements run side by side, then only
 * those rows are read. `count(*) OVER ()` made Postgres build the whole filtered set for
 * every page (~800 ms at 200k order items). The total is the real count even past the last
 * page. Rows and total come from separate statements, so under concurrent writes they can
 * disagree by a few rows; that's accepted.
 */
export async function listRecords(key: ResourceKey, params: ListParams): Promise<ListResult> {
  const cfg = queryConfig(key);
  const { where, values } = filterWhere(key, params.filters ?? {});
  if (params.status !== undefined) {
    const st = statusCondition(key, params.status, values.length + 1);
    if (st) {
      where.push(st.condition);
      values.push(st.value);
    }
  }
  const order = orderBy(key, params.sort, params.dir);
  const pageSize = normalisePageSize(params.pageSize);
  const page = Math.max(1, Math.floor(Number(params.page) || 1));
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [idRows, countRows] = await Promise.all([
    query<{ id: string | number }>(
      `SELECT id FROM ${cfg.source} ${whereSql}
       ORDER BY ${order.sql}
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, pageSize, (page - 1) * pageSize],
    ),
    query<{ n: number }>(`SELECT count(*)::int AS n FROM ${cfg.source} ${whereSql}`, values),
  ]);
  const total = Number(countRows[0]?.n ?? 0);
  const ids = idRows.map((r) => String(r.id));
  if (!ids.length) return { rows: [], total, page, pageSize, sort: order.sort, dir: order.dir };

  const found = await query<Record<string, unknown>>(`SELECT ${cfg.select} FROM ${cfg.source} WHERE id = ANY($1::bigint[])`, [ids]);
  const byId = new Map(found.map((r) => [String(r.id), r]));
  const rows = ids.map((id) => byId.get(id)).filter((r): r is Record<string, unknown> => r !== undefined);
  return { rows, total, page, pageSize, sort: order.sort, dir: order.dir };
}

/**
 * Rows per status under the list's other filters, ignoring the selected
 * status tab (spec 06, any status column since spec 07). Every status is present, with 0 when it has no rows.
 */
export async function countByStatus(key: ResourceKey, filters: Record<string, string | undefined>): Promise<Record<string, number>> {
  const st = statusConfig(key);
  const cfg = queryConfig(key);
  const { where, values } = filterWhere(key, filters);
  const rows = await query<{ status: string; n: number }>(
    `SELECT ${st.column}::text AS status, count(*)::int AS n FROM ${cfg.source}
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     GROUP BY ${st.column}`,
    values,
  );
  const counts: Record<string, number> = Object.fromEntries(st.values.map((s) => [s, 0]));
  for (const r of rows) counts[r.status] = Number(r.n);
  return counts;
}
