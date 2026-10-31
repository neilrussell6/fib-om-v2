export { QUERIES, type QueryConfig, type FilterSql } from "./resources";

/**
 * Every base-table text column that a list filter or combobox search matches
 * (directly, or through a view column such as products_v.size_name). Each must
 * have a pg_trgm GIN index (db/migrations/*_search_indexes.sql; AC-4).
 */
export const TEXT_SEARCH_COLUMNS: { table: string; column: string }[] = [
  { table: "users", column: "email" },
  { table: "clients", column: "name" },
  { table: "product_categories", column: "name" },
  { table: "product_types", column: "name" },
  { table: "product_types", column: "code" },
  { table: "product_sizes", column: "name" },
  { table: "product_media", column: "name" },
  { table: "product_media", column: "code" },
  { table: "products", column: "name" },
  { table: "products", column: "efficiency" },
  { table: "orders", column: "order_number" },
  { table: "order_items", column: "part_number" },
  { table: "delivery_dockets", column: "docket_number" },
];
