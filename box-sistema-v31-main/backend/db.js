// db.js — PostgreSQL ulanish va scrypt parol himoyasi (qo'shimcha paket kerakmas)
const { Pool } = require('pg');
const crypto = require('crypto');
const { promisify } = require('util');
const scryptAsync = promisify(crypto.scrypt);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL env o\'zgaruvchisi topilmadi!');
  console.error('   Render: Postgres ulansa avtomatik beriladi.');
  console.error('   Lokal: export DATABASE_URL=postgres://user:pass@localhost:5432/box');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

pool.on('error', (err) => console.error('Postgres pool xatosi:', err));

// ============= PAROL HIMOYASI (scrypt) =============
// Format: "scrypt:<salt-hex>:<hash-hex>"
const SCRYPT_KEYLEN = 64;

async function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = (await scryptAsync(String(plain), salt, SCRYPT_KEYLEN)).toString('hex');
  return 'scrypt:' + salt + ':' + hash;
}

async function verifyPassword(plain, stored) {
  if (!stored || !plain) return false;
  // Yangi format: scrypt
  if (typeof stored === 'string' && stored.startsWith('scrypt:')) {
    const parts = stored.split(':');
    if (parts.length !== 3) return false;
    const [, salt, hashHex] = parts;
    try {
      const test = await scryptAsync(String(plain), salt, SCRYPT_KEYLEN);
      const stor = Buffer.from(hashHex, 'hex');
      if (stor.length !== test.length) return false;
      return crypto.timingSafeEqual(stor, test);
    } catch { return false; }
  }
  // Eski format (sha256 + 'billur2024') — backward compat
  const legacy = crypto.createHash('sha256').update(String(plain) + 'billur2024').digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(legacy, 'hex'), Buffer.from(stored, 'hex'));
  } catch { return false; }
}

function isLegacyHash(stored) {
  return !stored || typeof stored !== 'string' || !stored.startsWith('scrypt:');
}

// ============= INITIALIZE =============
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 🔥 LOGIN ATTEMPTS TABLE
      await pool.query(`
          CREATE TABLE IF NOT EXISTS login_attempts (
                id SERIAL PRIMARY KEY,
                      ip TEXT,
                            username TEXT,
                                  success BOOLEAN,
                                        at TIMESTAMP DEFAULT NOW()
                                            )
                                              `);


 

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          TEXT PRIMARY KEY,
        username    TEXT UNIQUE NOT NULL,
        password    TEXT NOT NULL,
        role        TEXT NOT NULL CHECK (role IN ('admin','storekeeper','worker')),
        name        TEXT NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id          TEXT PRIMARY KEY,
        model       TEXT NOT NULL,
        color       TEXT NOT NULL,
        barcode     TEXT UNIQUE,
        total       INTEGER NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(model, color)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS boxes (
        uid             TEXT PRIMARY KEY,
        box_num         TEXT NOT NULL,
        zakaz           TEXT NOT NULL,
        type            TEXT NOT NULL CHECK (type IN ('simple','mix')),
        kg              NUMERIC(8,2) DEFAULT 0,
        status          TEXT NOT NULL CHECK (status IN ('packed','warehouse','shipping','shipped')),
        model           TEXT,
        color           TEXT,
        sizes           JSONB,
        items           JSONB,
        created_by      TEXT,
        created_by_name TEXT,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        created_date    DATE,
        updated_at      TIMESTAMPTZ,
        status_history  JSONB DEFAULT '[]'::jsonb,
        UNIQUE(zakaz, box_num)
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_boxes_status ON boxes(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_boxes_zakaz ON boxes(zakaz);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_boxes_created_date ON boxes(created_date);`);

    await client.query(`
      ALTER TABLE boxes ADD COLUMN IF NOT EXISTS specification TEXT;
    `);
    await client.query(`
      ALTER TABLE boxes ADD COLUMN IF NOT EXISTS carton_size TEXT;
    `);
    await client.query(`
      ALTER TABLE boxes ADD COLUMN IF NOT EXISTS multipack TEXT;
    `);
    await client.query(`
      ALTER TABLE boxes ADD COLUMN IF NOT EXISTS gross_weight NUMERIC(10, 3);
    `);
    await client.query(`
      ALTER TABLE boxes ADD COLUMN IF NOT EXISTS tare_weight NUMERIC(10, 3);
    `);
    await client.query(`
      ALTER TABLE boxes ADD COLUMN IF NOT EXISTS warehouse_code TEXT;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS shipments (
        id              TEXT PRIMARY KEY,
        truck_info      TEXT,
        note            TEXT,
        status          TEXT NOT NULL CHECK (status IN ('open','closed')),
        box_uids        JSONB DEFAULT '[]'::jsonb,
        snapshot        JSONB,
        created_by      TEXT,
        created_by_name TEXT,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        closed_at       TIMESTAMPTZ,
        closed_by       TEXT
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        token       TEXT PRIMARY KEY,
        user_data   JSONB NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id          BIGSERIAL PRIMARY KEY,
        type        TEXT NOT NULL,
        by_user     TEXT,
        by_name     TEXT,
        details     JSONB,
        ip          TEXT,
        at          TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_chat_usage (
        id          BIGSERIAL PRIMARY KEY,
        user_id     TEXT,
        username    TEXT,
        role        TEXT,
        intent      TEXT,
        message     TEXT,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ai_chat_usage_day ON ai_chat_usage(created_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ai_chat_usage_user ON ai_chat_usage(user_id, created_at DESC);`);

    await pool.query(`
  ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_pwd BOOLEAN DEFAULT FALSE
`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_logs(at DESC);`);

    // Default admin (faqat birinchi marta — agar admin user yo'q bo'lsa)
    const { rows } = await client.query(`SELECT 1 FROM users WHERE username='admin' LIMIT 1`);
    if (rows.length === 0) {
      const hash = await hashPassword('admin123');
      await client.query(
        `INSERT INTO users (id, username, password, role, name) VALUES ($1,$2,$3,$4,$5)`,
        ['u-admin', 'admin', hash, 'admin', 'Administrator']
      );
      console.log('✅ Default admin yaratildi: admin / admin123');
      console.log('⚠️  XAVFSIZLIK: birinchi loginda parolni o\'zgartiring!');
    }

    await client.query('COMMIT');
    console.log('✅ DB schema tayyor');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();

    await pool.query(`
        ALTER TABLE sessions
          ADD COLUMN IF NOT EXISTS ip TEXT
          `);

          await pool.query(`
            ALTER TABLE sessions
              ADD COLUMN IF NOT EXISTS ua TEXT
              `);

              await pool.query(`
                ALTER TABLE sessions
                  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()
                  `);

                  await pool.query(`
                    ALTER TABLE sessions
                      ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP DEFAULT NOW()
                      `);
  }
}

module.exports = { pool, initDB, hashPassword, verifyPassword, isLegacyHash };
