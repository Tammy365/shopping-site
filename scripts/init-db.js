// scripts/init-db.js
// 初始化数据库（执行 setup.sql + 为默认用户写入 bcrypt 哈希）
//
// 用法：npm run init-db
// 效果：幂等运行，重建表结构；确保 admin/user 两个账号存在，并把密码改为安全哈希。

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';

// ===== 计算当前目录（兼容 ES Module）=====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== 路径配置 =====
const DB_FILE = path.join(__dirname, '..', 'db', 'shop.db');
const SETUP_SQL_FILE = path.join(__dirname, '..', 'db', 'setup.sql');

// ===== 密码哈希配置 =====
const SALT_ROUNDS = 12;

// 初始化默认账户（仅用于初始化）
const DEFAULT_USERS = [
  { email: 'admin@example.com', password: 'AdminPassword123', is_admin: 1 },
  { email: 'user@example.com',  password: 'UserPassword123',  is_admin: 0 },
];

// ===== 读取建库脚本 =====
if (!fs.existsSync(SETUP_SQL_FILE)) {
  console.error(`❌ setup.sql not found at: ${SETUP_SQL_FILE}`);
  process.exit(1);
}
const setupSql = fs.readFileSync(SETUP_SQL_FILE, 'utf-8');

// ===== 打开数据库 =====
sqlite3.verbose();
const db = new sqlite3.Database(DB_FILE);

// Promise 封装
function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, err => (err ? reject(err) : resolve()));
  });
}
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

// 生成 bcrypt 哈希
async function hashPassword(plain) {
  return await bcrypt.hash(plain, SALT_ROUNDS);
}

// 确保两名默认用户存在，并为其写入哈希密码
async function ensureDefaultUsers() {
  // 1) 保证用户存在（如果 setup.sql 没插入，这里会补）
  for (const u of DEFAULT_USERS) {
    await run(
      `INSERT OR IGNORE INTO users(email, password, is_admin)
       VALUES (?, 'PLACEHOLDER', ?);`,
      [u.email, u.is_admin]
    );
  }

  // 2) 写入哈希密码（覆盖 PLACEHOLDER 或旧密码）
  for (const u of DEFAULT_USERS) {
    const hashed = await hashPassword(u.password);
    await run(
      `UPDATE users SET password=? WHERE email=?;`,
      [hashed, u.email]
    );
  }
}

async function main() {
  try {
    // 外键开启
    await exec('PRAGMA foreign_keys = ON;');

    // 执行建库脚本（DROP + CREATE + 种子数据）
    await exec(setupSql);

    // 确保默认用户存在并写入安全哈希
    await ensureDefaultUsers();

    console.log('✅ Database initialized successfully.');
    console.log('   -> Default admin login: admin@example.com / AdminPassword123');
    console.log('   -> Default user  login: user@example.com  / UserPassword123');
  } catch (err) {
    console.error('❌ DB setup failed:', err.message || err);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();