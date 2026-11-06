-- Закрыть доступ по умолчанию
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;

-- Групповые роли
CREATE ROLE role_admin    NOLOGIN;
CREATE ROLE role_manager  NOLOGIN;
CREATE ROLE role_employee NOLOGIN;

-- Пользователи для входа
CREATE ROLE admin_user    LOGIN IN ROLE role_admin;
CREATE ROLE manager_user  LOGIN IN ROLE role_manager;
CREATE ROLE employee_user LOGIN IN ROLE role_employee;

GRANT USAGE ON SCHEMA public TO role_admin, role_manager, role_employee;

-- ADMINISTRATOR: полный доступ
GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public TO role_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO role_admin;

-- PURCHASING MANAGER:
-- UPDATE на products
GRANT SELECT, INSERT, UPDATE ON
  suppliers, products, purchase_orders, purchase_order_items
TO role_manager;

-- EMPLOYEE:
GRANT SELECT (supplier_id, supplier_name)
  ON suppliers TO role_employee;
GRANT SELECT (product_id, product_name, category, stock_quantity)
  ON products TO role_employee;
GRANT SELECT (order_id, supplier_id, order_date, expected_delivery_date, status)
  ON purchase_orders TO role_employee;
GRANT SELECT (item_id, order_id, product_id, quantity)
  ON purchase_order_items TO role_employee;