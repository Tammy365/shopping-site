PRAGMA foreign_keys = ON;

-- 方便反复初始化：先删表后建表
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;

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

-- 最小种子数据（满足“至少2个分类、每类≥2产品”的要求）
INSERT INTO categories (name) VALUES ('Fruits'), ('Drinks');

INSERT INTO products (catid, name, price, description) VALUES
(1, 'Apple',   3.99, 'Fresh and delicious apple'),
(1, 'Banana',  2.99, 'Sweet banana'),
(2, 'Cola',   0.99, 'Refreshing cola'),
(2, 'Milk', 5.99, 'Smooth milk');