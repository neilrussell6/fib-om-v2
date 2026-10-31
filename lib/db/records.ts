import { type Queryable, query } from "@/lib/db";
import { queryConfig } from "@/lib/db/list-query";
import type { ResourceKey } from "@/lib/resources";

/** One record from the resource's list/detail source (a view where there is one). */
export async function getRecord(key: ResourceKey, id: number | string): Promise<Record<string, unknown> | null> {
  const cfg = queryConfig(key);
  const rows = await query(`SELECT ${cfg.select} FROM ${cfg.source} WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

/** Keeps only the allowlisted writable columns that are present in values. */
function writableEntries(key: ResourceKey, values: Record<string, unknown>): [string, unknown][] {
  const allowed = new Set(queryConfig(key).writable);
  return Object.entries(values).filter(([k, v]) => allowed.has(k) && v !== undefined);
}

export async function insertRecord(key: ResourceKey, values: Record<string, unknown>, db?: Queryable): Promise<number> {
  const cfg = queryConfig(key);
  const entries = writableEntries(key, values);
  const cols = entries.map(([k]) => k);
  const text = cols.length
    ? `INSERT INTO ${cfg.table} (${cols.join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING id`
    : `INSERT INTO ${cfg.table} DEFAULT VALUES RETURNING id`;
  const params = entries.map(([, v]) => v);
  const rows = db ? (await db.query(text, params)).rows : await query(text, params);
  return Number(rows[0].id);
}

export async function updateRecord(key: ResourceKey, id: number | string, values: Record<string, unknown>, db?: Queryable): Promise<boolean> {
  const cfg = queryConfig(key);
  const entries = writableEntries(key, values);
  if (!entries.length) return true;
  const text = `UPDATE ${cfg.table} SET ${entries.map(([k], i) => `${k} = $${i + 2}`).join(", ")} WHERE id = $1 RETURNING id`;
  const params = [id, ...entries.map(([, v]) => v)];
  const rows = db ? (await db.query(text, params)).rows : await query(text, params);
  return rows.length > 0;
}

export async function deleteRecordById(key: ResourceKey, id: number | string, db?: Queryable): Promise<boolean> {
  const cfg = queryConfig(key);
  const text = `DELETE FROM ${cfg.table} WHERE id = $1 RETURNING id`;
  const rows = db ? (await db.query(text, [id])).rows : await query(text, [id]);
  return rows.length > 0;
}
