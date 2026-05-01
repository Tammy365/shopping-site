

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

sqlite3.verbose();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);


const dbPath = path.join(__dirname, '..', 'db', 'shop.db');
const db = new sqlite3.Database(dbPath);


db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON;');


  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      userid      INTEGER PRIMARY KEY AUTOINCREMENT,
      email       TEXT UNIQUE NOT NULL,
      password    TEXT NOT NULL,
      is_admin    INTEGER NOT NULL DEFAULT 0
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      token       TEXT PRIMARY KEY,
      userid      INTEGER,
      FOREIGN KEY(userid) REFERENCES users(userid)
        ON DELETE CASCADE
    );
  `);


  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      catid       INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL
    );
  `);


  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      pid         INTEGER PRIMARY KEY AUTOINCREMENT,
      catid       INTEGER,
      name        TEXT NOT NULL,
      price       REAL NOT NULL,
      description TEXT,
      image       TEXT,
      FOREIGN KEY(catid) REFERENCES categories(catid)
        ON DELETE SET NULL
    );
  `);


  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      orderid     INTEGER PRIMARY KEY AUTOINCREMENT,
      userid      INTEGER,
      digest      TEXT NOT NULL,      -- SHA256 summary of order integrity fields
      salt        TEXT NOT NULL,      -- random salt
      currency    TEXT NOT NULL,      -- e.g. HKD
      total       REAL NOT NULL,      -- computed server-side total
      status      TEXT NOT NULL DEFAULT 'pending',  -- pending / paid / failed
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userid) REFERENCES users(userid)
        ON DELETE SET NULL
    );
  `);


  db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      orderid     INTEGER,
      pid         INTEGER,
      qty         INTEGER,
      price       REAL,
      FOREIGN KEY(orderid) REFERENCES orders(orderid)
        ON DELETE CASCADE,
      FOREIGN KEY(pid) REFERENCES products(pid)
        ON DELETE SET NULL
    );
  `);

  console.log('Database initialized with Phase 5 tables successfully!');
});

db.close();