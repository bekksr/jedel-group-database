-- Ограниченный пользователь для работы backend (Docker-база jedel_dev).
-- Владелец jedel_dev остаётся для init_development и миграций.
-- Пароль задаётся отдельно: \password erp_app

CREATE ROLE erp_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;

GRANT USAGE ON SCHEMA public TO erp_app;

-- Бизнес-таблицы: читать, создавать, обновлять. DELETE нет.
GRANT SELECT, INSERT, UPDATE ON suppliers, products, purchase_orders TO erp_app;

-- Позиции заказа: DELETE нужен, потому что правка Pending-заказа пересоздаёт позиции.
GRANT SELECT, INSERT, UPDATE, DELETE ON purchase_order_items TO erp_app;

-- Пользователи: регистрация, вход (last_login), активация аккаунтов.
GRANT SELECT, INSERT, UPDATE ON auth_user TO erp_app;

-- Принадлежность к группам: назначение и снятие ролей.
GRANT SELECT, INSERT, DELETE ON auth_user_groups, auth_user_user_permissions TO erp_app;

-- Справочники групп и прав: только чтение.
GRANT SELECT ON auth_group, auth_group_permissions, auth_permission, django_content_type TO erp_app;

-- Сессии: полный цикл, Django удаляет просроченные.
GRANT SELECT, INSERT, UPDATE, DELETE ON django_session TO erp_app;

-- Журнал админки и история миграций.
GRANT SELECT, INSERT ON django_admin_log TO erp_app;
GRANT SELECT ON django_migrations TO erp_app;

-- Счётчики идентификаторов.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO erp_app;