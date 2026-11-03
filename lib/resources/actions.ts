"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { query, type Queryable, tx } from "@/lib/db";
import { mapDbError } from "@/lib/db/errors";
import { bumpSessionVersion, deleteUserChecked } from "@/lib/db/queries/users";
import { deleteRecordById, insertRecord, updateRecord } from "@/lib/db/records";
import { getResource, isResourceKey, type ResourceKey } from "@/lib/resources";
import { buildSchema, fieldErrorsFrom } from "@/lib/resources/schema";
import { isId } from "@/lib/ids";

/**
 * The only Server Actions behind every create, edit and delete form (spec 02).
 * Each is a thin wrapper: session check, zod validation, resource-specific
 * rules, one write through the allowlisted query layer, revalidation.
 */

export type SaveResult =
  | { ok: true; id: number; redirectTo: string; message: string }
  | { ok: false; error?: string; fieldErrors?: Record<string, string> };

export type DeleteResult = { ok: true; redirectTo: string; message: string } | { ok: false; error: string };

const BCRYPT_COST = 12;

function resourceKey(key: unknown): ResourceKey {
  if (!isResourceKey(key)) throw new Error(`Unknown resource: ${String(key)}`);
  return key;
}

class RuleError extends Error {}

/** The app's connection as a Queryable, for rules and writes that don't need a transaction. */
const direct: Queryable = { query: async (text, params) => ({ rows: await query(text, params) }) };

/**
 * Resource-specific rules applied after validation, before writing. `db` is the write's own
 * transaction where a rule reads rows the write depends on (spec 09 B2), so the check and
 * the write see the same state.
 */
async function applyRules(
  db: Queryable,
  key: ResourceKey,
  values: Record<string, unknown>,
  mode: "create" | "edit",
  id: number | string | null,
): Promise<Record<string, unknown>> {
  if (key === "users") {
    // The password is never stored or returned; only its bcrypt hash is written.
    const { password, ...rest } = values;
    // Spec 06: the optional name is trimmed, and a blank name is stored as NULL.
    if ("name" in rest) rest.name = typeof rest.name === "string" && rest.name.trim() ? rest.name.trim() : null;
    return typeof password === "string" ? { ...rest, password_hash: await bcrypt.hash(password, BCRYPT_COST) } : rest;
  }

  if (key === "delivery_dockets") {
    // The sender is never taken from the form.
    const rest = { ...values };
    delete rest.from_client_id;
    if (mode === "edit") {
      // Spec 09 B2: the docket's orders must all belong to its To Client. The lock makes a
      // concurrent order save (which reads the docket FOR SHARE) wait for this edit.
      await db.query("SELECT 1 FROM delivery_dockets WHERE id = $1 FOR UPDATE", [id]);
      if (rest.to_client_id != null) {
        const { rows } = await db.query("SELECT 1 FROM orders WHERE delivery_docket_id = $1 AND client_id <> $2 LIMIT 1", [
          id,
          rest.to_client_id,
        ]);
        if (rows.length) throw new RuleError("delivery docket has orders for another client");
      }
      return rest;
    }
    // Read at call time (not module load) so configuration changes apply immediately.
    const sender = process.env.FROM_CLIENT_ID;
    const exists =
      sender && /^\d+$/.test(sender) ? (await db.query("SELECT 1 FROM clients WHERE id = $1", [sender])).rows.length > 0 : false;
    if (!exists) {
      console.error(`FROM_CLIENT_ID is ${sender ? `"${sender}", which matches no client` : "not set"}`);
      throw new RuleError("sender client is not configured");
    }
    return { ...rest, from_client_id: Number(sender) };
  }

  if (key === "orders" && values.delivery_docket_id != null) {
    // FOR SHARE: waits for a docket edit in flight, then sees its To Client as committed (spec 09 B2).
    const { rows } = await db.query("SELECT to_client_id FROM delivery_dockets WHERE id = $1 FOR SHARE", [values.delivery_docket_id]);
    if (!rows[0] || String(rows[0].to_client_id) !== String(values.client_id)) {
      throw new RuleError("delivery docket belongs to another client");
    }
  }

  return values;
}

/** Dockets and orders with a docket check rows their write depends on, so they run in one transaction. */
const needsTransaction = (key: ResourceKey, values: Record<string, unknown>) =>
  key === "delivery_dockets" || (key === "orders" && values.delivery_docket_id != null);

export async function saveRecord(key: ResourceKey, id: number | string | null, input: Record<string, unknown>): Promise<SaveResult> {
  await requireSession();
  const k = resourceKey(key);
  const ui = getResource(k);
  const mode = id === null || id === undefined ? "create" : "edit";
  // Spec 09 B3: a malformed id can't name a record; say so before touching the database.
  if (mode === "edit" && !isId(id)) return { ok: false, error: `${ui.singular} not found` };

  const parsed = buildSchema(k, mode).safeParse(input ?? {});
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error.issues) };

  let savedId: number;
  try {
    const data = parsed.data as Record<string, unknown>;
    const write = async (db: Queryable): Promise<number | null> => {
      const values = await applyRules(db, k, data, mode, id);
      if (mode === "create") return insertRecord(k, values, db);
      if (!(await updateRecord(k, id!, values, db))) return null;
      // A new password signs that user out everywhere.
      if (k === "users" && values.password_hash !== undefined) await bumpSessionVersion(id!);
      return Number(id);
    };
    const result = needsTransaction(k, data) ? await tx((client) => write(client as unknown as Queryable)) : await write(direct);
    if (result === null) return { ok: false, error: `${ui.singular} not found` };
    savedId = result;
  } catch (err) {
    if (err instanceof RuleError) return { ok: false, error: err.message };
    return { ok: false, error: mapDbError(err, "save") };
  }

  revalidatePath(ui.path, "layout");
  const redirectTo = mode === "create" && ui.afterCreate === "detail" ? `${ui.path}/${savedId}` : ui.path;
  return { ok: true, id: savedId, redirectTo, message: `${ui.singular} successfully ${mode === "create" ? "created" : "updated"}` };
}

export async function deleteRecord(key: ResourceKey, id: number | string): Promise<DeleteResult> {
  const session = await requireSession();
  const k = resourceKey(key);
  const ui = getResource(k);
  if (!isId(id)) return { ok: false, error: `${ui.singular} not found` };
  try {
    if (k === "users") {
      const result = await tx((client) => deleteUserChecked(client, id, session.user?.id ?? ""));
      if (!result.ok) return result;
    } else if (!(await deleteRecordById(k, id))) {
      return { ok: false, error: `${ui.singular} not found` };
    }
  } catch (err) {
    return { ok: false, error: mapDbError(err, "delete") };
  }
  revalidatePath(ui.path, "layout");
  return { ok: true, redirectTo: ui.path, message: `${ui.singular} successfully deleted` };
}
