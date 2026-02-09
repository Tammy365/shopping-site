// server.js — Phase 2B backend
import express from 'express';
import path from 'path';
import fs from 'fs';
import morgan from 'morgan';
import multer from 'multer';
import sharp from 'sharp';
import sqlite3 from 'sqlite3';
import { body, param, query, validationResult } from 'express-validator';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 基础安全
app.disable('x-powered-by');

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// 静态资源
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// SQLite 连接
sqlite3.verbose();
const db = new sqlite3.Database(path.join(__dirname, 'db', 'shop.db'));
db.serialize(() => db.run('PRAGMA foreign_keys = ON;'));

// Multer（≤10MB）
const upload = multer({
  dest: path.join(__dirname, 'uploads', 'tmp'),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
}

// ========== Categories ==========
app.get('/api/categories', (req, res) => {
  db.all('SELECT catid, name FROM categories ORDER BY name;', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

app.post('/api/categories',
  body('name').trim().isLength({ min: 1, max: 100 }),
  handleValidationErrors,
  (req, res) => {
    const { name } = req.body;
    db.run('INSERT INTO categories(name) VALUES (?)', [name], function(err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.status(201).json({ catid: this.lastID, name });
    });
  }
);

app.delete('/api/categories/:id',
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
      res.json(rows);
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
      res.json(row);
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
        if (!file) return res.status(201).json({ pid, catid, name, price, description, image: null });
        saveResizedImages(file.path, pid)
          .then(({ big, small }) => {
            const image = JSON.stringify({ big, small });
            db.run('UPDATE products SET image = ? WHERE pid = ?', [image, pid], (e2) => {
              if (e2) return res.status(500).json({ error: 'DB error after image' });
              res.status(201).json({ pid, catid, name, price, description, image: { big, small } });
            });
          })
          .catch(() => res.status(500).json({ error: 'Image processing failed' }));
      }
    );
  }
);

app.put('/api/products/:id',
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
