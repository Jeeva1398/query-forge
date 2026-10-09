-- E-commerce sample (SQLite version): same tables and rows as the Postgres one.
-- Types: serial -> INTEGER PRIMARY KEY, boolean -> 0/1, jsonb -> TEXT holding JSON,
-- dates and timestamps -> TEXT in ISO format ('2026-01-31', '2026-01-31 09:00:00').

CREATE TABLE categories (
  id        INTEGER PRIMARY KEY,
  name      TEXT NOT NULL,
  parent_id INTEGER REFERENCES categories (id)
);

CREATE TABLE customers (
  id          INTEGER PRIMARY KEY,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  city        TEXT,
  country     TEXT NOT NULL,
  signup_date TEXT NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE products (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories (id),
  price       NUMERIC NOT NULL CHECK (price >= 0),
  stock       INTEGER NOT NULL DEFAULT 0,
  attributes  TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL
);

CREATE TABLE orders (
  id            INTEGER PRIMARY KEY,
  customer_id   INTEGER NOT NULL REFERENCES customers (id),
  order_date    TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('processing', 'shipped', 'delivered', 'cancelled', 'returned')),
  shipping_city TEXT
);

CREATE TABLE order_items (
  order_id   INTEGER NOT NULL REFERENCES orders (id),
  product_id INTEGER NOT NULL REFERENCES products (id),
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC NOT NULL,
  PRIMARY KEY (order_id, product_id)
);

CREATE TABLE reviews (
  id          INTEGER PRIMARY KEY,
  product_id  INTEGER NOT NULL REFERENCES products (id),
  customer_id INTEGER NOT NULL REFERENCES customers (id),
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body        TEXT,
  created_at  TEXT NOT NULL
);

INSERT INTO categories (name, parent_id) VALUES
  ('Electronics', NULL),
  ('Home & Kitchen', NULL),
  ('Books', NULL),
  ('Laptops', 1),
  ('Phones', 1),
  ('Audio', 1),
  ('Headphones', 6),
  ('Cookware', 2),
  ('Furniture', 2),
  ('Fiction', 3),
  ('Programming', 3);

INSERT INTO customers (first_name, last_name, email, city, country, signup_date, is_active) VALUES
  ('Arjun', 'Kumar', 'arjun.kumar@example.com', 'Chennai', 'India', '2025-01-14', 1),
  ('Priya', 'Raman', 'priya.raman@example.com', 'Bengaluru', 'India', '2025-02-03', 1),
  ('Meera', 'Iyer', 'meera.iyer@example.com', 'Chennai', 'India', '2025-02-21', 1),
  ('Rahul', 'Nair', 'rahul.nair@example.com', 'Kochi', 'India', '2025-03-09', 1),
  ('Sneha', 'Patel', 'sneha.patel@example.com', 'Mumbai', 'India', '2025-03-30', 1),
  ('Karthik', 'Subramanian', 'karthik.s@example.com', 'Coimbatore', 'India', '2025-04-11', 0),
  ('Divya', 'Menon', 'divya.menon@example.com', NULL, 'India', '2025-04-25', 1),
  ('Vikram', 'Singh', 'vikram.singh@example.com', 'Delhi', 'India', '2025-05-06', 1),
  ('Ananya', 'Das', 'ananya.das@example.com', 'Kolkata', 'India', '2025-05-19', 1),
  ('Rohan', 'Mehta', 'rohan.mehta@example.com', 'Pune', 'India', '2025-06-02', 1),
  ('Emma', 'Wilson', 'emma.wilson@example.com', 'London', 'United Kingdom', '2025-06-15', 1),
  ('James', 'Brown', 'james.brown@example.com', 'Manchester', 'United Kingdom', '2025-06-28', 1),
  ('Olivia', 'Taylor', 'olivia.taylor@example.com', 'Leeds', 'United Kingdom', '2025-07-10', 0),
  ('Liam', 'Smith', 'liam.smith@example.com', 'New York', 'United States', '2025-07-22', 1),
  ('Sophia', 'Johnson', 'sophia.j@example.com', 'Austin', 'United States', '2025-08-04', 1),
  ('Noah', 'Williams', 'noah.w@example.com', 'Seattle', 'United States', '2025-08-17', 1),
  ('Ava', 'Garcia', 'ava.garcia@example.com', NULL, 'United States', '2025-08-30', 1),
  ('Lucas', 'Müller', 'lucas.mueller@example.com', 'Berlin', 'Germany', '2025-09-12', 1),
  ('Mia', 'Schneider', 'mia.schneider@example.com', 'Munich', 'Germany', '2025-09-25', 1),
  ('Hiroshi', 'Tanaka', 'hiroshi.tanaka@example.com', 'Tokyo', 'Japan', '2025-10-08', 1),
  ('Yuki', 'Sato', 'yuki.sato@example.com', 'Osaka', 'Japan', '2025-10-21', 1),
  ('Aisha', 'Khan', 'aisha.khan@example.com', 'Dubai', 'United Arab Emirates', '2025-11-03', 1),
  ('Chen', 'Wei', 'chen.wei@example.com', 'Singapore', 'Singapore', '2026-03-16', 1),
  ('Fatima', 'Ali', 'fatima.ali@example.com', 'Doha', 'Qatar', '2026-05-29', 1),
  ('Diego', 'Lopez', 'diego.lopez@example.com', 'Madrid', 'Spain', '2026-08-11', 1);

INSERT INTO products (name, category_id, price, stock, attributes, created_at) VALUES
  ('ThinkBook 14 Laptop', 4, 64999.00, 12, '{"brand": "Lenovo", "ram_gb": 16, "storage_gb": 512, "color": "grey"}', '2025-01-10'),
  ('AirLite 13 Laptop', 4, 89999.00, 5, '{"brand": "Zen", "ram_gb": 16, "storage_gb": 1024, "color": "silver"}', '2025-02-01'),
  ('Budget Chromebook', 4, 24999.00, 30, '{"brand": "Acro", "ram_gb": 4, "storage_gb": 64}', '2025-03-15'),
  ('Pixel Nova Phone', 5, 54999.00, 20, '{"brand": "Nova", "storage_gb": 128, "color": "black", "5g": true}', '2025-02-20'),
  ('Galaxy Lite Phone', 5, 18999.00, 45, '{"brand": "Stellar", "storage_gb": 64, "color": "blue", "5g": false}', '2025-04-05'),
  ('Pro Max Phone', 5, 129999.00, 3, '{"brand": "Orchard", "storage_gb": 256, "color": "gold", "5g": true}', '2025-09-01'),
  ('Bluetooth Speaker', 6, 3499.00, 60, '{"brand": "Boomr", "waterproof": true, "battery_h": 12}', '2025-01-25'),
  ('Soundbar 2.1', 6, 12999.00, 8, '{"brand": "Boomr", "watts": 160}', '2025-05-12'),
  ('Noise Cancelling Headphones', 7, 24999.00, 15, '{"brand": "Quietly", "wireless": true, "anc": true}', '2025-03-03'),
  ('Wired Earphones', 7, 599.00, 200, '{"brand": "Basic", "wireless": false}', '2025-01-05'),
  ('Wireless Earbuds', 7, 4999.00, 0, '{"brand": "Quietly", "wireless": true, "anc": false}', '2025-06-18'),
  ('Cast Iron Skillet', 8, 2199.00, 40, '{"material": "cast iron", "diameter_cm": 26}', '2025-02-14'),
  ('Non-stick Pan Set', 8, 3999.00, 25, '{"material": "aluminium", "pieces": 3}', '2025-04-22'),
  ('Pressure Cooker 5L', 8, 2899.00, 35, '{"material": "steel", "litres": 5}', '2025-07-01'),
  ('Study Desk', 9, 8999.00, 10, '{"material": "wood", "width_cm": 120}', '2025-03-28'),
  ('Ergonomic Chair', 9, 15999.00, 7, '{"material": "mesh", "adjustable": true}', '2025-05-30'),
  ('The Silent River (Novel)', 10, 399.00, 80, '{"author": "A. Rao", "pages": 320, "format": "paperback"}', '2025-01-18'),
  ('Midnight Library Tales', 10, 499.00, 55, '{"author": "L. Grey", "pages": 280, "format": "paperback"}', '2025-06-07'),
  ('Learning PostgreSQL', 11, 1299.00, 22, '{"author": "S. Ellis", "pages": 540, "format": "hardcover"}', '2025-02-09'),
  ('Clean JavaScript', 11, 999.00, 18, '{"author": "M. Hart", "pages": 410, "format": "paperback"}', '2025-08-14');

-- 240 orders spread over Oct 2025 - Sep 2026; customers 23-25 never ordered
INSERT INTO orders (customer_id, order_date, status)
WITH RECURSIVE g(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM g WHERE n < 240)
SELECT
  (n * 7) % 22 + 1,
  datetime('2025-10-01 09:00', ((n * 31) % 335) || ' days', ((n * 37) % 600) || ' minutes'),
  CASE n % 7
    WHEN 3 THEN 'shipped'
    WHEN 4 THEN 'processing'
    WHEN 5 THEN 'cancelled'
    WHEN 6 THEN 'returned'
    ELSE 'delivered'
  END
FROM g;

UPDATE orders
SET shipping_city = (SELECT c.city FROM customers c WHERE c.id = orders.customer_id);

-- 1 to 3 items per order
INSERT OR IGNORE INTO order_items (order_id, product_id, quantity, unit_price)
WITH RECURSIVE k(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM k WHERE n < 3)
SELECT o.id, p.id, 1 + (o.id * k.n) % 3, p.price
FROM orders o
CROSS JOIN k
JOIN products p ON p.id = (o.id * 3 + k.n * 5) % 20 + 1
WHERE k.n <= 1 + o.id % 3
ORDER BY o.id, k.n;

INSERT INTO reviews (product_id, customer_id, rating, body, created_at)
WITH RECURSIVE g(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM g WHERE n < 60)
SELECT
  (n * 3) % 20 + 1,
  (n * 5) % 22 + 1,
  (n * 7 + n / 3) % 5 + 1,
  CASE n % 6
    WHEN 0 THEN 'Great value'
    WHEN 1 THEN 'Does the job'
    WHEN 2 THEN 'Not worth the price'
    WHEN 3 THEN 'Love it'
    WHEN 4 THEN 'Stopped working after a week'
  END,
  date('2025-11-01', (n * 5) || ' days')
FROM g;
