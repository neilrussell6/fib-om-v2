"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { query, tx } from "@/lib/db";
import { mapDbError } from "@/lib/db/errors";
import { bumpSessionVersion, deleteUserChecked } from "@/lib/db/queries/users";
import { deleteRecordById, insertRecord, updateRecord } from "@/lib/db/records";
import { getResource, isResourceKey, type ResourceKey } from "@/lib/resources";
import { buildSchema } from "@/lib/resources/schema";

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

/** Resource-specific rules applied after validation, before writing. */
async function applyRules(
  key: ResourceKey,
  values: Record<string, unknown>,
  mode: "create" | "edit",
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
    if (mode === "edit") return rest;
    // Read at call time (not module load) so configuration changes apply immediately.
    const sender = process.env.FROM_CLIENT_ID;
    const exists =
      sender && /^\d+$/.test(sender) ? (await query("SELECT 1 FROM clients WHERE id = $1", [sender])).length > 0 : false;
    if (!exists) {
      console.error(`FROM_CLIENT_ID is ${sender ? `"${sender}", which matches no client` : "not set"}`);
      throw new RuleError("sender client is not configured");
    }
    return { ...rest, from_client_id: Number(sender) };
  }

  if (key === "orders" && values.delivery_docket_id != null) {
    const rows = await query<{ to_client_id: string }>("SELECT to_client_id FROM delivery_dockets WHERE id = $1", [
      values.delivery_docket_id,
    ]);
    if (!rows[0] || String(rows[0].to_client_id) !== String(values.client_id)) {
      throw new RuleError("delivery docket belongs to another client");
    }
  }

  return values;
}

export async function saveRecord(key: ResourceKey, id: number | string | null, input: Record<string, unknown>): Promise<SaveResult> {
  await requireSession();
  const k = resourceKey(key);
  const ui = getResource(k);
  const mode = id === null || id === undefined ? "create" : "edit";

  const parsed = buildSchema(k, mode).safeParse(input ?? {});
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, fieldErrors };
  }

  let savedId: number;
  try {
    const values = await applyRules(k, parsed.data as Record<string, unknown>, mode);
    if (mode === "create") savedId = await insertRecord(k, values);
    else {
      if (!(await updateRecord(k, id!, values))) return { ok: false, error: `${ui.singular} not found` };
      savedId = Number(id);
      // A new password signs that user out everywhere.
      if (k === "users" && values.password_hash !== undefined) await bumpSessionVersion(savedId);
    }
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
