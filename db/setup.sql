PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;


CREATE TABLE categories (
  catid INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT NOT NULL UNIQUE
);


CREATE TABLE products (
  pid   INTEGER PRIMARY KEY AUTOINCREMENT,
  catid INTEGER,
  name  TEXT NOT NULL,
  price REAL NOT NULL,
  description TEXT,
  image TEXT, 
  FOREIGN KEY(catid) REFERENCES categories(catid) ON DELETE SET NULL
);


CREATE TABLE users (
  userid   INTEGER PRIMARY KEY AUTOINCREMENT,
  email    TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0
);


CREATE TABLE sessions (
  token      TEXT PRIMARY KEY,
  userid     INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(userid) REFERENCES users(userid) ON DELETE CASCADE
);


INSERT INTO categories (name) VALUES ('Fruits'), ('Drinks');

INSERT INTO products (catid, name, price, description) VALUES
(1, 'Apple',   3.99, 'Fresh and delicious apple'),
(1, 'Banana',  2.99, 'Sweet banana'),
(2, 'Cola',    0.99, 'Refreshing cola'),
(2, 'Milk',    5.99, 'Smooth milk');


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

-- 初始化两个用户
INSERT INTO users (email, password, is_admin) VALUES
('admin@example.com', 'PLACEHOLDER', 1),
('user@example.com',  'PLACEHOLDER', 0);

CREATE TABLE IF NOT EXISTS orders (
  orderid     INTEGER PRIMARY KEY AUTOINCREMENT,
  userid      INTEGER,
  digest      TEXT NOT NULL,
  salt        TEXT NOT NULL,
  currency    TEXT NOT NULL,
  total       REAL NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(userid) REFERENCES users(userid)
);

CREATE TABLE IF NOT EXISTS order_items (
  orderid     INTEGER,
  pid         INTEGER,
  qty         INTEGER,
  price       REAL,
  FOREIGN KEY(orderid) REFERENCES orders(orderid)
);