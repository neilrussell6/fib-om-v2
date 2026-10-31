-- Spec 02: contains, case-insensitive matching everywhere, backed by trigram indexes.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX users_email_trgm ON users USING gin (email gin_trgm_ops);
CREATE INDEX clients_name_trgm ON clients USING gin (name gin_trgm_ops);
CREATE INDEX product_categories_name_trgm ON product_categories USING gin (name gin_trgm_ops);
CREATE INDEX product_types_name_trgm ON product_types USING gin (name gin_trgm_ops);
CREATE INDEX product_types_code_trgm ON product_types USING gin (code gin_trgm_ops);
CREATE INDEX product_sizes_name_trgm ON product_sizes USING gin (name gin_trgm_ops);
CREATE INDEX product_media_name_trgm ON product_media USING gin (name gin_trgm_ops);
CREATE INDEX product_media_code_trgm ON product_media USING gin (code gin_trgm_ops);
CREATE INDEX products_name_trgm ON products USING gin (name gin_trgm_ops);
CREATE INDEX products_efficiency_trgm ON products USING gin (efficiency gin_trgm_ops);
CREATE INDEX orders_order_number_trgm ON orders USING gin (order_number gin_trgm_ops);
CREATE INDEX order_items_part_number_trgm ON order_items USING gin (part_number gin_trgm_ops);
CREATE INDEX delivery_dockets_docket_number_trgm ON delivery_dockets USING gin (docket_number gin_trgm_ops);
