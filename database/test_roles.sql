\echo '=== EMPLOYEE ==='
SET ROLE employee_user;
SELECT product_id, product_name, stock_quantity FROM products;
SELECT unit_price FROM products;
SELECT email, phone FROM suppliers;
UPDATE products SET stock_quantity = 0;
RESET ROLE;

\echo '=== MANAGER ==='
SET ROLE manager_user;
SELECT * FROM products;
BEGIN;
UPDATE products SET stock_quantity = stock_quantity + 1 WHERE product_id = 1;
ROLLBACK;
DELETE FROM purchase_orders WHERE order_id = 1;
RESET ROLE;

\echo '=== ADMIN ==='
SET ROLE admin_user;
SELECT * FROM suppliers;
RESET ROLE;