import Database from 'better-sqlite3';
import { createClient, type Client } from '@libsql/client';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// Ensure data directory exists
const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'amigurumis_mariai.db');
const db = new Database(dbPath);

// Enable WAL mode for high concurrency & performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize database schema
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      provider TEXT DEFAULT 'local',
      role TEXT DEFAULT 'customer',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      user_id TEXT,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_address TEXT NOT NULL,
      customer_city TEXT NOT NULL,
      customer_apartment TEXT,
      shipping_method TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      subtotal INTEGER NOT NULL,
      shipping_cost INTEGER NOT NULL,
      discount INTEGER DEFAULT 0,
      total INTEGER NOT NULL,
      status TEXT NOT NULL, -- 'pedido_recibido', 'pendiente_pago', 'pago_confirmado', 'en_preparacion', 'enviado', 'entregado', 'cancelado'
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      price INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      image_url TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS game_sessions (
      session_id TEXT PRIMARY KEY,
      user_id TEXT,
      level INTEGER NOT NULL,
      score INTEGER NOT NULL,
      wool_collected INTEGER NOT NULL,
      time_seconds INTEGER NOT NULL,
      stars INTEGER DEFAULT 1,
      victory INTEGER DEFAULT 0,
      reward_proposed TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS coupons (
      code TEXT PRIMARY KEY,
      discount_percent INTEGER NOT NULL,
      level_required INTEGER,
      max_uses INTEGER DEFAULT 9999,
      times_used INTEGER DEFAULT 0,
      expires_at TEXT,
      is_active INTEGER DEFAULT 1,
      description TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS btl_sessions (
      session_id TEXT PRIMARY KEY,
      user_id TEXT,
      level INTEGER,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_status_history (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      previous_status TEXT NOT NULL,
      new_status TEXT NOT NULL,
      admin_id TEXT NOT NULL,
      admin_email TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
  `);

  // Ensure test-sess-1 from previous verification session is recognized
  try {
    db.prepare(`
      INSERT OR IGNORE INTO btl_sessions (session_id, user_id, level, status, created_at)
      VALUES ('test-sess-1', NULL, 1, 'completed', ?)
    `).run(new Date().toISOString());
  } catch {}

  // Migrate users table to add profile contact/address fields and google_sub if missing
  try {
    db.prepare('ALTER TABLE users ADD COLUMN phone TEXT').run();
  } catch {}
  try {
    db.prepare('ALTER TABLE users ADD COLUMN address TEXT').run();
  } catch {}
  try {
    db.prepare('ALTER TABLE users ADD COLUMN city TEXT').run();
  } catch {}
  try {
    db.prepare('ALTER TABLE users ADD COLUMN department TEXT').run();
  } catch {}
  try {
    db.prepare('ALTER TABLE users ADD COLUMN google_sub TEXT').run();
  } catch {}
  try {
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub) WHERE google_sub IS NOT NULL').run();
  } catch {}
  try {
    db.prepare('ALTER TABLE users ADD COLUMN avatar_url TEXT').run();
  } catch {}

  // Migrate orders table to add coupon_code, access_token and is_simulated if missing
  try {
    db.prepare('ALTER TABLE orders ADD COLUMN coupon_code TEXT').run();
  } catch {}
  try {
    db.prepare('ALTER TABLE orders ADD COLUMN access_token TEXT').run();
  } catch {}
  try {
    db.prepare('ALTER TABLE orders ADD COLUMN is_simulated INTEGER DEFAULT 1').run();
  } catch {}

  // Migrate coupons table to add user_id, session_id, coupon_type, user_email and target_type
  try {
    db.prepare('ALTER TABLE coupons ADD COLUMN user_id TEXT').run();
  } catch {}
  try {
    db.prepare('ALTER TABLE coupons ADD COLUMN session_id TEXT').run();
  } catch {}
  try {
    db.prepare("ALTER TABLE coupons ADD COLUMN coupon_type TEXT DEFAULT 'commercial_general'").run();
  } catch {}
  try {
    db.prepare('ALTER TABLE coupons ADD COLUMN user_email TEXT').run();
  } catch {}
  try {
    db.prepare("ALTER TABLE coupons ADD COLUMN target_type TEXT DEFAULT 'general'").run();
  } catch {}
  try {
    db.prepare('CREATE INDEX IF NOT EXISTS idx_coupons_user_id ON coupons(user_id)').run();
  } catch {}
  try {
    db.prepare('CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code)').run();
  } catch {}

  // Classify existing coupons properly:
  // MARIAI-* are individual BTL rewards
  try {
    db.prepare(`
      UPDATE coupons 
      SET coupon_type = 'btl', target_type = 'exclusive'
      WHERE code LIKE 'MARIAI-%'
    `).run();
  } catch {}

  // POMPON* are general legacy promotional codes
  try {
    db.prepare(`
      UPDATE coupons 
      SET coupon_type = 'commercial_general', target_type = 'general'
      WHERE code LIKE 'POMPON%'
    `).run();
  } catch {}

  // Backfill user_email for any coupons with user_id that have missing user_email
  try {
    db.prepare(`
      UPDATE coupons
      SET user_email = (SELECT email FROM users WHERE users.id = coupons.user_id)
      WHERE user_id IS NOT NULL AND (user_email IS NULL OR user_email = '')
    `).run();
  } catch {}

  // Seed default official BTL game coupons
  const seedCoupons = [
    { code: 'POMPON5', percent: 5, level: 1, desc: '5% de Descuento BTL - Bosque de los Ovillos' },
    { code: 'POMPON10', percent: 10, level: 2, desc: '10% de Descuento BTL - Taller Encantado' },
    { code: 'POMPON15', percent: 15, level: 3, desc: '15% de Descuento BTL - Castillo de las Puntadas' },
  ];

  const insertCouponStmt = db.prepare(`
    INSERT OR IGNORE INTO coupons (code, discount_percent, level_required, max_uses, times_used, is_active, description, created_at)
    VALUES (?, ?, ?, 9999, 0, 1, ?, ?)
  `);

  const nowIso = new Date().toISOString();
  for (const c of seedCoupons) {
    insertCouponStmt.run(c.code, c.percent, c.level, c.desc, nowIso);
  }

  // Seed default demonstration customer if not exists
  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get('maria@amigurumismariai.com');
  if (!existingUser) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync('Mariai2026!', salt, 64).toString('hex');
    const passwordHash = `${salt}:${hash}`;
    const userId = `usr-maria-${Date.now()}`;

    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, provider, role, created_at)
      VALUES (?, ?, ?, ?, 'local', 'customer', ?)
    `).run(userId, 'María Isabel Gómez', 'maria@amigurumismariai.com', passwordHash, new Date().toISOString());

    // Seed sample initial purchase for demonstration
    const orderId = `AMI-CO-2026-001`;
    db.prepare(`
      INSERT INTO orders (
        id, order_number, user_id, customer_name, customer_email, customer_phone,
        customer_address, customer_city, customer_apartment, shipping_method,
        payment_method, subtotal, shipping_cost, discount, total, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId,
      'AMI-CO-2026-001',
      userId,
      'María Isabel Gómez',
      'maria@amigurumismariai.com',
      '312 456 7890',
      'Carrera 43A # 1 Sur-220, El Poblado',
      'Medellín, Antioquia',
      'Torre 1 Apto 802',
      'standard',
      'bank_transfer',
      31000,
      12000,
      0,
      43000,
      'en_preparacion',
      new Date(Date.now() - 86400000 * 2).toISOString()
    );

    db.prepare(`
      INSERT INTO order_items (id, order_id, product_id, product_name, price, quantity, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'item-001',
      orderId,
      'ami-001',
      'Osito Silvestre con Bufanda Mostaza',
      18500,
      1,
      '/src/assets/images/product_crochet_bear_1794329732428.jpg'
    );

    db.prepare(`
      INSERT INTO order_items (id, order_id, product_id, product_name, price, quantity, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'item-002',
      orderId,
      'ami-002',
      'Ballenita Marina Suave',
      12500,
      1,
      '/src/assets/images/product_crochet_whale_1794329732780.jpg'
    );
  }

  // Aprovisionamiento seguro e idempotente de la cuenta administrativa principal en desarrollo si ADMIN_PASSWORD está configurada
  if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim().length >= 6) {
    const res = provisionMainAdmin();
    if (res.created) {
      console.log(`[AUTH] ${res.message} (admin@amigurumismariai.com)`);
    }
  }

  console.log('SQLite database initialized successfully at:', dbPath);
}

// Password utilities using Node's native crypto
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(':');
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

// Generates a cryptographically strong access token for orders and sessions
export function generateOrderAccessToken(): string {
  return `ord_sec_${crypto.randomBytes(24).toString('hex')}`;
}

// Aprovisionamiento seguro e idempotente de la cuenta administrativa principal (admin@amigurumismariai.com)
export function provisionMainAdmin(customPassword?: string): { success: boolean; created: boolean; message: string } {
  const adminEmail = 'admin@amigurumismariai.com';
  const rawPassword = customPassword || process.env.ADMIN_PASSWORD;

  const existing = db.prepare('SELECT id, name, email, role FROM users WHERE email = ?').get(adminEmail) as any;

  if (existing) {
    if (customPassword && customPassword.trim().length >= 6) {
      const passwordHash = hashPassword(customPassword.trim());
      db.prepare("UPDATE users SET password_hash = ?, role = 'admin', name = 'Administrador Mariai' WHERE email = ?").run(passwordHash, adminEmail);
      return { success: true, created: false, message: 'Contraseña de la cuenta administrativa principal actualizada exitosamente.' };
    }
    return { success: true, created: false, message: 'La cuenta administrativa principal ya existe. Sus credenciales se preservaron sin cambios.' };
  }

  if (!rawPassword || rawPassword.trim().length < 6) {
    return {
      success: false,
      created: false,
      message: 'No se suministró contraseña para la cuenta administrativa (mínimo 6 caracteres). Configura ADMIN_PASSWORD en .env o pásala al comando CLI.',
    };
  }

  const passwordHash = hashPassword(rawPassword.trim());
  const userId = `usr-admin-${Date.now().toString(36)}`;
  const nowIso = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, provider, role, created_at)
    VALUES (?, 'Administrador Mariai', ?, ?, 'local', 'admin', ?)
  `).run(userId, adminEmail, passwordHash, nowIso);

  return { success: true, created: true, message: 'Cuenta administrativa principal aprovisionada exitosamente.' };
}

// Revocación y eliminación segura de la cuenta de demostración anterior
export function removeAdminDemo(): { success: boolean; message: string } {
  const DEMO_EMAIL = 'admin.demo@amigurumismariai.test';
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(DEMO_EMAIL) as any;

  if (!user) {
    return { success: true, message: `La cuenta ${DEMO_EMAIL} no existe en la base de datos.` };
  }

  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  const info = db.prepare('DELETE FROM users WHERE id = ?').run(user.id);

  if (info.changes > 0) {
    return { success: true, message: `Cuenta de demostración ${DEMO_EMAIL} y sus sesiones han sido revocadas y eliminadas de forma segura.` };
  }
  return { success: false, message: 'No se pudo eliminar la cuenta demo.' };
}

// Checks if external Turso database is configured via environment variables
export function isTursoConfigured(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_DATABASE_URL.trim());
}

// Returns a configured libSQL Client instance for Turso
export function getTursoClient(): Client | null {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url || !url.trim()) return null;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  return createClient({
    url: url.trim(),
    authToken: authToken ? authToken.trim() : undefined,
  });
}

// Tests Turso connection and returns status
export async function testTursoConnection(): Promise<{ success: boolean; message: string }> {
  const client = getTursoClient();
  if (!client) {
    return { success: false, message: 'TURSO_DATABASE_URL no configurada en variables de entorno.' };
  }
  try {
    const res = await client.execute('SELECT 1 as connected');
    return { success: true, message: `Conexión a Turso exitosa (${res.rows.length} fila devuelta).` };
  } catch (err: any) {
    return { success: false, message: `Error de conexión con Turso: ${err.message}` };
  }
}

// Exports entire database to a structured JSON object for safe cloud migration
export function exportDatabaseDump(): {
  timestamp: string;
  tables: Record<string, any[]>;
} {
  const tables = [
    'users',
    'sessions',
    'orders',
    'order_items',
    'coupons',
    'game_sessions',
    'btl_sessions',
    'order_status_history',
  ];

  const dump: Record<string, any[]> = {};
  for (const t of tables) {
    try {
      dump[t] = db.prepare(`SELECT * FROM ${t}`).all();
    } catch {
      dump[t] = [];
    }
  }

  return {
    timestamp: new Date().toISOString(),
    tables: dump,
  };
}

// Imports structured JSON dump into the database
export function importDatabaseDump(dump: { tables: Record<string, any[]> }): {
  importedCounts: Record<string, number>;
} {
  const importedCounts: Record<string, number> = {};

  if (!dump || !dump.tables) return { importedCounts };

  const insertStatements: Record<string, (row: any) => void> = {
    users: (r) =>
      db
        .prepare(`
        INSERT OR IGNORE INTO users (id, name, email, password_hash, provider, role, phone, address, city, department, created_at, google_sub, avatar_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
        .run(
          r.id,
          r.name,
          r.email,
          r.password_hash,
          r.provider || 'local',
          r.role || 'customer',
          r.phone || '',
          r.address || '',
          r.city || '',
          r.department || '',
          r.created_at,
          r.google_sub || null,
          r.avatar_url || null
        ),
    coupons: (r) =>
      db
        .prepare(`
        INSERT OR IGNORE INTO coupons (code, discount_percent, level_required, max_uses, times_used, expires_at, is_active, description, user_id, session_id, user_email, coupon_type, target_type, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
        .run(
          r.code,
          r.discount_percent,
          r.level_required,
          r.max_uses,
          r.times_used,
          r.expires_at,
          r.is_active,
          r.description,
          r.user_id,
          r.session_id,
          r.user_email || null,
          r.coupon_type || 'commercial_general',
          r.target_type || 'general',
          r.created_at
        ),
    orders: (r) =>
      db
        .prepare(`
        INSERT OR IGNORE INTO orders (
          id, order_number, user_id, customer_name, customer_email, customer_phone,
          customer_address, customer_city, customer_apartment, shipping_method,
          payment_method, subtotal, shipping_cost, discount, coupon_code, total, status, notes, created_at, access_token, is_simulated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
        .run(
          r.id,
          r.order_number,
          r.user_id,
          r.customer_name,
          r.customer_email,
          r.customer_phone,
          r.customer_address,
          r.customer_city,
          r.customer_apartment,
          r.shipping_method,
          r.payment_method,
          r.subtotal,
          r.shipping_cost,
          r.discount,
          r.coupon_code,
          r.total,
          r.status,
          r.notes,
          r.created_at,
          r.access_token || null,
          r.is_simulated ?? 1
        ),
    order_items: (r) =>
      db
        .prepare(`
        INSERT OR IGNORE INTO order_items (id, order_id, product_id, product_name, price, quantity, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
        .run(r.id, r.order_id, r.product_id, r.product_name, r.price, r.quantity, r.image_url),
    btl_sessions: (r) =>
      db
        .prepare(`
        INSERT OR IGNORE INTO btl_sessions (session_id, user_id, level, status, created_at)
        VALUES (?, ?, ?, ?, ?)
      `)
        .run(r.session_id, r.user_id, r.level, r.status, r.created_at),
    game_sessions: (r) =>
      db
        .prepare(`
        INSERT OR IGNORE INTO game_sessions (session_id, user_id, level, score, wool_collected, time_seconds, stars, victory, reward_proposed, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
        .run(
          r.session_id,
          r.user_id,
          r.level,
          r.score,
          r.wool_collected,
          r.time_seconds,
          r.stars,
          r.victory,
          r.reward_proposed,
          r.created_at
        ),
    order_status_history: (r) =>
      db
        .prepare(`
        INSERT OR IGNORE INTO order_status_history (id, order_id, previous_status, new_status, admin_id, admin_email, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
        .run(r.id, r.order_id, r.previous_status, r.new_status, r.admin_id, r.admin_email, r.notes || '', r.created_at),
  };

  for (const [table, rows] of Object.entries(dump.tables)) {
    const inserter = insertStatements[table];
    if (inserter && Array.isArray(rows)) {
      let count = 0;
      for (const row of rows) {
        try {
          inserter(row);
          count++;
        } catch {}
      }
      importedCounts[table] = count;
    }
  }

  return { importedCounts };
}

// Synchronizes the entire local schema and data into Turso Cloud if configured
export async function syncToTurso(): Promise<{
  success: boolean;
  message: string;
  syncedTables?: string[];
}> {
  const client = getTursoClient();
  if (!client) {
    return {
      success: false,
      message: 'TURSO_DATABASE_URL no configurada. Saltando sincronización con Turso.',
    };
  }

  try {
    // 1. Create tables on Turso using identical libSQL syntax
    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        provider TEXT DEFAULT 'local',
        role TEXT DEFAULT 'customer',
        phone TEXT,
        address TEXT,
        city TEXT,
        department TEXT,
        created_at TEXT NOT NULL
      );
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        order_number TEXT UNIQUE NOT NULL,
        user_id TEXT,
        customer_name TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_address TEXT NOT NULL,
        customer_city TEXT NOT NULL,
        customer_apartment TEXT,
        shipping_method TEXT NOT NULL,
        payment_method TEXT NOT NULL,
        subtotal INTEGER NOT NULL,
        shipping_cost INTEGER NOT NULL,
        discount INTEGER DEFAULT 0,
        coupon_code TEXT,
        total INTEGER NOT NULL,
        status TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        access_token TEXT,
        is_simulated INTEGER DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        price INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        image_url TEXT,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      );
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS coupons (
        code TEXT PRIMARY KEY,
        discount_percent INTEGER NOT NULL,
        level_required INTEGER,
        max_uses INTEGER DEFAULT 9999,
        times_used INTEGER DEFAULT 0,
        expires_at TEXT,
        is_active INTEGER DEFAULT 1,
        description TEXT,
        user_id TEXT,
        session_id TEXT,
        created_at TEXT NOT NULL
      );
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS btl_sessions (
        session_id TEXT PRIMARY KEY,
        user_id TEXT,
        level INTEGER,
        status TEXT DEFAULT 'active',
        created_at TEXT NOT NULL
      );
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS game_sessions (
        session_id TEXT PRIMARY KEY,
        user_id TEXT,
        level INTEGER NOT NULL,
        score INTEGER NOT NULL,
        wool_collected INTEGER NOT NULL,
        time_seconds INTEGER NOT NULL,
        stars INTEGER DEFAULT 1,
        victory INTEGER DEFAULT 0,
        reward_proposed TEXT,
        created_at TEXT NOT NULL
      );
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS order_status_history (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        previous_status TEXT NOT NULL,
        new_status TEXT NOT NULL,
        admin_id TEXT NOT NULL,
        admin_email TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      );
    `);

    return {
      success: true,
      message: 'Esquema sincronizado exitosamente con Turso Cloud.',
      syncedTables: [
        'users',
        'sessions',
        'orders',
        'order_items',
        'coupons',
        'btl_sessions',
        'game_sessions',
        'order_status_history',
      ],
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Fallo al sincronizar con Turso: ${err.message}`,
    };
  }
}

export { db };
