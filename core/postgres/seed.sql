-- Idempotent seed dataset for MiniShop (re-executed by 1-click Reset DB).

TRUNCATE TABLE
  minishop.order_items,
  minishop.orders,
  minishop.reviews,
  minishop.coupons,
  minishop.products,
  minishop.users
RESTART IDENTITY CASCADE;

INSERT INTO minishop.users (username, email, password_hash, role, balance) VALUES
  ('admin', 'admin@minishop.local', 'admin_secret_2026', 'admin', 9999.00),
  ('alice', 'alice@minishop.local', 'password123', 'customer', 500.00),
  ('bob', 'bob@minishop.local', 'bobpass456', 'customer', 250.00);

INSERT INTO minishop.products (name, description, price, stock, image_url) VALUES
  ('Ban phim co MiniShop K1', 'Switch linear em ai, phu hop lap trinh.', 89.00, 25, '/images/kb.png'),
  ('Chuot khong day Silent M2', 'Pin sac USB-C, do tre thap.', 45.00, 40, '/images/mouse.png'),
  ('Tai nghe chong on Studio S3', 'Am thanh trong treo cho hoc tap.', 120.00, 15, '/images/headset.png');

INSERT INTO minishop.orders (user_id, total_amount, status, shipping_address) VALUES
  (2, 89.00, 'paid', '123 Duong Le Loi, Quan 1, TP.HCM'),
  (3, 120.00, 'shipped', '456 Pho Hue, Hai Ba Trung, Ha Noi');

INSERT INTO minishop.order_items (order_id, product_id, quantity, unit_price) VALUES
  (1, 1, 1, 89.00),
  (2, 3, 1, 120.00);

INSERT INTO minishop.reviews (product_id, user_id, rating, content) VALUES
  (1, 2, 5, 'San pham go rat suong tay, giao hang nhanh!'),
  (2, 3, 4, 'Chuot nhe, pin dung lau.');

INSERT INTO minishop.coupons (code, discount_percent, max_uses, used_count) VALUES
  ('WELCOME10', 10, 1, 0),
  ('STUDENT20', 20, 5, 0);
