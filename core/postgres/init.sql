-- MiniShop schema and least-privilege role initialization for VVWA.
-- Executed automatically on first PostgreSQL container startup.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lab_app_user') THEN
    CREATE ROLE lab_app_user LOGIN PASSWORD 'lab_app_pass';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lab_admin_user') THEN
    CREATE ROLE lab_admin_user LOGIN PASSWORD 'lab_admin_pass';
  END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS minishop AUTHORIZATION lab_admin_user;

-- Create all MiniShop tables & SERIAL sequences owned by lab_admin_user
-- so PostgreSQL 16 allows TRUNCATE ... RESTART IDENTITY CASCADE during Reset DB.
SET ROLE lab_admin_user;

CREATE TABLE IF NOT EXISTS minishop.users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'customer',
  balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS minishop.products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(12, 2) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  image_url VARCHAR(255) NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS minishop.orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES minishop.users(id) ON DELETE CASCADE,
  total_amount NUMERIC(12, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  shipping_address TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS minishop.order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES minishop.orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES minishop.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS minishop.reviews (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES minishop.products(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES minishop.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS minishop.coupons (
  id SERIAL PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 1 AND 100),
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0
);

RESET ROLE;

-- Restricted privileges for lab_app_user (NO DROP / ALTER / TRUNCATE / SUPERUSER).
GRANT USAGE ON SCHEMA minishop TO lab_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA minishop TO lab_app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA minishop TO lab_app_user;

ALTER DEFAULT PRIVILEGES FOR ROLE lab_admin_user IN SCHEMA minishop
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lab_app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE lab_admin_user IN SCHEMA minishop
  GRANT USAGE, SELECT ON SEQUENCES TO lab_app_user;

ALTER ROLE lab_app_user SET search_path TO minishop, public;
ALTER ROLE lab_admin_user SET search_path TO minishop, public;
