// server.js — AND BILLUR TEXTILE Box Sistema v3 (production-hardened)
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const { pool, initDB, hashPassword, verifyPassword, isLegacyHash } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';
// Vergul bilan bir nechta frontend (masalan: custom domain + Render preview)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || 'https://app.andbillur.com')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const UNDO_WINDOW_MS = 2 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 daqiqa
const RATE_LIMIT_MAX = 5;                   // 5 ta xato urinish

// Render proxy ortida — to'g'ri client IP olish uchun
app.set('trust proxy', 1);

// ============== HELPERS ==============
function getClientIP(req) {
  return req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
}

function parseCookies(req) {
  const c = {}; const h = req.headers.cookie || '';
  h.split(';').forEach(p => { const [k, v] = p.trim().split('='); if (k) c[k.trim()] = decodeURIComponent(v || ''); });
  return c;
}

function normalizeBoxNumber(raw) {
  const v = String(raw || '').trim();
  if (!/^\d{1,2}$/.test(v)) return null;
  const n = parseInt(v, 10);
  if (n < 1 || n > 50) return null;
  return String(n).padStart(2, '0');
}

function makeBoxUid(zakaz, boxNum) {
  return 'bx-' + String(zakaz).trim() + '-' + String(boxNum).trim() + '-' + Date.now() + '-' + crypto.randomBytes(2).toString('hex');
}

function sanitizeStr(v, max = 200) {
  if (v === undefined || v === null) return '';
  return String(v).trim().slice(0, max);
}

async function appendAudit(type, user, details = {}, ip = null) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (type, by_user, by_name, ip, details) VALUES ($1, $2, $3, $4, $5)`,
      [type, user?.username || 'system', user?.name || user?.username || 'System', ip, details]
    );
  } catch (e) { console.error('Audit log error:', e.message); }
}

// ============== RATE LIMITER (login) ==============
async function checkLoginRateLimit(ip) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM login_attempts
     WHERE ip = $1 AND success = FALSE AND at > NOW() - INTERVAL '5 minutes'`,
    [ip]
  );
  return rows[0].c < RATE_LIMIT_MAX;
}

async function logLoginAttempt(ip, username, success) {
  await pool.query(
    `INSERT INTO login_attempts (ip, username, success) VALUES ($1, $2, $3)`,
    [ip, username || null, success]
  );
  // Eski yozuvlarni tozalash
  await pool.query(`DELETE FROM login_attempts WHERE at < NOW() - INTERVAL '1 day'`);
}

// ============== SESSIONS ==============
async function createSession(user, ip, ua) {
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query(
    `INSERT INTO sessions (token, user_data, ip, ua) VALUES ($1, $2, $3, $4)`,
    [token, user, ip, ua]
  );
  await pool.query(`DELETE FROM sessions WHERE created_at < NOW() - INTERVAL '8 hours'`);
  return token;
}

async function getSession(req) {
  const auth = req.headers['x-session-token'] || req.cookies?.token;
  if (!auth || typeof auth !== 'string' || auth.length < 32) return null;
  const { rows } = await pool.query(
    `UPDATE sessions SET last_seen = NOW()
     WHERE token = $1 AND created_at > NOW() - INTERVAL '8 hours'
     RETURNING user_data`,
    [auth]
  );
  if (!rows.length) return null;
  return rows[0].user_data;
}

async function deleteSession(token) {
  if (!token) return;
  await pool.query(`DELETE FROM sessions WHERE token = $1`, [token]);
}

function cookieOptions() {
  // Production: HTTPS only + Strict
  const flags = ['Path=/', 'HttpOnly', 'Max-Age=28800'];
  if (IS_PROD) {
    flags.push('Secure');
    flags.push('SameSite=Strict');
  } else {
    flags.push('SameSite=Lax');
  }
  return flags.join('; ');
}

// ============== MIDDLEWARE ==============
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use((req, res, next) => { req.cookies = parseCookies(req); next(); });

// Security headers (helmet replacement)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  if (IS_PROD) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    // CSP faqat HTML/statik uchun ma'noli; JSON API javoblariga qo'yilganda ba'zi cross-origin clientlar chalkashadi
    if (!req.path.startsWith('/api')) {
      res.setHeader('Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data:; " +
        "font-src 'self' data:; " +
        "connect-src 'self'; " +
        "frame-ancestors 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self'"
      );
    }
  }
  next();
});

// CORS — production'da ro'yxatdagi frontend domenlari
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (IS_PROD) {
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    }
  } else {
    // Dev'da hamma origin'ga ruxsat
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-session-token');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

async function requireAuth(req, res, next) {
  const user = await getSession(req);
  if (!user) return res.status(401).json({ error: 'Tizimga kiring' });
  req.user = user;
  next();
}

function requireRole(...roles) {
  return async (req, res, next) => {
    const user = await getSession(req);
    if (!user) return res.status(401).json({ error: 'Tizimga kiring' });
    if (!roles.includes(user.role)) return res.status(403).json({ error: 'Ruxsat yo\'q' });
    req.user = user;
    next();
  };
}

// ============== AUTH ==============
app.post('/api/login', async (req, res) => {
  const ip = getClientIP(req);
  const ua = sanitizeStr(req.headers['user-agent'], 500);
  try {
    // Rate limit
    const allowed = await checkLoginRateLimit(ip);
    if (!allowed) {
      await appendAudit('LOGIN_BLOCKED_RATELIMIT', { username: 'system', name: 'System' }, { ip }, ip);
      return res.status(429).json({ error: 'Juda ko\'p urinish. 5 daqiqadan keyin urinib ko\'ring.' });
    }

    const username = sanitizeStr(req.body?.username, 50);
    const password = sanitizeStr(req.body?.password, 200);
    if (!username || !password) {
      await logLoginAttempt(ip, username, false);
      return res.status(400).json({ error: 'Login va parol kerak' });
    }

    const { rows } = await pool.query(`SELECT * FROM users WHERE username = $1`, [username]);
    if (!rows.length) {
      await logLoginAttempt(ip, username, false);
      // Timing attack'dan saqlanish: harqalay bcrypt ishlasin
      await new Promise(r => setTimeout(r, 100));
      return res.status(401).json({ error: 'Login yoki parol xato' });
    }

    const user = rows[0];
    const ok = await verifyPassword(password, user.password);
    if (!ok) {
      await logLoginAttempt(ip, username, false);
      await appendAudit('LOGIN_FAILED', { username, name: username }, { ip }, ip);
      return res.status(401).json({ error: 'Login yoki parol xato' });
    }

    // Eski sha256 hashni bcrypt'ga ko'chirish
    if (isLegacyHash(user.password)) {
      try {
        const newHash = await hashPassword(password);
        await pool.query(`UPDATE users SET password = $1 WHERE id = $2`, [newHash, user.id]);
      } catch (e) { console.error('Password migration failed:', e.message); }
    }

    await logLoginAttempt(ip, username, true);

    const userObj = {
      id: user.id, username: user.username, role: user.role, name: user.name,
      mustChangePwd: user.must_change_pwd === true
    };
    const token = await createSession(userObj, ip, ua);
    res.setHeader('Set-Cookie', `token=${token}; ${cookieOptions()}`);
    await appendAudit('LOGIN_SUCCESS', userObj, { ip }, ip);
    res.json({ ok: true, token, user: userObj });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

app.post('/api/logout', async (req, res) => {
  const token = req.cookies.token || req.headers['x-session-token'];
  await deleteSession(token);
  // Cookie tozalash
  const clearFlags = IS_PROD ? 'Path=/; Max-Age=0; Secure; SameSite=Strict' : 'Path=/; Max-Age=0; SameSite=Lax';
  res.setHeader('Set-Cookie', `token=; ${clearFlags}`);
  res.json({ ok: true });
});

app.get('/api/me', async (req, res) => {
  const user = await getSession(req);
  res.json({ user: user || null });
});

// Parolni o'zgartirish (har kim o'zinikini o'zgartira oladi)
app.post('/api/change-password', requireAuth, async (req, res) => {
  try {
    const oldPwd = sanitizeStr(req.body?.oldPassword, 200);
    const newPwd = sanitizeStr(req.body?.newPassword, 200);
    if (!oldPwd || !newPwd) return res.status(400).json({ error: 'Eski va yangi parol kerak' });
    if (newPwd.length < 6) return res.status(400).json({ error: 'Yangi parol kamida 6 belgi bo\'lishi kerak' });

    const { rows } = await pool.query(`SELECT password FROM users WHERE id = $1`, [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Topilmadi' });

    const ok = await verifyPassword(oldPwd, rows[0].password);
    if (!ok) return res.status(401).json({ error: 'Eski parol noto\'g\'ri' });

    const newHash = await hashPassword(newPwd);
    await pool.query(
      `UPDATE users SET password = $1, must_change_pwd = FALSE WHERE id = $2`,
      [newHash, req.user.id]
    );
    await appendAudit('PASSWORD_CHANGED_SELF', req.user, {}, getClientIP(req));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============== ORDERS ==============
app.get('/api/orders', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM orders ORDER BY created_at DESC`);
    res.json(rows.map(r => ({
      id: r.id, model: r.model, color: r.color, barcode: r.barcode, total: r.total, createdAt: r.created_at
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/orders/by-barcode/:barcode', requireAuth, async (req, res) => {
  try {
    const bc = sanitizeStr(req.params.barcode, 100);
    if (!bc) return res.status(400).json({ error: 'Barcode kerak' });
    const { rows } = await pool.query(`SELECT * FROM orders WHERE barcode = $1`, [bc]);
    if (!rows.length) return res.status(404).json({ error: 'Topilmadi' });
    const r = rows[0];
    res.json({ id: r.id, model: r.model, color: r.color, barcode: r.barcode, total: r.total });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/orders', requireRole('admin'), async (req, res) => {
  try {
    const model = sanitizeStr(req.body?.model, 100);
    const color = sanitizeStr(req.body?.color, 100);
    const total = parseInt(req.body?.total);
    const barcode = sanitizeStr(req.body?.barcode, 100) || null;

    if (!model || !color || !total || total <= 0) return res.status(400).json({ error: 'Model, rang va miqdor kerak' });
    const id = 'ord' + Date.now();

    if (barcode) {
      const dup = await pool.query(`SELECT 1 FROM orders WHERE barcode = $1`, [barcode]);
      if (dup.rows.length) return res.status(400).json({ error: 'Bu barcode allaqachon ishlatilgan' });
    }
    const dup2 = await pool.query(`SELECT 1 FROM orders WHERE model = $1 AND color = $2`, [model, color]);
    if (dup2.rows.length) return res.status(400).json({ error: 'Bu model va rang allaqachon mavjud' });

    await pool.query(
      `INSERT INTO orders (id, model, color, barcode, total) VALUES ($1, $2, $3, $4, $5)`,
      [id, model, color, barcode, total]
    );
    await appendAudit('ORDER_CREATED', req.user, { id, model, color, barcode }, getClientIP(req));
    res.json({ id, model, color, barcode, total });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/orders/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = sanitizeStr(req.params.id, 100);
    const { rows } = await pool.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    if (!rows.length) return res.status(404).json({ error: 'Topilmadi' });

    const newModel = req.body.model !== undefined ? sanitizeStr(req.body.model, 100) : rows[0].model;
    const newColor = req.body.color !== undefined ? sanitizeStr(req.body.color, 100) : rows[0].color;
    const newTotal = req.body.total !== undefined ? parseInt(req.body.total) : rows[0].total;
    const newBarcode = req.body.barcode !== undefined ? (sanitizeStr(req.body.barcode, 100) || null) : rows[0].barcode;

    if (newBarcode && newBarcode !== rows[0].barcode) {
      const dup = await pool.query(`SELECT 1 FROM orders WHERE barcode = $1 AND id != $2`, [newBarcode, id]);
      if (dup.rows.length) return res.status(400).json({ error: 'Bu barcode boshqa orderda mavjud' });
    }

    await pool.query(
      `UPDATE orders SET model=$1, color=$2, barcode=$3, total=$4 WHERE id=$5`,
      [newModel, newColor, newBarcode, newTotal, id]
    );
    await appendAudit('ORDER_UPDATED', req.user, { id }, getClientIP(req));
    res.json({ id, model: newModel, color: newColor, barcode: newBarcode, total: newTotal });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/orders/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = sanitizeStr(req.params.id, 100);
    await pool.query(`DELETE FROM orders WHERE id = $1`, [id]);
    await appendAudit('ORDER_DELETED', req.user, { id }, getClientIP(req));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============== BOXES ==============
function rowToBox(r) {
  return {
    uid: r.uid, id: r.box_num, zakaz: r.zakaz, type: r.type,
    kg: parseFloat(r.kg) || 0, status: r.status,
    model: r.model, color: r.color, sizes: r.sizes, items: r.items,
    createdBy: r.created_by, createdByName: r.created_by_name,
    createdAt: r.created_at, createdDate: r.created_date,
    updatedAt: r.updated_at, statusHistory: r.status_history || []
  };
}

app.get('/api/boxes', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM boxes ORDER BY created_at DESC LIMIT 5000`);
    res.json(rows.map(rowToBox));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/boxes', requireAuth, async (req, res) => {
  try {
    const id = sanitizeStr(req.body?.id, 10);
    const zakaz = sanitizeStr(req.body?.zakaz, 50);
    const type = req.body?.type === 'mix' ? 'mix' : 'simple';
    const kg = Math.max(0, parseFloat(req.body?.kg) || 0);

    if (!id || !zakaz) return res.status(400).json({ error: 'Box raqami va zakaz kerak' });
    const boxNum = normalizeBoxNumber(id);
    if (!boxNum) return res.status(400).json({ error: 'Box raqami 01 dan 50 gacha bo\'lishi kerak' });

    const dup = await pool.query(`SELECT 1 FROM boxes WHERE zakaz = $1 AND box_num = $2`, [zakaz, boxNum]);
    if (dup.rows.length) return res.status(400).json({ error: 'Bu zakazda ' + boxNum + ' raqamli box bor' });

    const cnt = await pool.query(`SELECT COUNT(*)::int AS c FROM boxes WHERE zakaz = $1`, [zakaz]);
    if (cnt.rows[0].c >= 50) return res.status(400).json({ error: 'Bu zakaz uchun 50 box limitiga yetilgan!' });

    let model = null, color = null, sizes = null, items = null;
    if (type === 'simple') {
      model = sanitizeStr(req.body?.model, 100) || null;
      color = sanitizeStr(req.body?.color, 100) || null;
      // sizes: object { "92": 5, "98": 10, ... }
      if (req.body?.sizes && typeof req.body.sizes === 'object') {
        const cleaned = {};
        Object.keys(req.body.sizes).forEach(k => {
          const v = parseInt(req.body.sizes[k]);
          if (!isNaN(v) && v > 0) cleaned[k] = v;
        });
        sizes = cleaned;
      }
    } else {
      // mix: items array — kamida 2 ta element kerak
      if (!Array.isArray(req.body?.items) || req.body.items.length < 2) {
        return res.status(400).json({ error: 'Mix box uchun kamida 2 ta model kerak' });
      }
      const cleanedItems = [];
      for (const it of req.body.items) {
        const m = sanitizeStr(it?.model, 100);
        const c = sanitizeStr(it?.color, 100);
        const s = {};
        if (it?.sizes && typeof it.sizes === 'object') {
          Object.keys(it.sizes).forEach(k => {
            const v = parseInt(it.sizes[k]);
            if (!isNaN(v) && v > 0) s[k] = v;
          });
        }
        if (m && c && Object.keys(s).length) cleanedItems.push({ model: m, color: c, sizes: s });
      }
      if (cleanedItems.length < 2) return res.status(400).json({ error: 'Mix box uchun kamida 2 ta to\'liq model kerak' });
      items = cleanedItems;
    }

    const uid = makeBoxUid(zakaz, boxNum);
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const history = [{ from: null, to: 'packed', at: now.toISOString(), by: req.user.username }];

    await pool.query(
      `INSERT INTO boxes (uid, box_num, zakaz, type, kg, status, model, color, sizes, items,
                          created_by, created_by_name, created_at, created_date, status_history)
       VALUES ($1,$2,$3,$4,$5,'packed',$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [uid, boxNum, zakaz, type, kg,
       model, color,
       sizes ? JSON.stringify(sizes) : null,
       items ? JSON.stringify(items) : null,
       req.user.username, req.user.name, now, today, JSON.stringify(history)]
    );

    await appendAudit('BOX_CREATED', req.user, { uid, id: boxNum, zakaz, type }, getClientIP(req));
    const { rows } = await pool.query(`SELECT * FROM boxes WHERE uid = $1`, [uid]);
    res.json(rowToBox(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/boxes/:id', requireRole('admin', 'storekeeper'), async (req, res) => {
  try {
    const uid = sanitizeStr(req.body?.uid, 100);
    if (!uid) return res.status(400).json({ error: 'uid kerak' });
    const sel = await pool.query(`SELECT * FROM boxes WHERE uid = $1`, [uid]);
    if (!sel.rows.length) return res.status(404).json({ error: 'Topilmadi' });
    const box = sel.rows[0];

    const zakaz = sanitizeStr(req.body?.zakaz, 50) || box.zakaz;
    const kg = req.body?.kg !== undefined ? Math.max(0, parseFloat(req.body.kg) || 0) : (parseFloat(box.kg) || 0);

    let sizes = box.sizes;
    let items = box.items;
    if (box.type === 'simple') {
      const inSizes = req.body?.sizes;
      if (!inSizes || typeof inSizes !== 'object') return res.status(400).json({ error: 'sizes kerak' });
      const cleaned = {};
      Object.keys(inSizes).forEach(k => {
        const v = parseInt(inSizes[k], 10);
        if (!isNaN(v) && v > 0) cleaned[k] = v;
      });
      if (!Object.keys(cleaned).length) return res.status(400).json({ error: 'Kamida 1 ta razmer kerak' });
      sizes = cleaned;
    } else {
      const inItems = req.body?.items;
      if (!Array.isArray(inItems) || inItems.length < 1) return res.status(400).json({ error: 'items kerak' });
      const cleanedItems = [];
      inItems.forEach(it => {
        const m = sanitizeStr(it?.model, 100);
        const c = sanitizeStr(it?.color, 100);
        const s = {};
        Object.entries(it?.sizes || {}).forEach(([k, q]) => {
          const v = parseInt(q, 10);
          if (!isNaN(v) && v > 0) s[k] = v;
        });
        if (m && c && Object.keys(s).length) cleanedItems.push({ model: m, color: c, sizes: s });
      });
      if (!cleanedItems.length) return res.status(400).json({ error: 'Mix model razmerlari kerak' });
      items = cleanedItems;
    }

    await pool.query(
      `UPDATE boxes SET zakaz=$1, kg=$2, sizes=$3, items=$4, updated_at=NOW() WHERE uid=$5`,
      [zakaz, kg, sizes ? JSON.stringify(sizes) : null, items ? JSON.stringify(items) : null, uid]
    );
    await appendAudit('BOX_UPDATED', req.user, { uid, id: box.box_num, zakaz }, getClientIP(req));
    const { rows } = await pool.query(`SELECT * FROM boxes WHERE uid = $1`, [uid]);
    res.json(rowToBox(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/boxes/:id/status', requireRole('admin', 'storekeeper'), async (req, res) => {
  try {
    const uid = sanitizeStr(req.body?.uid, 100);
    const zakaz = sanitizeStr(req.body?.zakaz, 50);
    const newStatus = sanitizeStr(req.body?.status, 20);
    if (!['packed', 'warehouse'].includes(newStatus)) return res.status(400).json({ error: 'Status noto\'g\'ri' });

    const sel = uid
      ? await pool.query(`SELECT * FROM boxes WHERE uid = $1`, [uid])
      : await pool.query(`SELECT * FROM boxes WHERE box_num = $1 AND zakaz = $2`, [req.params.id, zakaz]);
    if (!sel.rows.length) return res.status(404).json({ error: 'Topilmadi' });

    const box = sel.rows[0];
    if (box.status === newStatus) return res.json(rowToBox(box));

    const history = Array.isArray(box.status_history) ? box.status_history : [];
    history.push({ from: box.status, to: newStatus, at: new Date().toISOString(), by: req.user.username });

    await pool.query(
      `UPDATE boxes SET status=$1, status_history=$2, updated_at=NOW() WHERE uid=$3`,
      [newStatus, JSON.stringify(history), box.uid]
    );
    await appendAudit('BOX_STATUS_CHANGED', req.user, { uid: box.uid, id: box.box_num, zakaz: box.zakaz, newStatus }, getClientIP(req));

    const { rows } = await pool.query(`SELECT * FROM boxes WHERE uid = $1`, [box.uid]);
    res.json(rowToBox(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/boxes/:id/undo', requireRole('admin', 'storekeeper'), async (req, res) => {
  try {
    const uid = sanitizeStr(req.body?.uid, 100);
    const zakaz = sanitizeStr(req.body?.zakaz, 50);
    const sel = uid
      ? await pool.query(`SELECT * FROM boxes WHERE uid = $1`, [uid])
      : await pool.query(`SELECT * FROM boxes WHERE box_num = $1 AND zakaz = $2`, [req.params.id, zakaz]);
    if (!sel.rows.length) return res.status(404).json({ error: 'Topilmadi' });
    const box = sel.rows[0];

    const history = Array.isArray(box.status_history) ? box.status_history : [];
    const last = history[history.length - 1];
    if (!last || !last.from) return res.status(400).json({ error: 'Qaytarishga amal yo\'q' });
    const age = Date.now() - new Date(last.at).getTime();
    if (Number.isNaN(age) || age > UNDO_WINDOW_MS) return res.status(400).json({ error: 'Undo vaqti tugagan (2 daqiqa)' });

    history.pop();
    await pool.query(
      `UPDATE boxes SET status=$1, status_history=$2, updated_at=NOW() WHERE uid=$3`,
      [last.from, JSON.stringify(history), box.uid]
    );
    await appendAudit('BOX_STATUS_UNDO', req.user, { uid: box.uid, revertedTo: last.from }, getClientIP(req));

    const { rows } = await pool.query(`SELECT * FROM boxes WHERE uid = $1`, [box.uid]);
    res.json(rowToBox(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/boxes/:id', requireRole('admin', 'storekeeper'), async (req, res) => {
  try {
    const uid = sanitizeStr(req.query?.uid, 100);
    const zakaz = sanitizeStr(req.query?.zakaz, 50);
    const sel = uid
      ? await pool.query(`SELECT * FROM boxes WHERE uid = $1`, [uid])
      : await pool.query(`SELECT * FROM boxes WHERE box_num = $1 AND zakaz = $2`, [req.params.id, zakaz]);
    if (!sel.rows.length) return res.status(404).json({ error: 'Topilmadi' });
    const box = sel.rows[0];
    await pool.query(`DELETE FROM boxes WHERE uid = $1`, [box.uid]);
    await appendAudit('BOX_DELETED', req.user, { uid: box.uid, id: box.box_num, zakaz: box.zakaz }, getClientIP(req));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============== SHIPMENTS ==============
function rowToShipment(r) {
  return {
    id: r.id, truckInfo: r.truck_info, note: r.note, status: r.status,
    boxUids: r.box_uids || [], snapshot: r.snapshot,
    createdBy: r.created_by, createdByName: r.created_by_name,
    createdAt: r.created_at, closedAt: r.closed_at, closedBy: r.closed_by
  };
}

app.get('/api/shipments', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM shipments ORDER BY created_at DESC LIMIT 1000`);
    res.json(rows.map(rowToShipment));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/shipments/open', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM shipments WHERE status = 'open' LIMIT 1`);
    res.json(rows.length ? rowToShipment(rows[0]) : null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/shipments/open', requireRole('admin', 'storekeeper'), async (req, res) => {
  try {
    const exist = await pool.query(`SELECT id FROM shipments WHERE status = 'open' LIMIT 1`);
    if (exist.rows.length) return res.status(400).json({ error: 'Allaqachon ochiq shipment bor: ' + exist.rows[0].id });

    const cnt = await pool.query(`SELECT COUNT(*)::int AS c FROM shipments`);
    const id = 'SHP-' + String(cnt.rows[0].c + 1).padStart(3, '0');
    const truckInfo = sanitizeStr(req.body?.truckInfo, 200);
    const note = sanitizeStr(req.body?.note, 500);

    await pool.query(
      `INSERT INTO shipments (id, truck_info, note, status, box_uids, created_by, created_by_name)
       VALUES ($1, $2, $3, 'open', '[]'::jsonb, $4, $5)`,
      [id, truckInfo, note, req.user.username, req.user.name]
    );
    await appendAudit('SHIPMENT_OPENED', req.user, { id }, getClientIP(req));

    const { rows } = await pool.query(`SELECT * FROM shipments WHERE id = $1`, [id]);
    res.json(rowToShipment(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/shipments/open/boxes', requireRole('admin', 'storekeeper'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const boxUid = sanitizeStr(req.body?.boxUid, 100);
    const action = sanitizeStr(req.body?.action, 10);
    const shp = await client.query(`SELECT * FROM shipments WHERE status = 'open' LIMIT 1 FOR UPDATE`);
    if (!shp.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Ochiq shipment topilmadi' }); }
    const shipment = shp.rows[0];

    const boxRes = await client.query(`SELECT * FROM boxes WHERE uid = $1 FOR UPDATE`, [boxUid]);
    if (!boxRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Box topilmadi' }); }
    const box = boxRes.rows[0];

    let boxUids = Array.isArray(shipment.box_uids) ? [...shipment.box_uids] : [];
    const history = Array.isArray(box.status_history) ? box.status_history : [];

    if (action === 'add') {
      if (box.status !== 'warehouse') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Faqat ombordagi boxni qo\'shish mumkin' }); }
      if (!boxUids.includes(box.uid)) boxUids.push(box.uid);
      history.push({ from: 'warehouse', to: 'shipping', at: new Date().toISOString(), by: req.user.username });
      await client.query(`UPDATE boxes SET status='shipping', status_history=$1, updated_at=NOW() WHERE uid=$2`, [JSON.stringify(history), box.uid]);
    } else if (action === 'remove') {
      if (box.status !== 'shipping') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Faqat shipmentga olingan boxni qaytarish mumkin' }); }
      boxUids = boxUids.filter(u => u !== box.uid);
      history.push({ from: 'shipping', to: 'warehouse', at: new Date().toISOString(), by: req.user.username });
      await client.query(`UPDATE boxes SET status='warehouse', status_history=$1, updated_at=NOW() WHERE uid=$2`, [JSON.stringify(history), box.uid]);
    } else {
      await client.query('ROLLBACK'); return res.status(400).json({ error: 'action: add yoki remove' });
    }

    await client.query(`UPDATE shipments SET box_uids = $1 WHERE id = $2`, [JSON.stringify(boxUids), shipment.id]);
    await client.query('COMMIT');

    await appendAudit(action === 'add' ? 'SHIPMENT_BOX_ADDED' : 'SHIPMENT_BOX_REMOVED', req.user, { shipmentId: shipment.id, uid: box.uid }, getClientIP(req));

    const { rows } = await pool.query(`SELECT * FROM shipments WHERE id = $1`, [shipment.id]);
    res.json(rowToShipment(rows[0]));
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

app.post('/api/shipments/open/close', requireRole('admin', 'storekeeper'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const shp = await client.query(`SELECT * FROM shipments WHERE status = 'open' LIMIT 1 FOR UPDATE`);
    if (!shp.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Ochiq shipment topilmadi' }); }
    const shipment = shp.rows[0];
    const boxUids = shipment.box_uids || [];
    if (!boxUids.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Shipmentda box yo\'q!' }); }

    const boxRes = await client.query(`SELECT * FROM boxes WHERE uid = ANY($1::text[]) FOR UPDATE`, [boxUids]);
    const boxes = boxRes.rows;
    const invalid = boxes.find(b => b.status !== 'shipping');
    if (invalid) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Avval barcha boxlar shipping bo\'lishi kerak' }); }

    const snapshot = boxes.map(b => ({
      uid: b.uid, id: b.box_num, zakaz: b.zakaz, kg: parseFloat(b.kg) || 0,
      type: b.type, model: b.model, color: b.color,
      sizes: b.sizes, items: b.items
    }));

    for (const b of boxes) {
      const h = Array.isArray(b.status_history) ? b.status_history : [];
      h.push({ from: 'shipping', to: 'shipped', at: new Date().toISOString(), by: req.user.username });
      await client.query(`UPDATE boxes SET status='shipped', status_history=$1, updated_at=NOW() WHERE uid=$2`, [JSON.stringify(h), b.uid]);
    }

    await client.query(
      `UPDATE shipments SET status='closed', closed_at=NOW(), closed_by=$1, snapshot=$2 WHERE id=$3`,
      [req.user.username, JSON.stringify(snapshot), shipment.id]
    );
    await client.query('COMMIT');
    await appendAudit('SHIPMENT_CLOSED', req.user, { id: shipment.id, count: boxes.length }, getClientIP(req));

    const { rows } = await pool.query(`SELECT * FROM shipments WHERE id = $1`, [shipment.id]);
    res.json(rowToShipment(rows[0]));
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

app.delete('/api/shipments/:id', requireRole('admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = sanitizeStr(req.params.id, 50);
    const shpRes = await client.query(`SELECT * FROM shipments WHERE id = $1 FOR UPDATE`, [id]);
    if (!shpRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Shipment topilmadi' });
    }
    const shipment = shpRes.rows[0];
    const boxUids = Array.isArray(shipment.box_uids) ? shipment.box_uids : [];

    if (shipment.status === 'open' && boxUids.length) {
      const boxRes = await client.query(`SELECT * FROM boxes WHERE uid = ANY($1::text[]) FOR UPDATE`, [boxUids]);
      for (const b of boxRes.rows) {
        if (b.status === 'shipping') {
          const h = Array.isArray(b.status_history) ? b.status_history : [];
          h.push({ from: 'shipping', to: 'warehouse', at: new Date().toISOString(), by: req.user.username });
          await client.query(
            `UPDATE boxes SET status='warehouse', status_history=$1, updated_at=NOW() WHERE uid=$2`,
            [JSON.stringify(h), b.uid]
          );
        }
      }
    }

    await client.query(`DELETE FROM shipments WHERE id = $1`, [id]);
    await client.query('COMMIT');
    await appendAudit('SHIPMENT_DELETED', req.user, { id }, getClientIP(req));
    res.json({ ok: true });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// ============== RANKING ==============
app.get('/api/ranking', requireAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { rows } = await pool.query(`SELECT * FROM boxes WHERE created_date = $1`, [today]);
    const map = {};
    rows.forEach(r => {
      const k = r.created_by;
      if (!map[k]) map[k] = { username: r.created_by, name: r.created_by_name || r.created_by, count: 0, total: 0 };
      map[k].count++;
      let dona = 0;
      if (r.type === 'mix' && Array.isArray(r.items)) {
        r.items.forEach(it => Object.values(it.sizes || {}).forEach(v => dona += v));
      } else if (r.sizes) {
        Object.values(r.sizes).forEach(v => dona += v);
      }
      map[k].total += dona;
    });
    res.json({ date: today, ranking: Object.values(map).sort((a, b) => b.count - a.count) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============== DETALNIY ==============
async function buildDetalniy(zakaz, model) {
  let q = `SELECT * FROM boxes WHERE status = 'warehouse'`;
  const params = [];
  if (zakaz) { params.push(zakaz); q += ` AND zakaz = $${params.length}`; }
  const { rows } = await pool.query(q, params);

  let boxes = rows;
  if (model) {
    const m = String(model).toLowerCase();
    boxes = boxes.filter(b => {
      if (b.type === 'simple') return b.model && b.model.toLowerCase().includes(m);
      return Array.isArray(b.items) && b.items.some(it => it.model && it.model.toLowerCase().includes(m));
    });
  }

  const groups = {};
  const keyPart = (v) => String(v || '').trim().toLowerCase();
  boxes.forEach(b => {
    if (b.type === 'simple') {
      const key = keyPart(b.model) + '|' + keyPart(b.color) + '|' + keyPart(b.zakaz);
      if (!groups[key]) groups[key] = { model: String(b.model || '').trim(), color: String(b.color || '').trim(), zakaz: b.zakaz, boxes: [], sizes: {} };
      groups[key].boxes.push(rowToBox(b));
      Object.entries(b.sizes || {}).forEach(([s, q]) => groups[key].sizes[s] = (groups[key].sizes[s] || 0) + q);
    } else {
      (b.items || []).forEach(it => {
        const key = keyPart(it.model) + '|' + keyPart(it.color) + '|' + keyPart(b.zakaz);
        if (!groups[key]) groups[key] = { model: String(it.model || '').trim(), color: String(it.color || '').trim(), zakaz: b.zakaz, boxes: [], sizes: {} };
        if (!groups[key].boxes.find(x => x.uid === b.uid)) groups[key].boxes.push(rowToBox(b));
        Object.entries(it.sizes || {}).forEach(([s, q]) => groups[key].sizes[s] = (groups[key].sizes[s] || 0) + q);
      });
    }
  });
  return Object.values(groups).sort((a, b) => {
    const z = String(a.zakaz).localeCompare(String(b.zakaz), undefined, { numeric: true });
    if (z !== 0) return z;
    const m = String(a.model).localeCompare(String(b.model));
    if (m !== 0) return m;
    return String(a.color).localeCompare(String(b.color));
  });
}

app.get('/api/detalniy', requireAuth, async (req, res) => {
  try {
    const zakaz = sanitizeStr(req.query.zakaz, 50);
    const model = sanitizeStr(req.query.model, 100);
    res.json(await buildDetalniy(zakaz, model));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/detalniy/excel', requireAuth, async (req, res) => {
  try {
    const zakaz = sanitizeStr(req.query.zakaz, 50);
    const model = sanitizeStr(req.query.model, 100);
    const gList = await buildDetalniy(zakaz, model);
    if (!gList.length) return res.status(404).json({ error: 'Ma\'lumot topilmadi' });

    const SIZES = [98, 104, 110, 116, 122, 128, 134, 140, 146, 152, 158, 164, 170, 176];
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sheet1');

    ws.mergeCells('E1:R1');
    ws.getRow(1).values = [
      'Model #', 'Color', 'Номер заказа', 'Спецификации', 'Размеры',
      '', '', '', '', '', '', '', '', '', '', '', '', '',
      'Pcs per Carton', 'Num of Cartons', 'Total pcs', 'Multipack',
      'Gross Ctn Wt Kgs', 'Net Ctn Wt Kgs', 'Total Gross Ctn Wt Kgs', 'Total Net Ctn Wt Kgs',
      'Carton Size cm / in', 'm3'
    ];
    ws.getRow(2).values = ['', '', '', '', ...SIZES.map(String)];

    ws.columns = [
      { width: 18 }, { width: 24 }, { width: 14 }, { width: 16 },
      ...SIZES.map(() => ({ width: 7 })),
      { width: 14 }, { width: 14 }, { width: 12 }, { width: 11 }, { width: 16 }, { width: 14 },
      { width: 18 }, { width: 16 }, { width: 16 }, { width: 13 }
    ];

    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2F0D9' } };
    [1, 2].forEach(rn => {
      const row = ws.getRow(rn);
      row.font = { bold: true, size: 10 };
      row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      row.eachCell((cell) => {
        cell.fill = headerFill;
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
    });

    let rowNum = 3;
    gList.forEach(g => {
      const totalKg = g.boxes.reduce((s, b) => s + (b.kg || 0), 0);
      const boxCount = g.boxes.length || 1;
      const r = ws.getRow(rowNum);
      r.getCell(1).value = g.model || '';
      r.getCell(2).value = g.color || '';
      r.getCell(3).value = g.zakaz || '';
      SIZES.forEach((sz, idx) => { r.getCell(5 + idx).value = g.sizes[sz] || ''; });
      r.getCell(19).value = { formula: `SUM(E${rowNum}:R${rowNum})` };
      r.getCell(20).value = boxCount;
      r.getCell(21).value = { formula: `T${rowNum}*S${rowNum}` };
      r.getCell(22).value = 1;
      r.getCell(23).value = Number(totalKg.toFixed(2));
      r.getCell(24).value = { formula: `W${rowNum}-1.2` };
      r.getCell(25).value = { formula: `W${rowNum}*T${rowNum}` };
      r.getCell(26).value = { formula: `X${rowNum}*T${rowNum}` };
      r.getCell(27).value = '60*40*40';
      r.getCell(28).value = { formula: `0.61*0.41*0.41*T${rowNum}` };
      r.alignment = { vertical: 'middle', horizontal: 'center' };
      r.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
      rowNum++;
    });

    const totalRow = ws.getRow(rowNum);
    totalRow.getCell(1).value = 'JAMI';
    totalRow.font = { bold: true };
    for (let c = 5; c <= 18; c++) totalRow.getCell(c).value = { formula: `SUM(${String.fromCharCode(64 + c)}3:${String.fromCharCode(64 + c)}${rowNum - 1})` };
    totalRow.getCell(20).value = { formula: `SUM(T3:T${rowNum - 1})` };
    totalRow.getCell(21).value = { formula: `SUM(U3:U${rowNum - 1})` };
    totalRow.getCell(23).value = { formula: `SUM(W3:W${rowNum - 1})` };
    totalRow.getCell(25).value = { formula: `SUM(Y3:Y${rowNum - 1})` };
    totalRow.getCell(26).value = { formula: `SUM(Z3:Z${rowNum - 1})` };
    totalRow.getCell(28).value = { formula: `SUM(AB3:AB${rowNum - 1})` };
    totalRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    const buf = await wb.xlsx.writeBuffer();
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Detalniy_' + date + '.xlsx"');
    res.send(Buffer.from(buf));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============== USERS ==============
app.get('/api/users', requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT id, username, role, name, must_change_pwd FROM users ORDER BY username`);
    res.json(rows.map(r => ({ id: r.id, username: r.username, role: r.role, name: r.name, mustChangePwd: r.must_change_pwd })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users', requireRole('admin'), async (req, res) => {
  try {
    const username = sanitizeStr(req.body?.username, 50);
    const password = sanitizeStr(req.body?.password, 200);
    const role = sanitizeStr(req.body?.role, 20);
    const name = sanitizeStr(req.body?.name, 100) || username;
    if (!username || !password || !role) return res.status(400).json({ error: 'Maydonlar to\'liq emas' });
    if (password.length < 6) return res.status(400).json({ error: 'Parol kamida 6 belgi bo\'lishi kerak' });
    if (!['admin', 'storekeeper', 'worker'].includes(role)) return res.status(400).json({ error: 'Noto\'g\'ri rol' });
    if (!/^[a-zA-Z0-9_-]{3,}$/.test(username)) return res.status(400).json({ error: 'Username faqat harf/raqam/_/- (3+)' });

    const dup = await pool.query(`SELECT 1 FROM users WHERE username = $1`, [username]);
    if (dup.rows.length) return res.status(400).json({ error: 'Bu username band' });

    const id = 'u' + Date.now();
    const hash = await hashPassword(password);
    await pool.query(
      `INSERT INTO users (id, username, password, role, name) VALUES ($1, $2, $3, $4, $5)`,
      [id, username, hash, role, name]
    );
    await appendAudit('USER_CREATED', req.user, { username, role }, getClientIP(req));
    res.json({ id, username, role, name });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/users/:id/password', requireRole('admin'), async (req, res) => {
  try {
    const password = sanitizeStr(req.body?.password, 200);
    if (!password || password.length < 6) return res.status(400).json({ error: 'Parol kamida 6 belgi' });
    const hash = await hashPassword(password);
    const r = await pool.query(`UPDATE users SET password = $1, must_change_pwd = FALSE WHERE id = $2`, [hash, req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'Topilmadi' });
    // Bu userning barcha sessionlarini bekor qilish
    await pool.query(`DELETE FROM sessions WHERE (user_data->>'id') = $1`, [req.params.id]);
    await appendAudit('USER_PASSWORD_CHANGED', req.user, { id: req.params.id }, getClientIP(req));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/users/:id', requireRole('admin'), async (req, res) => {
  try {
    const sel = await pool.query(`SELECT username FROM users WHERE id = $1`, [req.params.id]);
    if (!sel.rows.length) return res.status(404).json({ error: 'Topilmadi' });
    if (sel.rows[0].username === 'admin') return res.status(400).json({ error: 'Admin o\'chirilmaydi' });
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'O\'zingizni o\'chira olmaysiz' });
    await pool.query(`DELETE FROM users WHERE id = $1`, [req.params.id]);
    await pool.query(`DELETE FROM sessions WHERE (user_data->>'id') = $1`, [req.params.id]);
    await appendAudit('USER_DELETED', req.user, { id: req.params.id }, getClientIP(req));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/audit-logs', requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM audit_logs ORDER BY at DESC LIMIT 300`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ============== HEALTH ==============
app.get('/health', async (req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true, env: NODE_ENV }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

function attachFrontendRoutes() {
  const webOutDir = path.join(__dirname, '..', 'frontend', 'out');
  const hasExport = fs.existsSync(path.join(webOutDir, 'index.html'));
  const mode = process.env.FRONTEND_MODE || '';

  const useProxy = mode === 'proxy';
  // frontend/out mavjud bo'lsa NODE_ENV tekshirmasdan UI beramiz (Render'da NODE_ENV ba'zan noto‘g‘ri bo‘lishi mumkin)
  const useExportBundle =
    hasExport &&
    mode !== 'proxy' &&
    mode !== 'splash' &&
    (mode === 'export' || mode === '' || mode === 'auto');

  if (useProxy) {
    try {
      const { createProxyMiddleware } = require('http-proxy-middleware');
      const target = process.env.FRONTEND_PROXY_TARGET || 'http://127.0.0.1:3001';
      app.use(
        createProxyMiddleware({
          target,
          changeOrigin: true,
          ws: true,
          pathFilter: (pathname) => pathname !== '/health' && !pathname.startsWith('/api'),
        })
      );
      console.log('[frontend] FRONTEND_MODE=proxy → ' + target);
    } catch (e) {
      console.warn('[frontend] http-proxy-middleware topilmadi, splash rejimi. npm install qiling:', e.message);
      mountSplashOrPublicFallback();
    }
    return;
  }

  if (useExportBundle) {
    app.use(express.static(webOutDir, { maxAge: IS_PROD ? '7d' : 0 }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
      res.sendFile(path.join(webOutDir, 'index.html'));
    });
    console.log('[frontend] Next.js static export: ' + webOutDir);
    return;
  }

  if (IS_PROD && !hasExport && mode !== 'proxy' && mode !== 'splash') {
    console.warn(
      '[frontend] PRODUCTION: frontend/out mavjud emas. `npm run build` (ildiz) yoki FRONTEND_MODE=proxy bilan Next ishga tushiring.'
    );
  }
  mountSplashOrPublicFallback();
}

function mountSplashOrPublicFallback() {
  const publicDir = path.join(__dirname, 'public');
  app.use(express.static(publicDir, { maxAge: IS_PROD ? '7d' : 0 }));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(publicDir, 'index.html'));
  });
  console.log('[frontend] public/ (splash rejimi)');
}

attachFrontendRoutes();

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: IS_PROD ? 'Server xatosi' : err.message });
});

(async () => {
  try {
    await initDB()


    app.listen(PORT, '0.0.0.0', () => {
      console.log('====================================');
      console.log('  AND BILLUR TEXTILE Box Sistema v3');
      console.log('  Env:    ' + NODE_ENV);
      console.log('  Port:   ' + PORT);
      console.log('  Origin: ' + (IS_PROD ? ALLOWED_ORIGINS.join(', ') : 'any'));
      console.log('  Default: admin / admin123');
      console.log('====================================');
    });
  } catch (e) {
    console.error('❌ Server boshlanmadi:', e);
    process.exit(1);
  }
})();
