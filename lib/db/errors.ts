/**
 * Postgres errors → the friendly messages staff already know from web3 (spec 02).
 * Most problems are caught earlier by zod; this is the backstop. Raw database
 * text never reaches the user: anything unrecognised is logged and replaced.
 */

const DISPLAY_NAMES: Record<string, string> = {
  users: "users",
  clients: "clients",
  orders: "orders",
  order_items: "order items",
  delivery_dockets: "delivery dockets",
  products: "products",
  product_categories: "product categories",
  product_types: "product types",
  product_sizes: "product sizes",
  product_media: "product media",
};

const display = (table: string) => DISPLAY_NAMES[table] ?? table.replace(/_/g, " ");
const columnName = (column: string) => column.replace(/_id$/, "").replace(/_/g, " ");

type PgLike = { code?: string; message?: string; table?: string; column?: string; constraint?: string };

export function mapDbError(err: unknown, operation: "save" | "delete"): string {
  const e = (err ?? {}) as PgLike;
  switch (e.code) {
    case "23503": {
      // update or delete on table "clients" violates foreign key constraint "…" on table "orders"
      const m = /on table "([^"]+)" violates foreign key constraint "[^"]+" on table "([^"]+)"/.exec(e.message ?? "");
      if (operation === "delete" && m) return `cannot delete ${display(m[1])} that still have ${display(m[2])}`;
      break;
    }
    case "23502":
      if (e.column) return `please provide a ${columnName(e.column)}`;
      break;
    case "23514":
      if (e.column) return `please provide a valid ${columnName(e.column)}`;
      break;
    case "22P02":
      return "please provide a valid integer";
    case "22007":
    case "22008":
      return "please provide a valid date";
    case "23505":
      if (e.table === "users" || e.constraint === "users_email_key") return "email already in use";
      break;
  }
  console.error("Database error", err);
  return "Something went wrong";
}
