-- Spec 02: display views with joined names (replacing v1's *_rel views).
-- Derived formula columns (pleats, wire metres, ...) are added in spec 03.

CREATE VIEW products_v AS
SELECT p.*,
       pc.name AS category_name,
       pt.name AS type_name,
       pt.code AS type_code,
       ps.name AS size_name,
       pm.name AS media_name,
       pm.code AS media_code
FROM products p
JOIN product_categories pc ON pc.id = p.category_id
JOIN product_types pt ON pt.id = p.type_id
JOIN product_sizes ps ON ps.id = p.size_id
JOIN product_media pm ON pm.id = p.media_id;

CREATE VIEW delivery_dockets_v AS
SELECT d.*,
       fc.name AS from_client_name,
       fc.address_shipping AS from_client_address_shipping,
       tc.name AS to_client_name,
       tc.address_shipping AS to_client_address_shipping
FROM delivery_dockets d
JOIN clients fc ON fc.id = d.from_client_id
JOIN clients tc ON tc.id = d.to_client_id;

CREATE VIEW orders_v AS
SELECT o.*,
       c.name AS client_name,
       d.docket_number AS delivery_docket_number
FROM orders o
JOIN clients c ON c.id = o.client_id
LEFT JOIN delivery_dockets d ON d.id = o.delivery_docket_id;

CREATE VIEW order_items_v AS
SELECT oi.*,
       o.client_id,
       c.name AS client_name,
       o.order_number,
       o.date AS order_date,
       o.due_date AS order_due_date,
       o.status AS order_status,
       p.name AS product_name,
       p.category_id AS product_category_id,
       pc.name AS product_category_name,
       pt.code AS product_type_code,
       pt.name AS product_type_name,
       ps.name AS product_size_name,
       pm.code AS product_media_code
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN clients c ON c.id = o.client_id
JOIN products p ON p.id = oi.product_id
JOIN product_categories pc ON pc.id = p.category_id
JOIN product_types pt ON pt.id = p.type_id
JOIN product_sizes ps ON ps.id = p.size_id
JOIN product_media pm ON pm.id = p.media_id;
