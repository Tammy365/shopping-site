// scripts/init-db.js
import fs from 'fs';
import sqlite3 from 'sqlite3';

const dbFile = './db/shop.db';
const setupSql = fs.readFileSync('./db/setup.sql', 'utf-8');

sqlite3.verbose();
const db = new sqlite3.Database(dbFile);

db.serialize(() => {
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(setupSql, (err) => {
    if (err) {
      console.error('DB setup failed:', err.message);
      process.exit(1);
    } else {
      console.log('Database initialized successfully.');
    }
  });
});