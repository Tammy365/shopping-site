PRAGMA foreign_keys = ON;

-- 初始化可反复 先删表后建表（注意删除顺序：先引用者后被引用者）
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;

-- 分类表
CREATE TABLE categories (
  catid INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT NOT NULL UNIQUE
);

-- 产品表
CREATE TABLE products (
  pid   INTEGER PRIMARY KEY AUTOINCREMENT,
  catid INTEGER,
  name  TEXT NOT NULL,
  price REAL NOT NULL,
  description TEXT,
  image TEXT, -- 以 JSON 形式存 {big, small} 两张图的路径
  FOREIGN KEY(catid) REFERENCES categories(catid) ON DELETE SET NULL
);

-- 用户表（Phase 4）
CREATE TABLE users (
  userid   INTEGER PRIMARY KEY AUTOINCREMENT,
  email    TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0
);

-- 会话表（存储登录后的 token，用于鉴权）
CREATE TABLE sessions (
  token      TEXT PRIMARY KEY,
  userid     INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(userid) REFERENCES users(userid) ON DELETE CASCADE
);

-- 最小种子数据（满足“至少2个分类、每类≥2产品”的要求）
INSERT INTO categories (name) VALUES ('Fruits'), ('Drinks');

INSERT INTO products (catid, name, price, description) VALUES
(1, 'Apple',   3.99, 'Fresh and delicious apple'),
(1, 'Banana',  2.99, 'Sweet banana'),
(2, 'Cola',    0.99, 'Refreshing cola'),
(2, 'Milk',    5.99, 'Smooth milk');

-- 为 4 个商品预置图片路径（与服务器 /uploads 映射一致）
UPDATE products 
SET image='{"big":"/uploads/big/1_big.jpg", "small":"/uploads/small/1_small.jpg"}'
WHERE pid=1;

UPDATE products 
SET image='{"big":"/uploads/big/2_big.jpg", "small":"/uploads/small/2_small.jpg"}'
WHERE pid=2;

UPDATE products 
SET image='{"big":"/uploads/big/3_big.jpg", "small":"/uploads/small/3_small.jpg"}'
WHERE pid=3;

UPDATE products 
SET image='{"big":"/uploads/big/4_big.jpg", "small":"/uploads/small/4_small.jpg"}'
WHERE pid=4;

-- 初始化两个用户（密码先用占位符，init-db.js 会统一写 bcrypt 哈希）
INSERT INTO users (email, password, is_admin) VALUES
('admin@example.com', 'PLACEHOLDER', 1),
('user@example.com',  'PLACEHOLDER', 0);