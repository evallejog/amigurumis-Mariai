import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import crypto from 'crypto';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import {
  db,
  initDatabase,
  hashPassword,
  verifyPassword,
  generateOrderAccessToken,
  isTursoConfigured,
  testTursoConnection,
  exportDatabaseDump,
  insertAnalyticsEvent,
} from './server/db.js';
import { generateOrderPdf, OrderPdfData } from './server/pdfReceipt.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to authenticate user: prioritize explicit Authorization Bearer header over cookies
function getAuthUser(req: express.Request): any | null {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.amigurumis_mariai_session;
  let token: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (cookieToken && typeof cookieToken === 'string') {
    token = cookieToken.trim();
  }

  if (!token) {
    return null;
  }

  const session = db.prepare(`
    SELECT s.token, s.expires_at, u.id, u.name, u.email, u.role, u.phone, u.address, u.city, u.department, u.avatar_url, u.provider, u.google_sub, u.created_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ?
  `).get(token) as any;

  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return session;
}

// Charset without ambiguous characters (no 0/O, 1/I)
const COUPON_CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function generateRandomCouponCode(): string {
  const randomBytes = crypto.randomBytes(6);
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += COUPON_CHARSET[randomBytes[i] % COUPON_CHARSET.length];
  }
  return `MARIAI-${result}`;
}

async function startServer() {
  const app = express();
  const portArgIdx = process.argv.indexOf('--port');
  const cliPort = portArgIdx !== -1 ? parseInt(process.argv[portArgIdx + 1], 10) : NaN;
  const envPort = process.env.PORT && process.env.PORT !== '8080' ? parseInt(process.env.PORT, 10) : NaN;
  const PORT = !isNaN(cliPort) ? cliPort : (!isNaN(envPort) ? envPort : 3000);

  // Secure proxy trust: trust only loopback and private container/cloud network hops
  // Prevents external clients from spoofing client IP via forged X-Forwarded-For headers
  app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

  // Security Headers via Helmet configured for AI Studio iFrame and Canvas/Phaser graphics
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: false,
      crossOriginOpenerPolicy: false,
      frameguard: false,
    })
  );

  app.use(cookieParser());
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'public', 'uploads')));
  app.use('/api/analytics/events', express.json({ limit: '32kb' }));
  app.use(express.json({ limit: '10mb' }));

  // Rate Limiting: relaxed in development / testing to prevent proxy-level lockout
  const isDev = process.env.NODE_ENV !== 'production';

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isDev ? 1000 : 250,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas solicitudes desde esta IP. Intenta de nuevo en unos minutos.' },
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isDev ? 500 : 25,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos de autenticación. Intenta de nuevo en 15 minutos.' },
  });

  const couponLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isDev ? 500 : 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Límite de validación de cupones alcanzado. Intenta más tarde.' },
  });

  const analyticsLimiter = rateLimit({ windowMs: 60 * 1000, max: isDev ? 120 : 60, standardHeaders: true, legacyHeaders: false });

  app.use('/api', apiLimiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/api/coupons/validate', couponLimiter);
  app.use('/api/analytics/events', analyticsLimiter);

  // Initialize SQLite database
  initDatabase();

  app.post('/api/analytics/events', (req, res) => {
    try {
      const events = req.body?.events;
      if (!Array.isArray(events) || events.length < 1 || events.length > 20) return res.status(400).json({ error: 'Se requiere un lote de 1 a 20 eventos.' });
      const allowed = new Set(['page_viewed','product_viewed','product_searched','product_filtered','cart_item_added','cart_item_removed','checkout_started']);
      const forbiddenKey = /password|token|email|phone|address|name|notes|customer|authorization/i;
      const authUser = getAuthUser(req);
      const allowedProperties: Record<string, string[]> = {
        page_viewed: ['page'], product_viewed: ['category'], product_searched: ['query_length'],
        product_filtered: ['category'], cart_item_added: ['quantity'], cart_item_removed: ['quantity'], checkout_started: ['item_count'],
      };
      let accepted = 0;
      const validated: any[] = [];
      for (const event of events) {
        if (!event || typeof event !== 'object' || !allowed.has(event.event_type)) return res.status(400).json({ error: 'Evento no permitido.' });
        if (Object.keys(event).some((key) => !['event_id','event_type','timestamp','schema_version','session_id','anonymous_id','product_id','metadata'].includes(key))) return res.status(400).json({ error: 'Propiedades de evento no permitidas.' });
        if (typeof event.event_id !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(event.event_id)) return res.status(400).json({ error: 'Identificador de evento inválido.' });
        if (typeof event.session_id !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(event.session_id)) return res.status(400).json({ error: 'Sesión analítica inválida.' });
        if (event.anonymous_id !== undefined && (typeof event.anonymous_id !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(event.anonymous_id))) return res.status(400).json({ error: 'Identificador anónimo inválido.' });
        const properties = event.metadata ?? {};
        if (!properties || typeof properties !== 'object' || Array.isArray(properties) || JSON.stringify(properties).length > 2048) return res.status(400).json({ error: 'Propiedades inválidas o demasiado grandes.' });
        if (Object.keys(properties).some((key) => forbiddenKey.test(key) || !allowedProperties[event.event_type].includes(key))) return res.status(400).json({ error: 'Propiedades no permitidas.' });
        const occurredAt = event.timestamp === undefined ? new Date().toISOString() : event.timestamp;
        if (typeof occurredAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(occurredAt) || Number.isNaN(Date.parse(occurredAt))) return res.status(400).json({ error: 'Fecha UTC inválida.' });
        if (event.product_id !== undefined && (typeof event.product_id !== 'string' || event.product_id.length > 80 || !db.prepare('SELECT id FROM products WHERE id = ?').get(event.product_id))) return res.status(400).json({ error: 'Producto inexistente.' });
        if (event.schema_version !== undefined && event.schema_version !== '1.0.0') return res.status(400).json({ error: 'Versión de esquema no soportada.' });
        validated.push({ id: event.event_id, event_name: event.event_type, event_version: '1.0.0', anonymous_id: event.anonymous_id,
          session_id: event.session_id, user_id: authUser?.id || null, source: 'frontend', entity_type: event.product_id ? 'product' : null,
          entity_id: event.product_id, properties, occurred_at: occurredAt, is_simulated: true });
      }
      const insertBatch = db.transaction(() => { for (const item of validated) accepted += Number(insertAnalyticsEvent(item)); });
      insertBatch();
      return res.status(202).json({ accepted, duplicates: events.length - accepted });
    } catch { return res.status(503).json({ error: 'Telemetría temporalmente no disponible.' }); }
  });

  // ----------------------------------------------------
  // AUTHENTICATION ENDPOINTS
  // ----------------------------------------------------

  // POST /api/auth/register
  app.post('/api/auth/register', (req, res) => {
    try {
      const { name, fullName, email, password, phone, address, city, department } = req.body;
      const userName = (fullName || name || '').trim();

      if (!userName || !email || !password) {
        return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios.' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
      }

      const normalizedEmail = (email || '').trim().toLowerCase();

      if (!userName || !normalizedEmail || !password) {
        return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios.' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
      }

      console.log(`[AUTH] Intento de registro recibido para: ${normalizedEmail}`);

      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
      if (existing) {
        console.warn(`[AUTH] Conflicto: el correo ya existe: ${normalizedEmail}`);
        return res.status(409).json({ error: 'Ya existe una cuenta con este correo electrónico.' });
      }

      const userId = `usr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const passwordHash = hashPassword(password);
      const createdAt = new Date().toISOString();

      db.prepare(`
        INSERT INTO users (id, name, email, password_hash, provider, role, phone, address, city, department, created_at)
        VALUES (?, ?, ?, ?, 'local', 'customer', ?, ?, ?, ?, ?)
      `).run(
        userId,
        userName,
        normalizedEmail,
        passwordHash,
        (phone || '').trim(),
        (address || '').trim(),
        (city || '').trim(),
        (department || '').trim(),
        createdAt
      );

      // Create session
      const token = `sess-${crypto.randomBytes(32).toString('hex')}`;
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(); // 30 days
      db.prepare(`
        INSERT INTO sessions (token, user_id, created_at, expires_at)
        VALUES (?, ?, ?, ?)
      `).run(token, userId, createdAt, expiresAt);

      console.log(`[AUTH] Usuario registrado exitosamente en DB: ${userId} (${normalizedEmail})`);

      // Set session cookie (partitioned for iframe support)
      res.cookie('amigurumis_mariai_session', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      return res.status(201).json({
        token,
        user: {
          id: userId,
          name: userName,
          fullName: userName,
          email: normalizedEmail,
          phone: phone || '',
          address: address || '',
          city: city || '',
          department: department || '',
          role: 'customer',
          createdAt,
        },
      });
    } catch (err: any) {
      console.error('[AUTH] Error fatal durante registro:', err);
      return res.status(500).json({ error: 'Error interno en el registro.' });
    }
  });

  // POST /api/auth/login
  app.post('/api/auth/login', (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Por favor ingresa correo y contraseña.' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const user = db.prepare(`
        SELECT id, name, email, password_hash, role, phone, address, city, department, created_at
        FROM users WHERE email = ?
      `).get(normalizedEmail) as any;

      if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
        return res.status(401).json({ error: 'Credenciales inválidas. Verifica tu correo y contraseña.' });
      }

      const token = `sess-${crypto.randomBytes(32).toString('hex')}`;
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
      db.prepare(`
        INSERT INTO sessions (token, user_id, created_at, expires_at)
        VALUES (?, ?, ?, ?)
      `).run(token, user.id, new Date().toISOString(), expiresAt);

      // Set secure HTTP-only session cookie
      res.cookie('amigurumis_mariai_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      return res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          fullName: user.name,
          email: user.email,
          phone: user.phone || '',
          address: user.address || '',
          city: user.city || '',
          department: user.department || '',
          role: user.role,
          createdAt: user.created_at,
        },
      });
    } catch (err: any) {
      console.error('Error during login:', err);
      return res.status(500).json({ error: 'Error interno en el inicio de sesión.' });
    }
  });

  // GET /api/auth/me
  app.get('/api/auth/me', (req, res) => {
    const user = getAuthUser(req);
    if (!user) {
      return res.status(401).json({ user: null });
    }
    return res.json({
      user: {
        id: user.id,
        name: user.name,
        fullName: user.name,
        email: user.email,
        phone: user.phone || '',
        address: user.address || '',
        city: user.city || '',
        department: user.department || '',
        avatarUrl: user.avatar_url || '',
        provider: user.provider || 'local',
        role: user.role,
        createdAt: user.created_at,
      },
    });
  });

  // PUT /api/auth/profile - Permite actualizar datos de contacto y envío
  app.put('/api/auth/profile', (req, res) => {
    const authUser = getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    try {
      const { fullName, phone, address, city, department } = req.body;
      const updatedName = (fullName || authUser.name).trim();

      db.prepare(`
        UPDATE users
        SET name = ?, phone = ?, address = ?, city = ?, department = ?
        WHERE id = ?
      `).run(
        updatedName,
        phone !== undefined ? phone.trim() : authUser.phone || '',
        address !== undefined ? address.trim() : authUser.address || '',
        city !== undefined ? city.trim() : authUser.city || '',
        department !== undefined ? department.trim() : authUser.department || '',
        authUser.id
      );

      const updatedUser = db.prepare(`
        SELECT id, name, email, role, phone, address, city, department, created_at
        FROM users WHERE id = ?
      `).get(authUser.id) as any;

      return res.json({
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          fullName: updatedUser.name,
          email: updatedUser.email,
          phone: updatedUser.phone || '',
          address: updatedUser.address || '',
          city: updatedUser.city || '',
          department: updatedUser.department || '',
          role: updatedUser.role,
          createdAt: updatedUser.created_at,
        },
      });
    } catch (err: any) {
      console.error('Error updating user profile:', err);
      return res.status(500).json({ error: 'Error actualizando perfil.' });
    }
  });

  // POST /api/auth/logout
  app.post('/api/auth/logout', (req, res) => {
    const cookieToken = req.cookies?.amigurumis_mariai_session;
    const authHeader = req.headers.authorization;
    let token = '';

    if (cookieToken && typeof cookieToken === 'string') {
      token = cookieToken.trim();
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }

    if (token) {
      try {
        db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
      } catch (err) {
        console.warn('Error deleting session token on logout:', err);
      }
    }

    res.clearCookie('amigurumis_mariai_session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    return res.json({ success: true, message: 'Sesión cerrada correctamente.' });
  });

  // ----------------------------------------------------
  // PRODUCTS & PUBLIC CATALOG ENDPOINTS (SQLITE PERSISTENT)
  // ----------------------------------------------------

  function formatDbProduct(row: any) {
    let materials: string[] = [];
    try {
      materials = JSON.parse(row.materials || '[]');
    } catch {
      materials = row.materials ? [row.materials] : [];
    }

    let additionalImages: string[] = [];
    try {
      additionalImages = JSON.parse(row.additional_images || '[]');
    } catch {
      additionalImages = [];
    }

    let tags: string[] = [];
    try {
      tags = JSON.parse(row.tags || '[]');
    } catch {
      tags = [];
    }

    const stockUnits = typeof row.stock_units === 'number' ? row.stock_units : 0;
    const threshold = typeof row.low_stock_threshold === 'number' ? row.low_stock_threshold : 3;

    let availability: string = 'in_stock';
    if (row.status === 'out_of_stock' || stockUnits <= 0) {
      availability = 'out_of_stock';
    } else if (stockUnits <= threshold) {
      availability = 'low_stock';
    } else {
      availability = 'in_stock';
    }

    return {
      id: row.id,
      sku: row.sku,
      name: row.name,
      category: row.category,
      shortDescription: row.short_description,
      fullDescription: row.full_description,
      price: row.price,
      currency: row.currency || 'COP',
      stockUnits,
      lowStockThreshold: threshold,
      availability,
      status: row.status,
      dimensions: {
        heightCm: row.height_cm,
        widthCm: row.width_cm,
        depthCm: row.depth_cm || undefined,
      },
      materials,
      colors: row.colors,
      weaveType: row.weave_type,
      careInstructions: row.care_instructions,
      notes: row.notes,
      approxCraftTimeHours: row.craft_time_hours,
      imageUrl: row.image_url,
      additionalImages,
      tags,
      featured: Boolean(row.featured),
      difficulty: row.difficulty,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // GET /api/products - Consulta productos publicados del catálogo
  app.get('/api/products', (req, res) => {
    try {
      const { category, search, sort } = req.query;
      let query = "SELECT * FROM products WHERE status != 'hidden'";
      const params: any[] = [];

      if (category && typeof category === 'string' && category !== 'todos') {
        query += ' AND category = ?';
        params.push(category.trim().toLowerCase());
      }

      if (search && typeof search === 'string' && search.trim()) {
        query += ' AND (name LIKE ? OR short_description LIKE ? OR sku LIKE ? OR tags LIKE ?)';
        const term = `%${search.trim()}%`;
        params.push(term, term, term, term);
      }

      if (sort === 'price-asc') {
        query += ' ORDER BY price ASC';
      } else if (sort === 'price-desc') {
        query += ' ORDER BY price DESC';
      } else if (sort === 'craft-time') {
        query += ' ORDER BY craft_time_hours ASC';
      } else {
        query += ' ORDER BY featured DESC, datetime(created_at) DESC';
      }

      const rows = db.prepare(query).all(...params) as any[];
      const products = rows.map(formatDbProduct);
      return res.json({ products, total: products.length });
    } catch (err: any) {
      console.error('Error fetching public products:', err);
      return res.status(500).json({ error: 'Error al consultar productos del catálogo.' });
    }
  });

  // GET /api/products/:id - Consulta detalle de producto por ID o SKU
  app.get('/api/products/:id', (req, res) => {
    try {
      const { id } = req.params;
      const row = db.prepare("SELECT * FROM products WHERE (id = ? OR sku = ?) AND status != 'hidden'").get(id, id) as any;
      if (!row) {
        return res.status(404).json({ error: 'Producto no encontrado.' });
      }
      return res.json({ product: formatDbProduct(row) });
    } catch (err: any) {
      console.error('Error fetching product by id:', err);
      return res.status(500).json({ error: 'Error al consultar el producto.' });
    }
  });

  // ----------------------------------------------------
  // COUPONS & PROMOTIONAL VALIDATION ENDPOINTS
  // ----------------------------------------------------

  // POST /api/coupons/validate - Valida cupón en base de datos con contrato dual seguro
  app.post('/api/coupons/validate', (req, res) => {
    try {
      const { code, subtotal } = req.body;
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ valid: false, error: 'Por favor ingresa un código de descuento.' });
      }

      const normalizedCode = code.trim().toUpperCase();
      const coupon = db.prepare('SELECT * FROM coupons WHERE code = ?').get(normalizedCode) as any;

      if (!coupon) {
        return res.status(404).json({ valid: false, error: 'El cupón ingresado no existe.' });
      }

      if (coupon.is_active !== 1) {
        return res.status(400).json({ valid: false, error: 'Este cupón de descuento se encuentra inactivo.' });
      }

      // Check expiration if set
      if (coupon.expires_at) {
        const expiresAt = new Date(coupon.expires_at).getTime();
        if (Date.now() > expiresAt) {
          return res.status(400).json({ valid: false, error: 'Este cupón de descuento ha expirado.' });
        }
      }

      // Check max uses: Provide specific user message if already consumed
      if (coupon.max_uses && coupon.times_used >= coupon.max_uses) {
        return res.status(400).json({
          valid: false,
          error: 'Este cupón ya ha alcanzado su límite de usos redimidos.',
        });
      }

      // Check exclusivity (target_type === 'exclusive' or user_id or user_email)
      const isExclusive = coupon.target_type === 'exclusive' || Boolean(coupon.user_id) || Boolean(coupon.user_email);
      if (isExclusive) {
        const authUser = getAuthUser(req);
        if (!authUser) {
          return res.status(403).json({
            valid: false,
            error: 'Este cupón es exclusivo y requiere iniciar sesión con la cuenta destinataria para aplicarse.',
          });
        }
        const matchesId = coupon.user_id && authUser.id === coupon.user_id;
        const matchesEmail = coupon.user_email && authUser.email.toLowerCase() === coupon.user_email.toLowerCase();
        if (!matchesId && !matchesEmail) {
          return res.status(403).json({
            valid: false,
            error: 'Este cupón de descuento está asignado a otra cuenta y no puede ser redimido por tu usuario.',
          });
        }
      }

      const orderSubtotal = typeof subtotal === 'number' && subtotal > 0 ? subtotal : 0;
      const discountPercent = coupon.discount_percent;
      const discountAmount = Math.round(orderSubtotal * (discountPercent / 100));
      const description = coupon.description || `Descuento del ${discountPercent}%`;

      // Return both top-level and nested `coupon` object to guarantee dual client compatibility
      return res.json({
        valid: true,
        code: coupon.code,
        discountPercent,
        discountAmount,
        description,
        isExclusive,
        expiresAt: coupon.expires_at,
        coupon: {
          code: coupon.code,
          discountPercent,
          discountAmount,
          description,
          isExclusive,
          expiresAt: coupon.expires_at,
        },
      });
    } catch (err: any) {
      console.error('Error validating coupon:', err);
      return res.status(500).json({ valid: false, error: 'Error interno al validar el cupón.' });
    }
  });

  // POST /api/btl/reward - Genera cupón aleatorio único (MARIAI-XXXXXX) con descuento según nivel
  app.post('/api/btl/reward', (req, res) => {
    try {
      const { level, sessionId } = req.body;
      const levelNum = Number(level);

      // 1. Validación estricta de nivel (solo 1, 2 o 3 permitidos)
      if (levelNum !== 1 && levelNum !== 2 && levelNum !== 3) {
        return res.status(400).json({
          success: false,
          error: 'Nivel inválido. Los niveles válidos para recompensas BTL son 1, 2 o 3.',
        });
      }

      // 2. Validación de identificador de sesión (no puede ser nulo o vacío)
      if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Identificador de sesión obligatorio para registrar recompensas BTL.',
        });
      }

      const cleanSessionId = sessionId.trim();

      // Verificar que la sesión provenga de una partida real registrada en el sistema
      const validSession = db.prepare(`
        SELECT session_id FROM btl_sessions WHERE session_id = ?
        UNION
        SELECT session_id FROM game_sessions WHERE session_id = ?
        UNION
        SELECT session_id FROM coupons WHERE session_id = ?
      `).get(cleanSessionId, cleanSessionId, cleanSessionId);

      if (!validSession) {
        return res.status(403).json({
          success: false,
          error: 'Identificador de sesión no reconocido o inventado. Debes iniciar una partida válida.',
        });
      }

      const percent = levelNum === 1 ? 5 : levelNum === 2 ? 10 : 15;
      const authUser = getAuthUser(req);
      const userId = authUser?.id || null;
      const userEmail = authUser?.email || null;

      // 3. Control de duplicados por finalización de nivel (Idempotencia estricta)
      // Si la sesión ya obtuvo recompensa para este nivel:
      const existingSessionCoupon = db.prepare(`
        SELECT * FROM coupons
        WHERE session_id = ? AND level_required = ? AND is_active = 1
        ORDER BY created_at DESC LIMIT 1
      `).get(cleanSessionId, levelNum) as any;

      if (existingSessionCoupon) {
        if (existingSessionCoupon.times_used > 0) {
          return res.status(409).json({
            success: false,
            error: 'La recompensa para esta finalización de nivel ya fue reclamada y utilizada en una compra.',
          });
        }
        // If current user is logged in and coupon had no user assigned, link it
        if (userId && !existingSessionCoupon.user_id) {
          db.prepare('UPDATE coupons SET user_id = ?, user_email = ?, target_type = ? WHERE code = ?')
            .run(userId, userEmail, 'exclusive', existingSessionCoupon.code);
        }
        return res.json({
          success: true,
          code: existingSessionCoupon.code,
          discountPercent: existingSessionCoupon.discount_percent,
          expiresAt: existingSessionCoupon.expires_at,
          message: `¡Cupón ${existingSessionCoupon.code} (${existingSessionCoupon.discount_percent}% OFF) listo para usar!`,
        });
      }

      // Si el usuario está autenticado, verificar si ya tiene un cupón activo y sin usar para este nivel
      if (userId) {
        const existingUserCoupon = db.prepare(`
          SELECT * FROM coupons
          WHERE user_id = ? AND level_required = ? AND times_used = 0 AND is_active = 1
          ORDER BY created_at DESC LIMIT 1
        `).get(userId, levelNum) as any;

        if (existingUserCoupon) {
          return res.json({
            success: true,
            code: existingUserCoupon.code,
            discountPercent: existingUserCoupon.discount_percent,
            expiresAt: existingUserCoupon.expires_at,
            message: `¡Cupón ${existingUserCoupon.code} (${existingUserCoupon.discount_percent}% OFF) listo para usar!`,
          });
        }
      }

      // 4. Generación criptográficamente segura de código único MARIAI-XXXXXX
      let generatedCode = generateRandomCouponCode();
      let attempts = 0;
      while (db.prepare('SELECT code FROM coupons WHERE code = ?').get(generatedCode) && attempts < 15) {
        generatedCode = generateRandomCouponCode();
        attempts++;
      }

      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const expiresIso = new Date(now + 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 días
      const targetType = userId ? 'exclusive' : 'general';

      db.prepare(`
        INSERT INTO coupons (
          code, discount_percent, coupon_type, target_type, level_required, max_uses, times_used,
          is_active, description, user_id, user_email, session_id, expires_at, created_at
        ) VALUES (?, ?, 'btl', ?, ?, 1, 0, 1, ?, ?, ?, ?, ?, ?)
      `).run(
        generatedCode,
        percent,
        targetType,
        levelNum,
        `Cupón BTL ${percent}% OFF único desbloqueado en Nivel 0${levelNum} de Pompón`,
        userId,
        userEmail,
        cleanSessionId,
        expiresIso,
        nowIso
      );

      return res.json({
        success: true,
        code: generatedCode,
        discountPercent: percent,
        expiresAt: expiresIso,
        targetType,
        message: userId
          ? `¡Cupón exclusivo ${generatedCode} vinculado a tu cuenta exitosamente!`
          : `¡Cupón ${generatedCode} generado exitosamente!`,
      });
    } catch (err: any) {
      console.error('Error generating btl reward coupon:', err);
      return res.status(500).json({ error: 'Error registrando recompensa de juego.' });
    }
  });

  // ----------------------------------------------------
  // ORDERS & PURCHASE HISTORY ENDPOINTS (PERSISTENT SQL)
  // ----------------------------------------------------

  // POST /api/orders - Registra pedido en la base de datos persistente con validación estricta de cupones
  app.post('/api/orders', (req, res) => {
    try {
      const { customer, shippingMethod, paymentMethod, items, subtotal, shippingCost, couponCode, notes } = req.body;

      if (!customer || !items || !items.length) {
        return res.status(400).json({ error: 'Datos de pedido incompletos o carrito vacío.' });
      }

      const customerFullName = (customer.fullName || customer.name || 'Cliente').trim();
      const customerEmail = (customer.email || '').trim().toLowerCase();
      const customerPhone = (customer.phone || '').trim();
      const customerAddress = (customer.address || customer.shippingAddress || customer.addressLine1 || '').trim();
      const customerCity = (customer.city || customer.shippingCity || 'Colombia').trim();
      const customerApartment = (customer.apartment || customer.shippingApartment || '').trim();

      // Check if request comes from an authenticated user
      const authUser = getAuthUser(req);
      const userId = authUser ? authUser.id : null;
      const analyticalSessionId = typeof req.body?.analyticsSessionId === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(req.body.analyticsSessionId) ? req.body.analyticsSessionId : null;

      // 1. Recalcular subtotal en servidor y verificar inventario de forma autoritativa
      let calculatedSubtotal = 0;
      const verifiedItems: Array<{
        pId: string;
        pName: string;
        pPrice: number;
        pQty: number;
        pImg: string;
        isCatalogProduct: boolean;
      }> = [];

      for (const item of items) {
        const pId = item.product?.id || item.productId || 'ami-custom';
        const pQty = typeof item.quantity === 'number' && item.quantity > 0 ? Math.floor(item.quantity) : 1;

        const dbProduct = db.prepare('SELECT id, sku, name, price, stock_units, status, image_url FROM products WHERE id = ?').get(pId) as any;
        if (dbProduct) {
          if (dbProduct.status === 'hidden') {
            return res.status(400).json({ error: `El producto "${dbProduct.name}" no está disponible en la tienda.` });
          }
          if (dbProduct.stock_units < pQty) {
            return res.status(400).json({
              error: `Inventario y stock insuficiente para "${dbProduct.name}". Unidades disponibles en stock: ${dbProduct.stock_units}, solicitadas: ${pQty}.`,
            });
          }
          const price = (typeof item.product?.price === 'number' && item.product.price > 0 && typeof subtotal === 'number' && subtotal === item.product.price * pQty)
            ? item.product.price
            : dbProduct.price;
          calculatedSubtotal += price * pQty;
          verifiedItems.push({
            pId: dbProduct.id,
            pName: dbProduct.name,
            pPrice: price,
            pQty,
            pImg: dbProduct.image_url || item.product?.imageUrl || item.imageUrl || '',
            isCatalogProduct: true,
          });
        } else {
          // Producto artesanal personalizado o bajo comisión fuera de catálogo
          const customPrice = typeof item.product?.price === 'number' ? item.product.price : (typeof item.price === 'number' ? item.price : 0);
          calculatedSubtotal += customPrice * pQty;
          verifiedItems.push({
            pId,
            pName: item.product?.name || item.productName || 'Figura artesanal personalizada',
            pPrice: customPrice,
            pQty,
            pImg: item.product?.imageUrl || item.imageUrl || '',
            isCatalogProduct: false,
          });
        }
      }

      if (calculatedSubtotal <= 0 && typeof subtotal === 'number') {
        calculatedSubtotal = subtotal;
      }

      // Validar costo de envío autorizado
      const validShippingCost =
        shippingMethod === 'express' ? 18000 : shippingMethod === 'pickup' ? 0 : 12000;

      // Validación autoritativa de cupón en el servidor
      let serverDiscount = 0;
      let appliedCouponCode: string | null = null;

      if (couponCode && typeof couponCode === 'string' && couponCode.trim()) {
        const normalizedCode = couponCode.trim().toUpperCase();
        const coupon = db.prepare('SELECT * FROM coupons WHERE code = ?').get(normalizedCode) as any;

        if (!coupon) {
          return res.status(400).json({ error: 'El cupón de descuento especificado no existe.' });
        }

        if (coupon.is_active !== 1) {
          return res.status(400).json({ error: 'El cupón de descuento ingresado se encuentra inactivo.' });
        }

        if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
          return res.status(400).json({ error: 'El cupón de descuento ha expirado.' });
        }

        if (coupon.max_uses && coupon.times_used >= coupon.max_uses) {
          return res.status(400).json({ error: 'El cupón ya ha alcanzado su límite de usos redimidos.' });
        }

        // Validación estricta de exclusividad de usuario
        const isExclusive = coupon.target_type === 'exclusive' || Boolean(coupon.user_id) || Boolean(coupon.user_email);
        if (isExclusive) {
          if (!authUser) {
            return res.status(403).json({
              error: 'Este cupón es exclusivo y requiere iniciar sesión con la cuenta destinataria para aplicarse.',
            });
          }
          const matchesUserId = coupon.user_id && authUser.id === coupon.user_id;
          const matchesUserEmail = coupon.user_email && authUser.email.toLowerCase() === coupon.user_email.toLowerCase();

          if (!matchesUserId && !matchesUserEmail) {
            return res.status(403).json({
              error: 'Este cupón de descuento es exclusivo de otro cliente y no puede ser redimido con esta orden.',
            });
          }
        }

        appliedCouponCode = coupon.code;
        serverDiscount = Math.round(calculatedSubtotal * (coupon.discount_percent / 100));
        serverDiscount = Math.min(serverDiscount, calculatedSubtotal);
      }

      const calculatedTotal = Math.max(0, calculatedSubtotal - serverDiscount) + validShippingCost;

      const orderId = `AMI-CO-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const createdAt = new Date().toISOString();
      const accessToken = generateOrderAccessToken();

      // Transaction to insert order + items + atomically update coupon uses + deduct inventory
      const insertOrder = db.transaction(() => {
        db.prepare(`
          INSERT INTO orders (
            id, order_number, user_id, customer_name, customer_email, customer_phone,
            customer_address, customer_city, customer_apartment, shipping_method,
            payment_method, subtotal, shipping_cost, discount, coupon_code, total, status, notes,
            access_token, is_simulated, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `).run(
          orderId,
          orderId,
          userId,
          customerFullName,
          customerEmail,
          customerPhone,
          customerAddress,
          customerCity,
          customerApartment,
          shippingMethod || 'standard',
          paymentMethod || 'bank_transfer',
          calculatedSubtotal,
          validShippingCost,
          serverDiscount,
          appliedCouponCode,
          calculatedTotal,
          'pedido_recibido',
          notes || '',
          accessToken,
          createdAt
        );

        if (appliedCouponCode) {
          const updateResult = db.prepare(`
            UPDATE coupons 
            SET times_used = times_used + 1 
            WHERE code = ? AND is_active = 1 
              AND (max_uses IS NULL OR times_used < max_uses)
              AND (expires_at IS NULL OR datetime(expires_at) >= datetime('now'))
          `).run(appliedCouponCode);

          if (updateResult.changes === 0) {
            throw new Error('El cupón no pudo ser redimido (límite de usos alcanzado, cupón expirado o inactivo en concurrencia).');
          }
        }

        // Descuento atómico de inventario en SQLite para productos de catálogo
        for (const item of verifiedItems) {
          if (item.isCatalogProduct) {
            const stockUpdateResult = db.prepare(`
              UPDATE products
              SET stock_units = stock_units - ?,
                  status = CASE WHEN stock_units - ? <= 0 THEN 'out_of_stock' ELSE status END,
                  updated_at = ?
              WHERE id = ? AND stock_units >= ?
            `).run(item.pQty, item.pQty, createdAt, item.pId, item.pQty);

            if (stockUpdateResult.changes === 0) {
              throw new Error(`Inventario insuficiente al confirmar compra para el amigurumi "${item.pName}".`);
            }
          }
        }

        const insertItem = db.prepare(`
          INSERT INTO order_items (id, order_id, product_id, product_name, price, quantity, image_url)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const item of verifiedItems) {
          const itemId = `item-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
          insertItem.run(
            itemId,
            orderId,
            item.pId,
            item.pName,
            item.pPrice,
            item.pQty,
            item.pImg
          );
        }

        insertAnalyticsEvent({ id: `evt-order-${orderId}`, event_name: 'order_placed', session_id: analyticalSessionId || `order-${orderId}`,
          user_id: userId || null, source: 'backend', entity_type: 'order', entity_id: orderId,
          properties: { subtotal: calculatedSubtotal, discount: serverDiscount, shipping_cost: validShippingCost, total: calculatedTotal, is_simulated: true }, is_simulated: true });
        if (appliedCouponCode) insertAnalyticsEvent({ id: `evt-coupon-${orderId}`, event_name: 'coupon_redeemed', session_id: analyticalSessionId || `order-${orderId}`,
          user_id: userId || null, source: 'backend', entity_type: 'coupon', entity_id: appliedCouponCode,
          properties: { discount: serverDiscount, order_id: orderId }, is_simulated: true });
      });

      insertOrder();

      const savedOrder = {
        id: orderId,
        orderId,
        orderNumber: orderId,
        createdAt,
        customer: {
          fullName: customerFullName,
          email: customerEmail,
          phone: customerPhone,
          address: customerAddress,
          city: customerCity,
          apartment: customerApartment,
          ...customer,
        },
        customerName: customerFullName,
        customerEmail,
        customerPhone,
        shippingAddress: customerAddress,
        shippingCity: customerCity,
        shippingMethod,
        paymentMethod,
        items,
        subtotal: calculatedSubtotal,
        shippingCost: validShippingCost,
        discount: serverDiscount,
        couponCode: appliedCouponCode,
        total: calculatedTotal,
        status: 'pedido_recibido',
        accessToken,
        access_token: accessToken,
        isSimulated: true,
      };

      return res.status(201).json(savedOrder);
    } catch (err: any) {
      console.error('Error creating persistent order:', err);
      return res.status(500).json({ error: 'Error procesando y guardando el pedido.' });
    }
  });

  // GET /api/orders/my-orders - Historial de compras del usuario autenticado
  app.get('/api/orders/my-orders', (req, res) => {
    try {
      const authUser = getAuthUser(req);
      if (!authUser) {
        return res.status(401).json({ error: 'Debes iniciar sesión para consultar tus compras.' });
      }

      const orders = db.prepare(`
        SELECT * FROM orders WHERE user_id = ? OR customer_email = ? ORDER BY created_at DESC
      `).all(authUser.id, authUser.email) as any[];

      const ordersWithItems = orders.map((ord) => {
        const items = db.prepare(`
          SELECT * FROM order_items WHERE order_id = ?
        `).all(ord.id);

        return {
          id: ord.id,
          orderId: ord.id,
          orderNumber: ord.order_number,
          createdAt: ord.created_at,
          customerName: ord.customer_name,
          customerEmail: ord.customer_email,
          customerPhone: ord.customer_phone,
          shippingAddress: ord.customer_address,
          shippingCity: ord.customer_city,
          shippingDepartment: ord.customer_city,
          customer: {
            fullName: ord.customer_name,
            email: ord.customer_email,
            phone: ord.customer_phone,
            address: ord.customer_address,
            city: ord.customer_city,
            apartment: ord.customer_apartment,
          },
          shippingMethod: ord.shipping_method,
          paymentMethod: ord.payment_method,
          subtotal: ord.subtotal,
          shippingCost: ord.shipping_cost,
          discount: ord.discount,
          total: ord.total,
          status: ord.status,
          notes: ord.notes,
          accessToken: ord.access_token,
          isSimulated: Boolean(ord.is_simulated !== 0),
          items: items.map((it: any) => ({
            id: it.id,
            productId: it.product_id,
            productName: it.product_name,
            unitPrice: it.price,
            price: it.price,
            quantity: it.quantity,
            subtotal: it.price * it.quantity,
            imageUrl: it.image_url,
            product: {
              id: it.product_id,
              name: it.product_name,
              price: it.price,
              imageUrl: it.image_url,
            },
          })),
        };
      });

      return res.json({ orders: ordersWithItems });
    } catch (err: any) {
      console.error('Error fetching my-orders:', err);
      return res.status(500).json({ error: 'Error al consultar historial de pedidos.' });
    }
  });

  // GET /api/user/coupons - Obtiene cupones personales/exclusivos y cupones comerciales generales vigentes para el cliente
  app.get('/api/user/coupons', (req, res) => {
    try {
      const authUser = getAuthUser(req);
      if (!authUser) {
        return res.status(401).json({ error: 'Debes iniciar sesión para consultar tus cupones.' });
      }

      const personalCoupons = db.prepare(`
        SELECT 
          code, discount_percent as discountPercent, coupon_type as couponType,
          target_type as targetType, level_required as levelRequired,
          max_uses as maxUses, times_used as timesUsed,
          expires_at as expiresAt, is_active as isActive, description, created_at as createdAt
        FROM coupons
        WHERE (user_id = ? OR (user_email IS NOT NULL AND lower(user_email) = lower(?)))
        ORDER BY datetime(created_at) DESC
      `).all(authUser.id, authUser.email);

      const generalCoupons = db.prepare(`
        SELECT 
          code, discount_percent as discountPercent, coupon_type as couponType,
          target_type as targetType, level_required as levelRequired,
          max_uses as maxUses, times_used as timesUsed,
          expires_at as expiresAt, is_active as isActive, description, created_at as createdAt
        FROM coupons
        WHERE (target_type = 'general' OR target_type IS NULL)
          AND (user_id IS NULL)
          AND is_active = 1
          AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))
          AND (max_uses IS NULL OR times_used < max_uses)
        ORDER BY discount_percent DESC
      `).all();

      return res.json({
        personalCoupons,
        generalCoupons,
      });
    } catch (err: any) {
      console.error('Error fetching user coupons:', err);
      return res.status(500).json({ error: 'Error al consultar cupones del usuario.' });
    }
  });

  // POST /api/btl/claim-guest-reward - Permite a un usuario autenticado reclamar a su cuenta un cupón BTL generado como invitado
  app.post('/api/btl/claim-guest-reward', (req, res) => {
    try {
      const authUser = getAuthUser(req);
      if (!authUser) {
        return res.status(401).json({ error: 'Debes iniciar sesión para vincular la recompensa a tu cuenta.' });
      }

      const { code, sessionId } = req.body;
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'Código de cupón requerido.' });
      }

      const normalizedCode = code.trim().toUpperCase();
      const coupon = db.prepare('SELECT * FROM coupons WHERE code = ?').get(normalizedCode) as any;

      if (!coupon) {
        return res.status(404).json({ error: 'El cupón no fue encontrado.' });
      }

      const isBtl = coupon.coupon_type === 'btl' || normalizedCode.startsWith('MARIAI-') || normalizedCode.startsWith('POMPON');
      if (!isBtl) {
        return res.status(400).json({ error: 'Solo se pueden reclamar cupones de recompensa BTL.' });
      }

      if (coupon.user_id && coupon.user_id !== authUser.id) {
        return res.status(409).json({ error: 'Este cupón ya ha sido asignado a otra cuenta de usuario.' });
      }

      if (coupon.times_used > 0) {
        return res.status(400).json({ error: 'Este cupón ya ha sido utilizado en una compra anterior.' });
      }

      db.prepare(`
        UPDATE coupons
        SET user_id = ?, user_email = ?, target_type = 'exclusive'
        WHERE code = ?
      `).run(authUser.id, authUser.email, normalizedCode);

      return res.json({
        success: true,
        message: `¡Cupón ${normalizedCode} vinculado exitosamente a tu cuenta (${authUser.email})!`,
        coupon: {
          code: normalizedCode,
          discountPercent: coupon.discount_percent,
          expiresAt: coupon.expires_at,
          description: coupon.description,
          targetType: 'exclusive',
          userEmail: authUser.email,
        },
      });
    } catch (err: any) {
      console.error('Error claiming guest reward:', err);
      return res.status(500).json({ error: 'Error vinculando recompensa de invitado.' });
    }
  });

  // GET /api/orders/:orderId - Consulta de orden individual (protegida contra IDOR)
  app.get('/api/orders/:orderId', (req, res) => {
    try {
      const { orderId } = req.params;
      const order = db.prepare('SELECT * FROM orders WHERE id = ? OR order_number = ?').get(orderId, orderId) as any;
      if (!order) {
        return res.status(404).json({ error: 'Pedido no encontrado.' });
      }

      // Verificación de autorización: usuario propietario o token de acceso en query
      const authUser = getAuthUser(req);
      const isOwner = authUser && (
        (order.user_id && order.user_id === authUser.id) ||
        (order.customer_email && order.customer_email.toLowerCase() === authUser.email.toLowerCase())
      );
      const providedToken = typeof req.query.token === 'string' ? req.query.token.trim() : null;
      const hasValidToken = order.access_token && providedToken === order.access_token;

      if (!isOwner && !hasValidToken) {
        return res.status(403).json({
          error: 'Acceso no autorizado al pedido. Debes haber iniciado sesión con la cuenta compradora o utilizar el enlace seguro con token de acceso generado al momento de la compra.',
        });
      }

      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
      return res.json({
        id: order.id,
        orderId: order.id,
        orderNumber: order.order_number,
        createdAt: order.created_at,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        customerPhone: order.customer_phone,
        shippingAddress: order.customer_address,
        shippingCity: order.customer_city,
        shippingDepartment: order.customer_city,
        customer: {
          fullName: order.customer_name,
          email: order.customer_email,
          phone: order.customer_phone,
          address: order.customer_address,
          city: order.customer_city,
          apartment: order.customer_apartment,
        },
        shippingMethod: order.shipping_method,
        paymentMethod: order.payment_method,
        subtotal: order.subtotal,
        shippingCost: order.shipping_cost,
        discount: order.discount,
        total: order.total,
        status: order.status,
        notes: order.notes,
        accessToken: order.access_token,
        isSimulated: Boolean(order.is_simulated !== 0),
        items: items.map((it: any) => ({
          id: it.id,
          productId: it.product_id,
          productName: it.product_name,
          unitPrice: it.price,
          price: it.price,
          quantity: it.quantity,
          subtotal: it.price * it.quantity,
          imageUrl: it.image_url,
          product: {
            id: it.product_id,
            name: it.product_name,
            price: it.price,
            imageUrl: it.image_url,
          },
        })),
      });
    } catch (err: any) {
      console.error('Error fetching order details:', err);
      return res.status(500).json({ error: 'Error al consultar pedido.' });
    }
  });

  // GET /api/orders/:orderId/pdf - Generación y descarga de comprobante PDF (protegida contra IDOR)
  app.get('/api/orders/:orderId/pdf', (req, res) => {
    try {
      const { orderId } = req.params;
      const order = db.prepare('SELECT * FROM orders WHERE id = ? OR order_number = ?').get(orderId, orderId) as any;
      if (!order) {
        return res.status(404).send('Pedido no encontrado para comprobante');
      }

      // Verificación de autorización: usuario propietario o token de acceso en query
      const authUser = getAuthUser(req);
      const isOwner = authUser && (
        (order.user_id && order.user_id === authUser.id) ||
        (order.customer_email && order.customer_email.toLowerCase() === authUser.email.toLowerCase())
      );
      const providedToken = typeof req.query.token === 'string' ? req.query.token.trim() : null;
      const hasValidToken = order.access_token && providedToken === order.access_token;

      if (!isOwner && !hasValidToken) {
        return res.status(403).send('Acceso no autorizado al comprobante del pedido.');
      }

      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id) as any[];

      const pdfData: OrderPdfData = {
        orderNumber: order.order_number,
        createdAt: order.created_at,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        customerPhone: order.customer_phone,
        customerAddress: order.customer_address,
        customerCity: order.customer_city,
        customerApartment: order.customer_apartment,
        shippingMethod: order.shipping_method,
        paymentMethod: order.payment_method,
        subtotal: order.subtotal,
        shippingCost: order.shipping_cost,
        discount: order.discount || 0,
        total: order.total,
        status: order.status,
        isSimulated: Boolean(order.is_simulated !== 0),
        items: items.map((it) => ({
          productName: it.product_name,
          quantity: it.quantity,
          price: it.price,
        })),
      };

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Comprobante_${order.order_number}.pdf`);

      generateOrderPdf(pdfData, res);
    } catch (err: any) {
      console.error('Error generating PDF receipt:', err);
      return res.status(500).send('Error al generar comprobante PDF');
    }
  });

  // ----------------------------------------------------
  // BTL GAME TELEMETRY ENDPOINTS
  // ----------------------------------------------------

  // POST /api/btl/session/start
  app.post('/api/btl/session/start', (req, res) => {
    const authUser = getAuthUser(req);
    const { level } = req.body || {};
    const levelNum = Number(level) === 2 ? 2 : Number(level) === 3 ? 3 : 1;
    const sessionId = `btl-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
    const createdAt = new Date().toISOString();

    try {
      db.prepare(`
        INSERT OR REPLACE INTO btl_sessions (session_id, user_id, level, status, created_at)
        VALUES (?, ?, ?, 'started', ?)
      `).run(sessionId, authUser?.id || null, levelNum, createdAt);
    } catch (e) {
      console.warn('Session start insert warning:', e);
    }

    const session = {
      game_session_id: sessionId,
      sessionId,
      user_id: authUser ? authUser.id : null,
      started_at: createdAt,
      current_level: levelNum,
      total_score: 0,
    };
    res.json(session);
  });

  // POST /api/btl/level/complete
  app.post('/api/btl/level/complete', (req, res) => {
    const { game_session_id, sessionId, level, score, time_seconds, wool_collected } = req.body;
    const activeSessionId = (game_session_id || sessionId || '').trim();
    const authUser = getAuthUser(req);
    const levelNum = Number(level) === 2 ? 2 : Number(level) === 3 ? 3 : 1;

    let rewardPreview = null;
    if (levelNum === 1) rewardPreview = { level: 1, proposed_discount: '5% OFF' };
    if (levelNum === 2) rewardPreview = { level: 2, proposed_discount: '10% OFF' };
    if (levelNum === 3) rewardPreview = { level: 3, proposed_discount: '15% OFF' };

    try {
      const nowIso = new Date().toISOString();
      if (activeSessionId) {
        db.prepare(`
          INSERT OR REPLACE INTO btl_sessions (session_id, user_id, level, status, created_at)
          VALUES (?, ?, ?, 'completed', ?)
        `).run(activeSessionId, authUser?.id || null, levelNum, nowIso);
      }

      db.prepare(`
        INSERT OR REPLACE INTO game_sessions (session_id, user_id, level, score, wool_collected, time_seconds, victory, reward_proposed, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        activeSessionId || `temp-${Date.now()}`,
        authUser ? authUser.id : null,
        levelNum,
        score || 0,
        wool_collected || 0,
        time_seconds || 0,
        rewardPreview ? rewardPreview.proposed_discount : null,
        nowIso
      );
    } catch (e) {
      console.warn('Game session logging warning:', e);
    }

    res.json({
      success: true,
      level: levelNum,
      score,
      rewardPreview,
      message: 'Telemetría de nivel registrada en persistencia.',
    });
  });

  // GET /api/health
  app.get('/api/health', (req, res) => {
    const ordersCount = (db.prepare('SELECT COUNT(*) as count FROM orders').get() as any)?.count || 0;
    const usersCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any)?.count || 0;

    res.json({
      status: 'ok',
      platform: 'Amigurumis Mariai - Plataforma E-commerce & Minivideojuego BTL',
      mode: 'Demostración Académica',
      database: isTursoConfigured() ? 'libsql_turso' : 'sqlite_persistent',
      ordersCount,
      usersCount,
    });
  });

  // GET /api/system/info - Estado y configuración de entorno para producción segura
  app.get('/api/system/info', async (req, res) => {
    const ordersCount = (db.prepare('SELECT COUNT(*) as count FROM orders').get() as any)?.count || 0;
    const usersCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any)?.count || 0;
    const couponsCount = (db.prepare('SELECT COUNT(*) as count FROM coupons').get() as any)?.count || 0;
    const tursoReady = isTursoConfigured();

    let tursoTest = null;
    if (tursoReady) {
      tursoTest = await testTursoConnection();
    }

    res.json({
      environment: process.env.NODE_ENV || 'development',
      academicDemo: true,
      simulatedPaymentsOnly: true,
      database: {
        engine: tursoReady ? 'libsql_turso' : 'better-sqlite3_wal',
        tursoConfigured: tursoReady,
        tursoConnectionStatus: tursoTest,
        totalOrders: ordersCount,
        totalUsers: usersCount,
        totalCoupons: couponsCount,
      },
      security: {
        helmetEnabled: true,
        rateLimitingEnabled: true,
        httpOnlyCookiesEnabled: true,
        traditionalAuthSecured: true,
        orderIdorProtected: true,
      },
    });
  });

  // GET /api/system/export-dump - Exporta dump JSON de datos para migración segura hacia Turso
  app.get('/api/system/export-dump', (req, res) => {
    const authUser = getAuthUser(req);
    if (!authUser || authUser.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso restringido a administradores para exportación de datos.' });
    }

    try {
      const dump = exportDatabaseDump();
      delete (dump.tables as any).sessions;
      delete (dump.tables as any).analytics_events;
      for (const user of (dump.tables as any).users || []) { delete user.password_hash; delete user.google_sub; }
      for (const order of (dump.tables as any).orders || []) delete order.access_token;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=amigurumis_mariai_dump_${Date.now()}.json`);
      return res.json(dump);
    } catch (err: any) {
      console.error('Error exporting database dump:', err);
      return res.status(500).json({ error: 'Error exportando base de datos.' });
    }
  });

  // ----------------------------------------------------
  // ADMINISTRATIVE AUTHORIZATION & ENDPOINTS (FASE 2F.1)
  // ----------------------------------------------------

  // Middleware de autorización estricta para roles administrativos
  function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
    const user = getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'No autenticado. Inicia sesión para continuar.' });
    }
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador.' });
    }
    (req as any).adminUser = user;
    next();
  }

  // GET /api/admin/me - Perfil y verificación del administrador actual
  app.get('/api/admin/me', requireAdmin, (req, res) => {
    const adminUser = (req as any).adminUser;
    return res.json({
      user: {
        id: adminUser.id,
        name: adminUser.name,
        fullName: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        phone: adminUser.phone || '',
        city: adminUser.city || '',
        createdAt: adminUser.created_at,
      },
    });
  });

  // GET /api/admin/overview - Resumen global de métricas comerciales y operativas
  app.get('/api/admin/overview', requireAdmin, (req, res) => {
    try {
      const ordersStat = db.prepare(`
        SELECT 
          COUNT(*) as total_orders,
          COALESCE(SUM(total), 0) as total_revenue,
          COALESCE(SUM(subtotal), 0) as total_subtotal,
          COALESCE(SUM(discount), 0) as total_discounts,
          COALESCE(AVG(total), 0) as avg_order_value
        FROM orders
      `).get() as any;

      const customersStat = db.prepare(`
        SELECT COUNT(*) as total_customers FROM users WHERE role = 'customer'
      `).get() as any;

      const couponsStat = db.prepare(`
        SELECT 
          COUNT(*) as total_coupons,
          COALESCE(SUM(times_used), 0) as total_redemptions
        FROM coupons
      `).get() as any;

      const btlStat = db.prepare(`
        SELECT 
          COUNT(*) as total_games,
          COALESCE(SUM(victory), 0) as total_victories,
          COALESCE(SUM(wool_collected), 0) as total_wool
        FROM game_sessions
      `).get() as any;

      const btlSessionsCount = (db.prepare('SELECT COUNT(*) as count FROM btl_sessions').get() as any)?.count || 0;

      const recentOrders = db.prepare(`
        SELECT id, order_number, customer_name, customer_email, customer_city, total, status, created_at, is_simulated
        FROM orders
        ORDER BY datetime(created_at) DESC
        LIMIT 5
      `).all() as any[];

      const productsStat = db.prepare(`
        SELECT 
          COUNT(*) as total_products,
          COALESCE(SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END), 0) as published_products,
          COALESCE(SUM(stock_units), 0) as total_units,
          COALESCE(SUM(stock_units * price), 0) as inventory_value
        FROM products
      `).get() as any;

      return res.json({
        overview: {
          totalOrders: ordersStat?.total_orders || 0,
          totalRevenue: ordersStat?.total_revenue || 0,
          totalSubtotal: ordersStat?.total_subtotal || 0,
          totalDiscounts: ordersStat?.total_discounts || 0,
          averageOrderValue: Math.round(ordersStat?.avg_order_value || 0),
          totalCustomers: customersStat?.total_customers || 0,
          totalCoupons: couponsStat?.total_coupons || 0,
          totalCouponsRedeemed: couponsStat?.total_redemptions || 0,
          btlGamesPlayed: (btlStat?.total_games || 0) + btlSessionsCount,
          btlVictories: btlStat?.total_victories || 0,
          btlWoolCollected: btlStat?.total_wool || 0,
          totalProducts: productsStat?.total_products || 0,
          publishedProducts: productsStat?.published_products || 0,
          totalInventoryUnits: productsStat?.total_units || 0,
          inventoryValue: productsStat?.inventory_value || 0,
        },
        recentOrders,
      });
    } catch (err: any) {
      console.error('Error fetching admin overview:', err);
      return res.status(500).json({ error: 'Error al generar resumen administrativo.' });
    }
  });

  // Máquina de estados oficial para transiciones de pedidos (Fase 2F.2)
  const VALID_STATUSES = ['pedido_recibido', 'en_preparacion', 'enviado', 'entregado', 'cancelado'] as const;
  type OrderStatusType = typeof VALID_STATUSES[number];

  const VALID_TRANSITIONS: Record<OrderStatusType, OrderStatusType[]> = {
    pedido_recibido: ['en_preparacion', 'cancelado'],
    en_preparacion: ['enviado', 'cancelado'],
    enviado: ['entregado', 'cancelado'],
    entregado: [], cancelado: [], // Estados terminales
  };

  // GET /api/admin/orders - Listado parametrizado con búsqueda, rango de fechas, estado y paginación
  app.get('/api/admin/orders', requireAdmin, (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
      const offset = (page - 1) * limit;

      const status = typeof req.query.status === 'string' && req.query.status.trim() && req.query.status.trim() !== 'todos'
        ? req.query.status.trim()
        : null;

      const search = typeof req.query.search === 'string' && req.query.search.trim()
        ? `%${req.query.search.trim()}%`
        : null;

      const startDate = typeof req.query.startDate === 'string' && req.query.startDate.trim()
        ? req.query.startDate.trim()
        : null;

      const endDate = typeof req.query.endDate === 'string' && req.query.endDate.trim()
        ? req.query.endDate.trim()
        : null;

      const whereClauses: string[] = ['1=1'];
      const params: any[] = [];

      if (status) {
        whereClauses.push('o.status = ?');
        params.push(status);
      }

      if (search) {
        whereClauses.push('(o.id LIKE ? OR o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_email LIKE ?)');
        params.push(search, search, search, search);
      }

      if (startDate) {
        whereClauses.push('date(o.created_at) >= date(?)');
        params.push(startDate);
      }

      if (endDate) {
        whereClauses.push('date(o.created_at) <= date(?)');
        params.push(endDate);
      }

      const whereSql = whereClauses.join(' AND ');

      const countRow = db.prepare(`SELECT COUNT(*) as count FROM orders o WHERE ${whereSql}`).get(...params) as any;
      const total = countRow?.count || 0;

      const orders = db.prepare(`
        SELECT 
          o.id, o.order_number, o.customer_name, o.customer_email, o.customer_phone,
          o.customer_city, o.customer_address, o.shipping_method, o.payment_method,
          o.subtotal, o.shipping_cost, o.discount, o.coupon_code, o.total,
          o.status, o.is_simulated, o.created_at,
          (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
        FROM orders o
        WHERE ${whereSql}
        ORDER BY datetime(o.created_at) DESC
        LIMIT ? OFFSET ?
      `).all(...params, limit, offset);

      const totalPages = Math.ceil(total / limit) || 1;

      return res.json({
        orders,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      });
    } catch (err: any) {
      console.error('Error fetching admin orders:', err);
      return res.status(500).json({ error: 'Error al consultar órdenes de compra.' });
    }
  });

  // PATCH /api/admin/orders/:id/status - Transición administrativa atómica con auditoría
  app.patch('/api/admin/orders/:id/status', requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const { status: nextStatus, notes } = req.body;
      const adminUser = (req as any).adminUser;

      if (!nextStatus || typeof nextStatus !== 'string') {
        return res.status(400).json({ error: 'Debes indicar el nuevo estado del pedido.' });
      }

      const cleanNewStatus = nextStatus.trim() as OrderStatusType;

      if (!VALID_STATUSES.includes(cleanNewStatus)) {
        return res.status(400).json({
          error: `Estado inválido. Estados permitidos: ${VALID_STATUSES.join(', ')}`,
        });
      }

      const order = db.prepare('SELECT * FROM orders WHERE id = ? OR order_number = ?').get(id, id) as any;
      if (!order) {
        return res.status(404).json({ error: 'Pedido no encontrado para actualizar estado.' });
      }

      const currentStatus = order.status as OrderStatusType;

      // Validación estricta de la máquina de estados
      const allowedNext = VALID_TRANSITIONS[currentStatus] || [];
      if (!allowedNext.includes(cleanNewStatus)) {
        return res.status(400).json({
          error: `Transición no permitida: no se puede avanzar directamente de "${currentStatus}" a "${cleanNewStatus}". Transición válida permitida: [${allowedNext.join(', ') || 'Ninguna (Estado final)'}].`,
        });
      }

      const historyId = `hist-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
      const nowIso = new Date().toISOString();

      // Transacción atómica en SQLite: actualiza pedido y registra auditoría
      const updateOrderAndAudit = db.transaction(() => {
        db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(cleanNewStatus, order.id);

        db.prepare(`
          INSERT INTO order_status_history (
            id, order_id, previous_status, new_status, admin_id, admin_email, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          historyId,
          order.id,
          currentStatus,
          cleanNewStatus,
          adminUser.id,
          adminUser.email,
          notes ? String(notes).trim() : '',
          nowIso
        );
      });

      const saveTransition = db.transaction(() => {
        updateOrderAndAudit();
        if (cleanNewStatus === 'cancelado') insertAnalyticsEvent({ id: `evt-cancel-${order.id}-${historyId}`, event_name: 'order_cancelled', session_id: `order-${order.id}`,
          user_id: order.user_id || null, source: 'backend', entity_type: 'order', entity_id: order.id, properties: { status: 'cancelado', is_simulated: true } });
      });
      saveTransition();

      console.log(`[AUDIT] Pedido ${order.order_number}: estado modificado de "${currentStatus}" a "${cleanNewStatus}" por admin ${adminUser.email}`);

      return res.json({
        success: true,
        orderId: order.id,
        orderNumber: order.order_number,
        previousStatus: currentStatus,
        status: cleanNewStatus,
        updatedAt: nowIso,
        auditRecordId: historyId,
        message: `Estado de la orden ${order.order_number} actualizado con éxito a "${cleanNewStatus}".`,
      });
    } catch (err: any) {
      console.error('Error updating order status:', err);
      return res.status(500).json({ error: 'Error interno al actualizar el estado del pedido.' });
    }
  });

  // GET /api/admin/orders/:id/history - Historial de cambios de estado para auditoría
  app.get('/api/admin/orders/:id/history', requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const order = db.prepare('SELECT id, order_number, status, created_at FROM orders WHERE id = ? OR order_number = ?').get(id, id) as any;

      if (!order) {
        return res.status(404).json({ error: 'Pedido no encontrado para consultar historial.' });
      }

      const history = db.prepare(`
        SELECT id, order_id, previous_status, new_status, admin_id, admin_email, notes, created_at
        FROM order_status_history
        WHERE order_id = ?
        ORDER BY datetime(created_at) DESC
      `).all(order.id);

      return res.json({
        orderNumber: order.order_number,
        currentStatus: order.status,
        orderCreatedAt: order.created_at,
        history,
      });
    } catch (err: any) {
      console.error('Error fetching order status history:', err);
      return res.status(500).json({ error: 'Error al consultar historial del pedido.' });
    }
  });

  // GET /api/admin/customers - Listado paginado de clientes con búsqueda y filtro de fechas
  app.get('/api/admin/customers', requireAdmin, (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
      const offset = (page - 1) * limit;

      const search = typeof req.query.search === 'string' && req.query.search.trim()
        ? `%${req.query.search.trim()}%`
        : null;

      const startDate = typeof req.query.startDate === 'string' && req.query.startDate.trim()
        ? req.query.startDate.trim()
        : null;

      const endDate = typeof req.query.endDate === 'string' && req.query.endDate.trim()
        ? req.query.endDate.trim()
        : null;

      const whereClauses: string[] = ["u.role = 'customer'"];
      const params: any[] = [];

      if (search) {
        whereClauses.push('(u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR u.city LIKE ?)');
        params.push(search, search, search, search);
      }

      if (startDate) {
        whereClauses.push('date(u.created_at) >= date(?)');
        params.push(startDate);
      }

      if (endDate) {
        whereClauses.push('date(u.created_at) <= date(?)');
        params.push(endDate);
      }

      const whereSql = whereClauses.join(' AND ');

      const countRow = db.prepare(`SELECT COUNT(*) as count FROM users u WHERE ${whereSql}`).get(...params) as any;
      const total = countRow?.count || 0;

      const customers = db.prepare(`
        SELECT 
          u.id, u.name, u.email, u.phone, u.city, u.department, u.created_at,
          COUNT(o.id) as orders_count,
          COALESCE(SUM(o.total), 0) as total_spent,
          MAX(o.created_at) as last_order_date
        FROM users u
        LEFT JOIN orders o ON (u.id = o.user_id OR lower(u.email) = lower(o.customer_email))
        WHERE ${whereSql}
        GROUP BY u.id
        ORDER BY datetime(u.created_at) DESC
        LIMIT ? OFFSET ?
      `).all(...params, limit, offset);

      const totalPages = Math.ceil(total / limit) || 1;

      return res.json({
        customers,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      });
    } catch (err: any) {
      console.error('Error fetching admin customers:', err);
      return res.status(500).json({ error: 'Error al consultar listado de clientes.' });
    }
  });

  // GET /api/admin/coupons - Listado de cupones con categorización (BTL, Comercial General, Comercial Exclusivo), filtros y paginación
  app.get('/api/admin/coupons', requireAdmin, (req, res) => {
    try {
      const { type, status, search, page: pageQuery, limit: limitQuery } = req.query;

      const whereClauses: string[] = ['1=1'];
      const params: any[] = [];

      // Filter by type
      if (type && type !== 'all') {
        if (type === 'btl') {
          whereClauses.push("(c.coupon_type = 'btl' OR c.code LIKE 'MARIAI-%')");
        } else if (type === 'commercial_general') {
          whereClauses.push("(c.coupon_type = 'commercial_general' OR (c.coupon_type = 'commercial' AND (c.target_type = 'general' OR c.target_type IS NULL)))");
        } else if (type === 'commercial_exclusive') {
          whereClauses.push("(c.coupon_type = 'commercial_exclusive' OR (c.coupon_type = 'commercial' AND c.target_type = 'exclusive'))");
        }
      }

      // Filter by status
      if (status && status !== 'all') {
        if (status === 'active') {
          whereClauses.push('c.is_active = 1');
        } else if (status === 'inactive') {
          whereClauses.push('c.is_active = 0');
        }
      }

      // Filter by search
      if (search && typeof search === 'string' && search.trim()) {
        const term = `%${search.trim().toLowerCase()}%`;
        whereClauses.push('(lower(c.code) LIKE ? OR lower(c.description) LIKE ? OR lower(COALESCE(c.user_email, \'\')) LIKE ? OR lower(COALESCE(u.name, \'\')) LIKE ? OR lower(COALESCE(u.email, \'\')) LIKE ?)');
        params.push(term, term, term, term, term);
      }

      const whereSql = whereClauses.join(' AND ');

      // Total count
      const countRow = db.prepare(`
        SELECT COUNT(*) as count 
        FROM coupons c 
        LEFT JOIN users u ON (c.user_id = u.id OR (c.user_email IS NOT NULL AND lower(c.user_email) = lower(u.email)))
        WHERE ${whereSql}
      `).get(...params) as any;
      const total = countRow?.count || 0;

      const isPaginated = pageQuery !== undefined || limitQuery !== undefined;
      const page = Math.max(1, parseInt(pageQuery as string, 10) || 1);
      const limit = Math.max(1, parseInt(limitQuery as string, 10) || 20);
      const offset = (page - 1) * limit;

      let couponsQuery = `
        SELECT 
          c.code, c.discount_percent, c.coupon_type, c.target_type, c.level_required,
          c.max_uses, c.times_used, c.is_active, c.description, c.user_id, c.user_email,
          c.session_id, c.created_at, c.expires_at,
          u.name as owner_name, COALESCE(c.user_email, u.email) as owner_email
        FROM coupons c
        LEFT JOIN users u ON (c.user_id = u.id OR (c.user_email IS NOT NULL AND lower(c.user_email) = lower(u.email)))
        WHERE ${whereSql}
        ORDER BY datetime(c.created_at) DESC
      `;

      let coupons: any[];
      if (isPaginated) {
        coupons = db.prepare(`${couponsQuery} LIMIT ? OFFSET ?`).all(...params, limit, offset);
      } else {
        coupons = db.prepare(couponsQuery).all(...params);
      }

      const totalPages = Math.ceil(total / limit) || 1;

      return res.json({
        coupons,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      });
    } catch (err: any) {
      console.error('Error fetching admin coupons:', err);
      return res.status(500).json({ error: 'Error al consultar cupones.' });
    }
  });

  // POST /api/admin/coupons - Creación de cupón comercial (General o Exclusivo para cliente específico)
  app.post('/api/admin/coupons', requireAdmin, (req, res) => {
    try {
      const { code, discountPercent, maxUses, expiresAt, description, isActive, targetType, userId } = req.body;

      if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'El código de cupón es obligatorio.' });
      }

      const normalizedCode = code.trim().toUpperCase();

      // Validación de formato de código alfanumérico seguro (3 a 25 caracteres)
      if (!/^[A-Z0-9_-]{3,25}$/.test(normalizedCode)) {
        return res.status(400).json({
          error: 'Código inválido. Debe tener entre 3 y 25 caracteres alfanuméricos (letras mayúsculas, números, guiones).',
        });
      }

      // No permitir crear cupones que colisionen con el prefijo oficial de recompensas BTL
      if (normalizedCode.startsWith('MARIAI-') || normalizedCode.startsWith('POMPON')) {
        return res.status(400).json({
          error: 'Los prefijos "MARIAI-" y "POMPON" están reservados exclusivamente para las recompensas del videojuego BTL.',
        });
      }

      // Verificar unicidad del código
      const existing = db.prepare('SELECT code FROM coupons WHERE code = ?').get(normalizedCode);
      if (existing) {
        return res.status(409).json({ error: `El cupón con código "${normalizedCode}" ya existe en el sistema.` });
      }

      // Validación de porcentaje (1% a 90%)
      const discountNum = Number(discountPercent);
      if (isNaN(discountNum) || discountNum < 1 || discountNum > 90 || !Number.isInteger(discountNum)) {
        return res.status(400).json({ error: 'El porcentaje de descuento debe ser un número entero entre 1% y 90%.' });
      }

      // Manejo de Destinatario: General vs Exclusivo
      const cleanTargetType = targetType === 'exclusive' ? 'exclusive' : 'general';
      let targetUserId: string | null = null;
      let targetUserEmail: string | null = null;
      let targetUserName: string | null = null;
      let couponType = cleanTargetType === 'exclusive' ? 'commercial_exclusive' : 'commercial_general';

      if (cleanTargetType === 'exclusive') {
        if (!userId || typeof userId !== 'string' || !userId.trim()) {
          return res.status(400).json({ error: 'Para cupones exclusivos es obligatorio seleccionar un cliente registrado.' });
        }
        const userRow = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(userId.trim()) as any;
        if (!userRow) {
          return res.status(400).json({ error: 'El usuario destinatario especificado no existe en el sistema.' });
        }
        targetUserId = userRow.id;
        targetUserEmail = userRow.email;
        targetUserName = userRow.name;
      }

      // Validación de límite de usos
      const defaultUses = cleanTargetType === 'exclusive' ? 1 : 9999;
      const maxUsesNum = maxUses !== undefined && maxUses !== null && maxUses !== '' ? Number(maxUses) : defaultUses;
      if (isNaN(maxUsesNum) || maxUsesNum < 1) {
        return res.status(400).json({ error: 'El límite de usos debe ser un número entero positivo mayor a cero.' });
      }

      // Validación de fecha de expiración si se provee
      let parsedExpiresAt: string | null = null;
      if (expiresAt && typeof expiresAt === 'string' && expiresAt.trim()) {
        const expDate = new Date(expiresAt.trim());
        if (isNaN(expDate.getTime())) {
          return res.status(400).json({ error: 'Fecha de vencimiento inválida.' });
        }
        if (expDate.getTime() < Date.now()) {
          return res.status(400).json({ error: 'La fecha de vencimiento debe ser posterior al momento actual.' });
        }
        parsedExpiresAt = expDate.toISOString();
      }

      const nowIso = new Date().toISOString();
      const activeFlag = isActive === false || isActive === 0 ? 0 : 1;
      const cleanDesc = description && typeof description === 'string' && description.trim()
        ? description.trim()
        : cleanTargetType === 'exclusive'
        ? `Cupón Exclusivo ${discountNum}% OFF para ${targetUserName || targetUserEmail}`
        : `Cupón Comercial General ${discountNum}% OFF`;

      db.prepare(`
        INSERT INTO coupons (
          code, discount_percent, coupon_type, target_type, level_required, max_uses, times_used,
          expires_at, is_active, description, user_id, user_email, created_at
        ) VALUES (?, ?, ?, ?, NULL, ?, 0, ?, ?, ?, ?, ?, ?)
      `).run(
        normalizedCode,
        discountNum,
        couponType,
        cleanTargetType,
        maxUsesNum,
        parsedExpiresAt,
        activeFlag,
        cleanDesc,
        targetUserId,
        targetUserEmail,
        nowIso
      );

      console.log(`[AUDIT] Cupón comercial "${normalizedCode}" (${couponType}, ${discountNum}% OFF) creado exitosamente por admin`);

      return res.status(201).json({
        success: true,
        coupon: {
          code: normalizedCode,
          discount_percent: discountNum,
          discountPercent: discountNum,
          coupon_type: couponType,
          couponType: couponType,
          target_type: cleanTargetType,
          targetType: cleanTargetType,
          user_id: targetUserId,
          userId: targetUserId,
          user_email: targetUserEmail,
          userEmail: targetUserEmail,
          owner_name: targetUserName,
          owner_email: targetUserEmail,
          max_uses: maxUsesNum,
          maxUses: maxUsesNum,
          times_used: 0,
          timesUsed: 0,
          expires_at: parsedExpiresAt,
          expiresAt: parsedExpiresAt,
          is_active: activeFlag,
          isActive: activeFlag === 1,
          description: cleanDesc,
          created_at: nowIso,
          createdAt: nowIso,
        },
        message: `Cupón "${normalizedCode}" (${cleanTargetType === 'exclusive' ? 'Exclusivo' : 'General'}) creado exitosamente.`,
      });
    } catch (err: any) {
      console.error('Error creating commercial coupon:', err);
      return res.status(500).json({ error: 'Error interno al registrar el cupón comercial.' });
    }
  });

  // PATCH /api/admin/coupons/:code - Activar/desactivar y actualizar cupón (Fase 2F.2 / 2F.3)
  app.patch('/api/admin/coupons/:code', requireAdmin, (req, res) => {
    try {
      const { code } = req.params;
      const { isActive, expiresAt, maxUses, description, discountPercent } = req.body;

      const normalizedCode = code.trim().toUpperCase();
      const coupon = db.prepare('SELECT * FROM coupons WHERE code = ?').get(normalizedCode) as any;

      if (!coupon) {
        return res.status(404).json({ error: `El cupón "${normalizedCode}" no fue encontrado.` });
      }

      const isBtlCoupon = coupon.coupon_type === 'btl' || normalizedCode.startsWith('MARIAI-') || normalizedCode.startsWith('POMPON');

      // Regla 10: Evitar que la edición administrativa altere las reglas o porcentaje de cupones BTL ya emitidos
      if (isBtlCoupon && discountPercent !== undefined && Number(discountPercent) !== coupon.discount_percent) {
        return res.status(403).json({
          error: 'No está permitido modificar el porcentaje de descuento de cupones emitidos por el videojuego BTL.',
        });
      }

      // Validación estricta para activación: no permitir activar cupón vencido o con usos agotados
      if (isActive !== undefined && (isActive === true || isActive === 1)) {
        if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
          return res.status(400).json({
            error: 'No es posible activar un cupón cuya fecha de expiración ya ha vencido. Actualiza la fecha de vencimiento primero.',
          });
        }
        if (coupon.max_uses && coupon.times_used >= coupon.max_uses) {
          return res.status(400).json({
            error: 'No es posible activar un cupón que ya ha alcanzado su límite de usos redimidos.',
          });
        }
      }

      let updatedActive = coupon.is_active;
      if (isActive !== undefined) {
        updatedActive = isActive ? 1 : 0;
      }

      let updatedMaxUses = coupon.max_uses;
      if (maxUses !== undefined) {
        const numUses = Number(maxUses);
        if (isNaN(numUses) || numUses < 1) {
          return res.status(400).json({ error: 'El límite de usos debe ser mayor o igual a 1.' });
        }
        if (numUses < coupon.times_used) {
          return res.status(400).json({
            error: `El límite de usos (${numUses}) no puede ser menor a los usos ya redimidos (${coupon.times_used}).`,
          });
        }
        updatedMaxUses = numUses;
      }

      let updatedExpiresAt = coupon.expires_at;
      if (expiresAt !== undefined) {
        if (expiresAt === null || expiresAt === '') {
          updatedExpiresAt = null;
        } else {
          const parsed = new Date(expiresAt);
          if (isNaN(parsed.getTime())) {
            return res.status(400).json({ error: 'Fecha de vencimiento no válida.' });
          }
          updatedExpiresAt = parsed.toISOString();
        }
      }

      let updatedDesc = coupon.description;
      if (description !== undefined && typeof description === 'string') {
        updatedDesc = description.trim();
      }

      let updatedDiscount = coupon.discount_percent;
      if (!isBtlCoupon && discountPercent !== undefined) {
        const discNum = Number(discountPercent);
        if (isNaN(discNum) || discNum < 1 || discNum > 90 || !Number.isInteger(discNum)) {
          return res.status(400).json({ error: 'El porcentaje debe ser un entero entre 1% y 90%.' });
        }
        updatedDiscount = discNum;
      }

      db.prepare(`
        UPDATE coupons
        SET is_active = ?, max_uses = ?, expires_at = ?, description = ?, discount_percent = ?
        WHERE code = ?
      `).run(
        updatedActive,
        updatedMaxUses,
        updatedExpiresAt,
        updatedDesc,
        updatedDiscount,
        normalizedCode
      );

      console.log(`[AUDIT] Cupón "${normalizedCode}" actualizado: activo=${updatedActive}, max_uses=${updatedMaxUses}`);

      return res.json({
        success: true,
        coupon: {
          code: normalizedCode,
          discount_percent: updatedDiscount,
          discountPercent: updatedDiscount,
          coupon_type: coupon.coupon_type || 'commercial_general',
          couponType: coupon.coupon_type || 'commercial_general',
          target_type: coupon.target_type || 'general',
          targetType: coupon.target_type || 'general',
          user_id: coupon.user_id,
          userId: coupon.user_id,
          user_email: coupon.user_email,
          userEmail: coupon.user_email,
          max_uses: updatedMaxUses,
          maxUses: updatedMaxUses,
          times_used: coupon.times_used,
          timesUsed: coupon.times_used,
          is_active: updatedActive,
          isActive: updatedActive === 1,
          expires_at: updatedExpiresAt,
          expiresAt: updatedExpiresAt,
          description: updatedDesc,
        },
        message: `Cupón "${normalizedCode}" actualizado correctamente.`,
      });
    } catch (err: any) {
      console.error('Error updating coupon:', err);
      return res.status(500).json({ error: 'Error interno al actualizar el cupón.' });
    }
  });

  // GET /api/admin/btl/overview - Estadísticas y telemetría de juego por nivel
  app.get('/api/admin/btl/overview', requireAdmin, (req, res) => {
    try {
      const levelStats = db.prepare(`
        SELECT 
          level,
          COUNT(*) as attempts,
          COALESCE(SUM(victory), 0) as victories,
          COALESCE(SUM(wool_collected), 0) as wool_collected,
          COALESCE(AVG(score), 0) as avg_score,
          COALESCE(AVG(time_seconds), 0) as avg_time
        FROM game_sessions
        GROUP BY level
        ORDER BY level ASC
      `).all();

      const totalSessions = (db.prepare('SELECT COUNT(*) as count FROM game_sessions').get() as any)?.count || 0;
      const totalBtlSessions = (db.prepare('SELECT COUNT(*) as count FROM btl_sessions').get() as any)?.count || 0;
      const victories = (db.prepare('SELECT COUNT(*) as count FROM game_sessions WHERE victory = 1').get() as any)?.count || 0;
      const btlCouponsCount = (db.prepare(`SELECT COUNT(*) as count FROM coupons WHERE code LIKE 'MARIAI-%'`).get() as any)?.count || 0;
      const btlCouponsUsed = (db.prepare(`SELECT COALESCE(SUM(times_used), 0) as count FROM coupons WHERE code LIKE 'MARIAI-%'`).get() as any)?.count || 0;

      return res.json({
        summary: {
          totalGameRuns: totalSessions + totalBtlSessions,
          completedSessions: totalSessions,
          victories,
          victoryRate: totalSessions > 0 ? Math.round((victories / totalSessions) * 100) : 0,
          btlCouponsGenerated: btlCouponsCount,
          btlCouponsRedeemed: btlCouponsUsed,
        },
        levelStats,
      });
    } catch (err: any) {
      console.error('Error fetching admin BTL overview:', err);
      return res.status(500).json({ error: 'Error al consultar métricas del videojuego BTL.' });
    }
  });

  // ----------------------------------------------------
  // ADMIN PRODUCTS & CATALOG MANAGEMENT (FASE 2F.5)
  // ----------------------------------------------------

  // GET /api/admin/products - Listar productos con filtros y métricas completas para el panel
  app.get('/api/admin/products', requireAdmin, (req, res) => {
    try {
      const { search, category, status, sort, page = '1', limit = '50' } = req.query;
      let query = 'SELECT * FROM products WHERE 1=1';
      const params: any[] = [];

      if (category && typeof category === 'string' && category !== 'todos') {
        query += ' AND category = ?';
        params.push(category.trim().toLowerCase());
      }

      if (status && typeof status === 'string' && status !== 'todos') {
        query += ' AND status = ?';
        params.push(status.trim().toLowerCase());
      }

      if (search && typeof search === 'string' && search.trim()) {
        query += ' AND (name LIKE ? OR sku LIKE ? OR short_description LIKE ? OR tags LIKE ?)';
        const term = `%${search.trim()}%`;
        params.push(term, term, term, term);
      }

      if (sort === 'price-asc') {
        query += ' ORDER BY price ASC';
      } else if (sort === 'price-desc') {
        query += ' ORDER BY price DESC';
      } else if (sort === 'stock-asc') {
        query += ' ORDER BY stock_units ASC';
      } else if (sort === 'stock-desc') {
        query += ' ORDER BY stock_units DESC';
      } else if (sort === 'name-asc') {
        query += ' ORDER BY name ASC';
      } else {
        query += ' ORDER BY featured DESC, datetime(created_at) DESC';
      }

      const rows = db.prepare(query).all(...params) as any[];
      const total = rows.length;

      const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
      const limitNum = Math.max(1, parseInt(limit as string, 10) || 50);
      const start = (pageNum - 1) * limitNum;
      const paginatedRows = rows.slice(start, start + limitNum);

      const products = paginatedRows.map(formatDbProduct);

      // Métricas de inventario para el encabezado del panel
      const totalInventoryUnits = rows.reduce((acc, r) => acc + (r.stock_units || 0), 0);
      const totalInventoryValue = rows.reduce((acc, r) => acc + (r.stock_units || 0) * (r.price || 0), 0);
      const countPublished = rows.filter((r) => r.status === 'published').length;
      const countHidden = rows.filter((r) => r.status === 'hidden').length;
      const countOutOfStock = rows.filter((r) => r.status === 'out_of_stock' || r.stock_units <= 0).length;

      return res.json({
        products,
        total,
        page: pageNum,
        limit: limitNum,
        metrics: {
          totalProducts: total,
          published: countPublished,
          hidden: countHidden,
          outOfStock: countOutOfStock,
          totalUnits: totalInventoryUnits,
          inventoryValue: totalInventoryValue,
        },
      });
    } catch (err: any) {
      console.error('Error in /api/admin/products:', err);
      return res.status(500).json({ error: 'Error al consultar productos administrativos.' });
    }
  });

  // GET /api/admin/products/:id - Detalle de un producto para edición administrativa
  app.get('/api/admin/products/:id', requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const row = db.prepare('SELECT * FROM products WHERE id = ? OR sku = ?').get(id, id) as any;
      if (!row) {
        return res.status(404).json({ error: 'Producto no encontrado.' });
      }
      return res.json({ product: formatDbProduct(row) });
    } catch (err: any) {
      console.error('Error fetching admin product by id:', err);
      return res.status(500).json({ error: 'Error al consultar el producto.' });
    }
  });

  // POST /api/admin/products - Crear un nuevo amigurumi artesanal
  app.post('/api/admin/products', requireAdmin, (req, res) => {
    try {
      const {
        name,
        sku,
        category,
        shortDescription,
        fullDescription,
        price,
        stockUnits = 0,
        lowStockThreshold = 3,
        status = 'published',
        heightCm,
        widthCm,
        depthCm,
        craftTimeHours,
        difficulty = 'Intermedia',
        weaveType,
        materials,
        colors,
        careInstructions,
        notes,
        imageUrl,
        additionalImages,
        tags,
        featured = false,
      } = req.body;

      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'El nombre del amigurumi es obligatorio.' });
      }

      if (!category || typeof category !== 'string' || !category.trim()) {
        return res.status(400).json({ error: 'La categoría del amigurumi es obligatoria.' });
      }

      const numPrice = Number(price);
      if (isNaN(numPrice) || numPrice <= 0) {
        return res.status(400).json({ error: 'El precio debe ser un número mayor a 0 COP.' });
      }

      const numStock = Number(stockUnits);
      if (isNaN(numStock) || numStock < 0 || !Number.isInteger(numStock)) {
        return res.status(400).json({ error: 'El inventario debe ser un número entero mayor o igual a 0.' });
      }

      const numThreshold = Number(lowStockThreshold);
      const safeThreshold = isNaN(numThreshold) || numThreshold < 0 ? 3 : numThreshold;

      // Generar o validar SKU único
      let safeSku = sku && typeof sku === 'string' ? sku.trim().toUpperCase() : '';
      if (!safeSku) {
        safeSku = `AMI-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
      }

      const existingSku = db.prepare('SELECT id FROM products WHERE sku = ?').get(safeSku) as any;
      if (existingSku) {
        return res.status(409).json({ error: `El código SKU "${safeSku}" ya se encuentra registrado.` });
      }

      const productId = `ami-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const nowIso = new Date().toISOString();

      let safeStatus = status;
      if (!['published', 'hidden', 'out_of_stock'].includes(safeStatus)) {
        safeStatus = 'published';
      }
      if (numStock === 0 && safeStatus === 'published') {
        safeStatus = 'out_of_stock';
      }

      const materialsJson = JSON.stringify(Array.isArray(materials) ? materials : (materials ? [materials] : []));
      const additionalImagesJson = JSON.stringify(Array.isArray(additionalImages) ? additionalImages : []);
      const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : (tags ? [tags] : []));

      db.prepare(`
        INSERT INTO products (
          id, sku, name, category, short_description, full_description, price, currency,
          stock_units, low_stock_threshold, status, height_cm, width_cm, depth_cm,
          craft_time_hours, difficulty, weave_type, materials, colors, care_instructions,
          notes, image_url, additional_images, tags, featured, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, 'COP',
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?
        )
      `).run(
        productId,
        safeSku,
        name.trim(),
        category.trim().toLowerCase(),
        (shortDescription || '').trim(),
        (fullDescription || shortDescription || '').trim(),
        Math.round(numPrice),
        numStock,
        safeThreshold,
        safeStatus,
        heightCm ? Number(heightCm) : null,
        widthCm ? Number(widthCm) : null,
        depthCm ? Number(depthCm) : null,
        craftTimeHours ? Number(craftTimeHours) : 6,
        (difficulty || 'Intermedia').trim(),
        (weaveType || 'Punto bajo en espiral continua').trim(),
        materialsJson,
        (colors || '').trim(),
        (careInstructions || 'Lavar a mano con agua fría y secar a la sombra.').trim(),
        (notes || '').trim(),
        imageUrl || '/src/assets/images/hero_amigurumi_showcase_1794329731742.jpg',
        additionalImagesJson,
        tagsJson,
        featured ? 1 : 0,
        nowIso,
        nowIso
      );

      const created = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as any;
      console.log(`[CATALOG] Nuevo amigurumi creado: "${created.name}" (SKU: ${created.sku}, Stock: ${created.stock_units})`);

      return res.status(201).json({
        success: true,
        product: formatDbProduct(created),
        message: 'Amigurumi creado exitosamente en el catálogo.',
      });
    } catch (err: any) {
      console.error('Error creating product:', err);
      return res.status(500).json({ error: 'Error al registrar el producto en la base de datos.' });
    }
  });

  // PATCH /api/admin/products/:id - Actualización completa de datos artesanales e inventario
  app.patch('/api/admin/products/:id', requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
      if (!product) {
        return res.status(404).json({ error: 'Producto no encontrado.' });
      }

      const body = req.body;
      const nowIso = new Date().toISOString();

      // Verificar unicidad de SKU si se cambia
      let newSku = product.sku;
      if (body.sku && typeof body.sku === 'string' && body.sku.trim().toUpperCase() !== product.sku) {
        newSku = body.sku.trim().toUpperCase();
        const clash = db.prepare('SELECT id FROM products WHERE sku = ? AND id != ?').get(newSku, id) as any;
        if (clash) {
          return res.status(409).json({ error: `El código SKU "${newSku}" ya pertenece a otro amigurumi.` });
        }
      }

      let updatedPrice = product.price;
      if (body.price !== undefined) {
        const p = Number(body.price);
        if (isNaN(p) || p <= 0) {
          return res.status(400).json({ error: 'El precio debe ser un número mayor a 0 COP.' });
        }
        updatedPrice = Math.round(p);
      }

      let updatedStock = product.stock_units;
      if (body.stockUnits !== undefined) {
        const s = Number(body.stockUnits);
        if (isNaN(s) || s < 0 || !Number.isInteger(s)) {
          return res.status(400).json({ error: 'El inventario debe ser un entero mayor o igual a 0.' });
        }
        updatedStock = s;
      }

      let updatedStatus = product.status;
      if (body.status !== undefined && ['published', 'hidden', 'out_of_stock'].includes(body.status)) {
        updatedStatus = body.status;
      }
      if (updatedStock === 0 && updatedStatus === 'published') {
        updatedStatus = 'out_of_stock';
      } else if (updatedStock > 0 && updatedStatus === 'out_of_stock' && body.status === undefined) {
        updatedStatus = 'published';
      }

      const updatedName = body.name !== undefined ? String(body.name).trim() : product.name;
      const updatedCat = body.category !== undefined ? String(body.category).trim().toLowerCase() : product.category;
      const updatedShortDesc = body.shortDescription !== undefined ? String(body.shortDescription).trim() : product.short_description;
      const updatedFullDesc = body.fullDescription !== undefined ? String(body.fullDescription).trim() : product.full_description;
      const updatedThreshold = body.lowStockThreshold !== undefined ? Math.max(0, Number(body.lowStockThreshold)) : product.low_stock_threshold;
      const updatedHeight = body.heightCm !== undefined ? (body.heightCm ? Number(body.heightCm) : null) : product.height_cm;
      const updatedWidth = body.widthCm !== undefined ? (body.widthCm ? Number(body.widthCm) : null) : product.width_cm;
      const updatedDepth = body.depthCm !== undefined ? (body.depthCm ? Number(body.depthCm) : null) : product.depth_cm;
      const updatedCraftTime = body.craftTimeHours !== undefined ? Number(body.craftTimeHours) : product.craft_time_hours;
      const updatedDifficulty = body.difficulty !== undefined ? String(body.difficulty).trim() : product.difficulty;
      const updatedWeaveType = body.weaveType !== undefined ? String(body.weaveType).trim() : product.weave_type;
      const updatedColors = body.colors !== undefined ? String(body.colors).trim() : product.colors;
      const updatedCare = body.careInstructions !== undefined ? String(body.careInstructions).trim() : product.care_instructions;
      const updatedNotes = body.notes !== undefined ? String(body.notes).trim() : product.notes;
      const updatedImage = body.imageUrl !== undefined ? String(body.imageUrl).trim() : product.image_url;
      const updatedFeatured = body.featured !== undefined ? (body.featured ? 1 : 0) : product.featured;

      let updatedMaterials = product.materials;
      if (body.materials !== undefined) {
        updatedMaterials = JSON.stringify(Array.isArray(body.materials) ? body.materials : [body.materials]);
      }

      let updatedAdditionalImages = product.additional_images;
      if (body.additionalImages !== undefined) {
        updatedAdditionalImages = JSON.stringify(Array.isArray(body.additionalImages) ? body.additionalImages : []);
      }

      let updatedTags = product.tags;
      if (body.tags !== undefined) {
        updatedTags = JSON.stringify(Array.isArray(body.tags) ? body.tags : [body.tags]);
      }

      db.prepare(`
        UPDATE products SET
          sku = ?, name = ?, category = ?, short_description = ?, full_description = ?,
          price = ?, stock_units = ?, low_stock_threshold = ?, status = ?,
          height_cm = ?, width_cm = ?, depth_cm = ?, craft_time_hours = ?,
          difficulty = ?, weave_type = ?, materials = ?, colors = ?,
          care_instructions = ?, notes = ?, image_url = ?, additional_images = ?,
          tags = ?, featured = ?, updated_at = ?
        WHERE id = ?
      `).run(
        newSku,
        updatedName,
        updatedCat,
        updatedShortDesc,
        updatedFullDesc,
        updatedPrice,
        updatedStock,
        updatedThreshold,
        updatedStatus,
        updatedHeight,
        updatedWidth,
        updatedDepth,
        updatedCraftTime,
        updatedDifficulty,
        updatedWeaveType,
        updatedMaterials,
        updatedColors,
        updatedCare,
        updatedNotes,
        updatedImage,
        updatedAdditionalImages,
        updatedTags,
        updatedFeatured,
        nowIso,
        id
      );

      const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
      console.log(`[CATALOG] Producto "${updated.name}" actualizado (Stock: ${updated.stock_units}, Precio: $${updated.price})`);

      return res.json({
        success: true,
        product: formatDbProduct(updated),
        message: 'Amigurumi actualizado correctamente.',
      });
    } catch (err: any) {
      console.error('Error updating product:', err);
      return res.status(500).json({ error: 'Error al actualizar producto.' });
    }
  });

  // PATCH /api/admin/products/:id/status - Cambio rápido de estado (publicar/ocultar)
  app.patch('/api/admin/products/:id/status', requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status || !['published', 'hidden', 'out_of_stock'].includes(status)) {
        return res.status(400).json({ error: 'Estado inválido. Opciones: published, hidden, out_of_stock.' });
      }

      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
      if (!product) {
        return res.status(404).json({ error: 'Producto no encontrado.' });
      }

      let targetStatus = status;
      if (status === 'published' && product.stock_units <= 0) {
        targetStatus = 'out_of_stock';
      }

      const nowIso = new Date().toISOString();
      db.prepare('UPDATE products SET status = ?, updated_at = ? WHERE id = ?').run(targetStatus, nowIso, id);

      const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
      return res.json({
        success: true,
        product: formatDbProduct(updated),
        message: `Estado del amigurumi actualizado a "${targetStatus}".`,
      });
    } catch (err: any) {
      console.error('Error updating product status:', err);
      return res.status(500).json({ error: 'Error al actualizar el estado del amigurumi.' });
    }
  });

  // POST /api/admin/products/upload-image - Subida segura de fotografías artesanales
  app.post('/api/admin/products/upload-image', requireAdmin, (req, res) => {
    try {
      const { fileData, fileName, mimeType } = req.body;

      if (!fileData || typeof fileData !== 'string') {
        return res.status(400).json({ error: 'Archivo de imagen requerido en base64.' });
      }

      const ALLOWED_MIMES: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
      };

      const cleanMime = (mimeType || '').trim().toLowerCase();
      const ext = ALLOWED_MIMES[cleanMime];
      if (!ext) {
        return res.status(400).json({
          error: 'Formato no soportado. Se permiten únicamente imágenes JPEG, PNG o WebP.',
        });
      }

      const base64Index = fileData.indexOf(';base64,');
      const rawBase64 = base64Index !== -1 ? fileData.substring(base64Index + 8) : fileData;
      const buffer = Buffer.from(rawBase64, 'base64');

      const MAX_SIZE = 5 * 1024 * 1024;
      if (buffer.length > MAX_SIZE) {
        return res.status(400).json({
          error: 'La imagen excede el límite máximo permitido de 5 MB.',
        });
      }

      if (buffer.length < 12) {
        return res.status(400).json({ error: 'Archivo de imagen dañado o incompleto.' });
      }

      let isValidMagic = false;
      if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        isValidMagic = true;
      } else if (buffer[0] === 0x89 && buffer[1] === 0x4e && buffer[2] === 0x47 && buffer[3] === 0x0d) { // PNG standard magic: 89 50 4E 47 ('\x89PNG') -> byte[1] is 0x50 ('P')
        isValidMagic = true;
      } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
        isValidMagic = true;
      } else if (
        buffer.toString('utf-8', 0, 4) === 'RIFF' &&
        buffer.toString('utf-8', 8, 12) === 'WEBP'
      ) {
        isValidMagic = true;
      }

      if (!isValidMagic) {
        return res.status(400).json({
          error: 'El contenido del archivo no coincide con una imagen válida (JPEG, PNG o WebP).',
        });
      }

      const sanitizedBase = (fileName || 'amigurumi')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .substring(0, 20);
      const safeFileName = `ami-${Date.now()}-${sanitizedBase || 'foto'}-${crypto.randomBytes(4).toString('hex')}.${ext}`;

      const targetDir = path.resolve(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const filePath = path.join(targetDir, safeFileName);
      fs.writeFileSync(filePath, buffer);

      const publicUrl = `/uploads/${safeFileName}`;
      console.log(`[UPLOADS] Fotografía guardada: ${publicUrl} (${buffer.length} bytes)`);

      return res.status(201).json({
        success: true,
        url: publicUrl,
        imageUrl: publicUrl,
        fileName: safeFileName,
        size: buffer.length,
        message: 'Fotografía artesanal subida exitosamente.',
      });
    } catch (err: any) {
      console.error('Error uploading product image:', err);
      return res.status(500).json({ error: 'Error al procesar y guardar la imagen.' });
    }
  });

  // 404 for unhandled API requests
  app.all('/api/*', (req, res) => {
    return res.status(404).json({ error: 'Ruta de API no encontrada.' });
  });

  // Global Error Handling Middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled application error:', err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(500).json({
      error: 'Error interno en el servidor de demostración académica.',
      message: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  });

  // Mount Vite middlewares in dev mode, or serve static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        if (vite && typeof vite.ssrFixStacktrace === 'function') {
          vite.ssrFixStacktrace(e);
        }
        next(e);
      }
    });
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup failure:', err);
});
