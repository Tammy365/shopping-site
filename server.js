// server.js — Phase 2B + Phase 4 (Auth + CSRF + Change Password + Security)
import express from 'express';
import path from 'path';
import fs from 'fs';
import morgan from 'morgan';
import multer from 'multer';
import sharp from 'sharp';
import sqlite3 from 'sqlite3';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { body, param, query, validationResult } from 'express-validator';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app     = express();
const PORT    = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// -------- 安全头（含基础 CSP；后续可升级为 nonce 严格策略）--------
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "img-src 'self' data: blob:",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
    ].join('; ')
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

// -------- 中间件 --------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));

// -------- SQLite --------
sqlite3.verbose();
const db = new sqlite3.Database(path.join(__dirname, 'db', 'shop.db'));
db.serialize(() => db.run('PRAGMA foreign_keys = ON;'));

// -------- Multer（≤10MB）--------
const upload = multer({
  dest: path.join(__dirname, 'uploads', 'tmp'),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// -------- 工具 --------
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
}
function escapeHTML(str = '') {
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}
function sanitizeProduct(row) {
  if (!row) return row;
  return {
    ...row,
    name: escapeHTML(row.name),
    description: row.description != null ? escapeHTML(row.description) : row.description
  };
}
function generateToken() { return crypto.randomBytes(32).toString('hex'); }
function wantsHTML(req) {
  const a = req.get('accept') || '';
  return req.accepts(['html', 'json']) === 'html' || /text\/html/.test(a);
}

// -------- 登录态/权限中间件 --------
function requireLogin(req, res, next) {
  const token = req.cookies?.auth;
  if (!token) {
    return wantsHTML(req) ? res.redirect('/login.html') : res.status(401).json({ error: 'Not logged in' });
  }
  db.get(
    'SELECT u.userid, u.email, u.is_admin FROM sessions s JOIN users u ON s.userid=u.userid WHERE s.token=?',
    [token],
    (err, row) => {
      if (err || !row)
        return wantsHTML(req) ? res.redirect('/login.html') : res.status(401).json({ error: 'Invalid session' });
      req.user = { userid: row.userid, email: row.email, is_admin: row.is_admin === 1 };
      next();
    }
  );
}
function requireAdmin(req, res, next) {
  const token = req.cookies?.auth;
  if (!token) {
    return wantsHTML(req) ? res.redirect('/login.html') : res.status(401).json({ error: 'Not logged in' });
  }
  db.get(
    'SELECT u.userid, u.email, u.is_admin FROM sessions s JOIN users u ON s.userid=u.userid WHERE s.token=?',
    [token],
    (err, row) => {
      if (err || !row)
        return wantsHTML(req) ? res.redirect('/login.html') : res.status(401).json({ error: 'Invalid session' });
      if (row.is_admin !== 1)
        return wantsHTML(req) ? res.redirect('/login.html') : res.status(403).json({ error: 'Forbidden' });
      req.user = { userid: row.userid, email: row.email, is_admin: true };
      next();
    }
  );
}

// -------- CSRF：颁发 + 校验 --------
app.get('/api/csrf', (req, res) => {
  const csrf = generateToken();
  res.cookie('csrf_token', csrf, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'Strict',
    maxAge: 60 * 60 * 1000,
    path: '/',
  });
  res.json({ csrf });
});
function validateCSRF(req, res, next) {
  const cookieToken = req.cookies?.csrf_token;
  const bodyToken   = req.body?.csrf || req.query?.csrf;
  if (!cookieToken || !bodyToken || cookieToken !== bodyToken) {
    return res.status(403).json({ error: 'CSRF token invalid' });
  }
  next();
}

// -------- 认证：登录 / 注册 / 登出 / 我是谁 --------
app.post('/api/login', upload.none(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  handleValidationErrors,
  (req, res) => {
    const { email, password } = req.body;
    db.get('SELECT * FROM users WHERE email=?', [email], async (err, user) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      if (!user) return res.json({ error: 'Invalid email or password' });
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) return res.json({ error: 'Invalid email or password' });

      // 防会话固定：清旧会话 → 发新 token
      db.run('DELETE FROM sessions WHERE userid=?', [user.userid], (e1) => {
        if (e1) return res.status(500).json({ error: 'DB error' });
        const token = generateToken();
        db.run('INSERT INTO sessions(token, userid) VALUES (?,?)', [token, user.userid], (e2) => {
          if (e2) return res.status(500).json({ error: 'DB error' });
          res.cookie('auth', token, {
            httpOnly: true,
            secure: IS_PROD,
            sameSite: 'Strict',
            maxAge: 3 * 24 * 3600 * 1000,
          });
          res.json({ success: true, admin: user.is_admin === 1 });
        });
      });
    });
  }
);

app.post('/api/register', upload.none(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('password2').custom((v, { req }) => v === req.body.password),
  handleValidationErrors,
  async (req, res) => {
    const { email, password } = req.body;
    const hashed = await bcrypt.hash(password, 12);
    db.run(
      'INSERT INTO users(email, password, is_admin) VALUES (?, ?, 0)',
      [email, hashed],
      (err) => {
        if (err) return res.json({ error: 'Email already exists' });
        res.json({ success: true });
      }
    );
  }
);

app.post('/api/logout', (req, res) => {
  const token = req.cookies?.auth;
  if (token) db.run('DELETE FROM sessions WHERE token=?', [token], () => {});
  res.clearCookie('auth');
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  const token = req.cookies?.auth;
  if (!token) return res.json({ loggedIn: false });
  db.get(
    'SELECT u.userid, u.email, u.is_admin FROM sessions s JOIN users u ON s.userid=u.userid WHERE s.token=?',
    [token],
    (err, row) => {
      if (err || !row) return res.json({ loggedIn: false });
      res.json({ loggedIn: true, email: row.email, admin: row.is_admin === 1 });
    }
  );
});

// -------- 修改密码（登录即可；改完强制登出）--------
app.post('/api/change-password', requireLogin, upload.none(),
  body('current').isLength({ min: 6 }),
  body('password').isLength({ min: 6 }),
  body('password2').custom((v, { req }) => v === req.body.password),
  handleValidationErrors,
  async (req, res) => {
    const { current, password } = req.body;
    const { userid } = req.user;
    db.get('SELECT password FROM users WHERE userid=?', [userid], async (err, row) => {
      if (err || !row) return res.status(500).json({ error: 'DB error' });
      const ok = await bcrypt.compare(current, row.password);
      if (!ok) return res.status(400).json({ error: 'Current password incorrect' });

      const hashed = await bcrypt.hash(password, 12);
      db.run('UPDATE users SET password=? WHERE userid=?', [hashed, userid], (e1) => {
        if (e1) return res.status(500).json({ error: 'DB error' });
        db.run('DELETE FROM sessions WHERE userid=?', [userid], (e2) => {
          res.clearCookie('auth');
          res.json({ success: true });
        });
      });
    });
  }
);

// -------- Admin 页面保护（静态托管之前）--------
app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.get('/admin.html', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// -------- 静态资源 --------
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ========== Categories ==========
app.get('/api/categories', (req, res) => {
  db.all('SELECT catid, name FROM categories ORDER BY name;', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows.map(r => ({ ...r, name: escapeHTML(r.name) })));
  });
});

app.post('/api/categories',
  requireAdmin, validateCSRF,
  body('name').trim().isLength({ min: 1, max: 100 }),
  handleValidationErrors,
  (req, res) => {
    const { name } = req.body;
    db.run('INSERT INTO categories(name) VALUES (?)', [name], function(err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.status(201).json({ catid: this.lastID, name: escapeHTML(name) });
    });
  }
);

app.delete('/api/categories/:id',
  requireAdmin, validateCSRF,
  param('id').isInt(),
  handleValidationErrors,
  (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM categories WHERE catid = ?;', [id], function(err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json({ deleted: this.changes });
    });
  }
);

// ========== Products ==========

// 列表（可按分类）
app.get('/api/products',
  query('catid').optional().isInt(),
  handleValidationErrors,
  (req, res) => {
    const { catid } = req.query;
    const sql = catid
      ? 'SELECT pid, catid, name, price, description, image FROM products WHERE catid = ? ORDER BY pid DESC;'
      : 'SELECT pid, catid, name, price, description, image FROM products ORDER BY pid DESC;';
    const params = catid ? [catid] : [];
    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json(rows.map(sanitizeProduct));
    });
  }
);

// ✅ 补回：单个商品详情（供 product.html 使用）
app.get('/api/product',
  query('pid').isInt(),
  handleValidationErrors,
  (req, res) => {
    const { pid } = req.query;
    db.get(
      'SELECT pid, catid, name, price, description, image FROM products WHERE pid = ?;',
      [pid],
      (err, row) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        if (!row) return res.status(404).json({ error: 'Not found' });
        res.json(sanitizeProduct(row));
      }
    );
  }
);

async function saveResizedImages(tmpPath, pid) {
  const bigDir   = path.join(__dirname, 'uploads', 'big');
  const smallDir = path.join(__dirname, 'uploads', 'small');
  if (!fs.existsSync(bigDir))   fs.mkdirSync(bigDir,   { recursive: true });
  if (!fs.existsSync(smallDir)) fs.mkdirSync(smallDir, { recursive: true });

  const bigPath   = path.join(bigDir,   `${pid}_big.jpg`);
  const smallPath = path.join(smallDir, `${pid}_small.jpg`);

  await sharp(tmpPath).resize({ width: 1200 }).jpeg({ quality: 80 }).toFile(bigPath);
  await sharp(tmpPath).resize({ width: 300  }).jpeg({ quality: 80 }).toFile(smallPath);
  fs.unlink(tmpPath, () => {});
  return { big: `/uploads/big/${pid}_big.jpg`, small: `/uploads/small/${pid}_small.jpg` };
}

app.post('/api/products',
  requireAdmin, validateCSRF,
  upload.single('image'),
  body('catid').isInt(),
  body('name').trim().isLength({ min: 1 }),
  body('price').isFloat({ gt: 0 }),
  body('description').optional().isLength({ max: 1000 }),
  handleValidationErrors,
  (req, res) => {
    const { catid, name, price, description } = req.body;
    db.run(
      'INSERT INTO products(catid, name, price, description) VALUES (?, ?, ?, ?);',
      [catid, name, price, description || ''],
      function(err) {
        if (err) return res.status(500).json({ error: 'DB error' });
        const pid  = this.lastID;
        const file = req.file;
        if (!file) {
          return res.status(201).json({
            pid, catid, name: escapeHTML(name), price,
            description: description ? escapeHTML(description) : '',
            image: null
          });
        }
        saveResizedImages(file.path, pid)
          .then(({ big, small }) => {
            const image = JSON.stringify({ big, small });
            db.run('UPDATE products SET image = ? WHERE pid = ?', [image, pid], (e2) => {
              if (e2) return res.status(500).json({ error: 'DB error after image' });
              res.status(201).json({
                pid, catid, name: escapeHTML(name), price,
                description: description ? escapeHTML(description) : '',
                image: { big, small }
              });
            });
          })
          .catch(() => res.status(500).json({ error: 'Image processing failed' }));
      }
    );
  }
);

app.put('/api/products/:id',
  requireAdmin, validateCSRF,
  upload.single('image'),
  param('id').isInt(),
  body('catid').optional().isInt(),
  body('name').optional().trim().isLength({ min: 1 }),
  body('price').optional().isFloat({ gt: 0 }),
  body('description').optional().isLength({ max: 1000 }),
  handleValidationErrors,
  async (req, res) => {
    const { id } = req.params;
    const { catid, name, price, description } = req.body;

    const fields = [];
    const params = [];
    if (catid !== undefined)     { fields.push('catid = ?');     params.push(catid); }
    if (name !== undefined)      { fields.push('name  = ?');     params.push(name); }
    if (price !== undefined)     { fields.push('price = ?');     params.push(price); }
    if (description !== undefined){ fields.push('description = ?'); params.push(description); }

    const file = req.file;
    if (file) {
      try {
        const { big, small } = await saveResizedImages(file.path, id);
        fields.push('image = ?');
        params.push(JSON.stringify({ big, small }));
      } catch {
        return res.status(500).json({ error: 'Image processing failed' });
      }
    }

    if (fields.length === 0) return res.json({ updated: 0 });
    const sql = `UPDATE products SET ${fields.join(', ')} WHERE pid = ?`;
    params.push(id);
    db.run(sql, params, function(err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json({ updated: this.changes });
    });
  }
);

app.delete('/api/products/:id',
  requireAdmin, validateCSRF,
  param('id').isInt(),
  handleValidationErrors,
  (req, res) => {
    const { id } = req.params;
    db.get('SELECT image FROM products WHERE pid = ?', [id], (err, row) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      db.run('DELETE FROM products WHERE pid = ?', [id], function(e2) {
        if (e2) return res.status(500).json({ error: 'DB error' });
        try {
          if (row && row.image) {
            const img = JSON.parse(row.image);
            for (const p of [img.big, img.small]) {
              if (!p) continue;
              const abs = path.join(__dirname, p);
              fs.unlink(abs, () => {});
            }
          }
        } catch {}
        res.json({ deleted: this.changes });
      });
    });
  }
);

// -------- 主页 --------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// -------- 错误处理 --------
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal error' });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});