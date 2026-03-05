// server.js — Phase 2B + Phase 4 (Auth + Security)
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
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// -------- 基础安全 --------
app.disable('x-powered-by');

// 轻量 CSP（为兼容你现有的 product.html 内联脚本，临时放开 'unsafe-inline'；后续可改 nonce）
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "img-src 'self' data: blob:",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'"
    ].join('; ')
  );
  // 附加常见安全头
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

// -------- SQLite 连接 --------
sqlite3.verbose();
const db = new sqlite3.Database(path.join(__dirname, 'db', 'shop.db'));
db.serialize(() => db.run('PRAGMA foreign_keys = ON;'));

// -------- Multer（≤10MB）--------
const upload = multer({
  dest: path.join(__dirname, 'uploads', 'tmp'),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// -------- 公共工具 --------
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
}

// 输出转义（防御 XSS：如未来在服务器端拼接 HTML 时使用）
function escapeHTML(str = '') {
  return String(str).replace(/[&<>"']/g, (m) => ({
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

// -------- 会话与鉴权 --------
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// 校验是否为管理员
function requireAdmin(req, res, next) {
  const token = req.cookies?.auth;
  if (!token) return res.status(401).json({ error: 'Not logged in' });

  db.get(
    'SELECT u.userid, u.is_admin FROM sessions s JOIN users u ON s.userid=u.userid WHERE s.token=?',
    [token],
    (err, row) => {
      if (err || !row) return res.status(401).json({ error: 'Invalid session' });
      if (row.is_admin !== 1) return res.status(403).json({ error: 'Forbidden' });
      // 可把用户信息挂到 req 供后续使用
      req.user = { userid: row.userid, is_admin: row.is_admin === 1 };
      next();
    }
  );
}

// 登录
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

      // 防会话固定：清理该用户旧会话，签发新 token
      db.run('DELETE FROM sessions WHERE userid=?', [user.userid], (e1) => {
        if (e1) return res.status(500).json({ error: 'DB error' });

        const token = generateToken();
        db.run('INSERT INTO sessions(token, userid) VALUES (?,?)', [token, user.userid], (e2) => {
          if (e2) return res.status(500).json({ error: 'DB error' });

          res.cookie('auth', token, {
            httpOnly: true,
            secure: IS_PROD,          // 本地开发可为 false；上线需 true（HTTPS）
            sameSite: 'Strict',
            maxAge: 3 * 24 * 3600 * 1000
          });
          res.json({ success: true, admin: user.is_admin === 1 });
        });
      });
    });
  }
);

// 注册
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

// 登出
app.post('/api/logout', (req, res) => {
  const token = req.cookies?.auth;
  if (token) db.run('DELETE FROM sessions WHERE token=?', [token], () => {});
  res.clearCookie('auth');
  res.json({ success: true });
});

// 查询当前登录状态（可选，方便前端显示“Hi, admin/guest”）
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

// -------- Admin 页面保护（务必放在静态资源之前，以拦截 /admin.html）--------
app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.get('/admin.html', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// -------- 静态资源（置于 /admin 保护之后）--------
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ========== Categories ==========
app.get('/api/categories', (req, res) => {
  db.all('SELECT catid, name FROM categories ORDER BY name;', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    // 输出编码（如果未来这些值拼到 HTML 中）
    res.json(rows.map(r => ({ ...r, name: escapeHTML(r.name) })));
  });
});

app.post('/api/categories',
  requireAdmin,
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
  requireAdmin,
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

app.get('/api/product',
  query('pid').isInt(),
  handleValidationErrors,
  (req, res) => {
    const { pid } = req.query;
    db.get('SELECT pid, catid, name, price, description, image FROM products WHERE pid = ?;', [pid], (err, row) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      if (!row) return res.status(404).json({ error: 'Not found' });
      res.json(sanitizeProduct(row));
    });
  }
);

// 保存并生成两张图
async function saveResizedImages(tmpPath, pid) {
  const bigDir = path.join(__dirname, 'uploads', 'big');
  const smallDir = path.join(__dirname, 'uploads', 'small');
  if (!fs.existsSync(bigDir)) fs.mkdirSync(bigDir, { recursive: true });
  if (!fs.existsSync(smallDir)) fs.mkdirSync(smallDir, { recursive: true });

  const bigPath = path.join(bigDir, `${pid}_big.jpg`);
  const smallPath = path.join(smallDir, `${pid}_small.jpg`);

  // 大图 1200px，缩略图 300px
  await sharp(tmpPath).resize({ width: 1200 }).jpeg({ quality: 80 }).toFile(bigPath);
  await sharp(tmpPath).resize({ width: 300 }).jpeg({ quality: 80 }).toFile(smallPath);

  fs.unlink(tmpPath, () => {});
  return { big: `/uploads/big/${pid}_big.jpg`, small: `/uploads/small/${pid}_small.jpg` };
}

app.post('/api/products',
  requireAdmin,
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
        const pid = this.lastID;
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
  requireAdmin,
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
    if (catid !== undefined) { fields.push('catid = ?'); params.push(catid); }
    if (name !== undefined) { fields.push('name = ?'); params.push(name); }
    if (price !== undefined) { fields.push('price = ?'); params.push(price); }
    if (description !== undefined) { fields.push('description = ?'); params.push(description); }

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
  requireAdmin,
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

// 根路径：返回主页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 错误处理
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal error' });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});