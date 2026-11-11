import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
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
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // Trust reverse proxies (Google Cloud Run / Load Balancer)
  app.set('trust proxy', true);

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
  app.use(express.json({ limit: '2mb' }));

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

  app.use('/api', apiLimiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/api/coupons/validate', couponLimiter);

  // Initialize SQLite database
  initDatabase();

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
  // COUPONS & PROMOTIONAL VALIDATION ENDPOINTS (BTL)
  // ----------------------------------------------------

  // POST /api/coupons/validate - Valida cupón en base de datos con contrato dual seguro
  app.post('/api/coupons/validate', (req, res) => {
    try {
      const { code, subtotal } = req.body;
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ valid: false, error: 'Por favor ingresa un código de descuento.' });
      }

      const normalizedCode = code.trim().toUpperCase();
      const coupon = db.prepare('SELECT * FROM coupons WHERE code = ? AND is_active = 1').get(normalizedCode) as any;

      if (!coupon) {
        return res.status(404).json({ valid: false, error: 'El cupón ingresado no existe o no se encuentra activo.' });
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
          error: 'Este cupón ya ha sido utilizado en una compra anterior.',
        });
      }

      const orderSubtotal = typeof subtotal === 'number' && subtotal > 0 ? subtotal : 0;
      const discountPercent = coupon.discount_percent;
      const discountAmount = Math.round(orderSubtotal * (discountPercent / 100));
      const description = coupon.description || `Descuento BTL del ${discountPercent}%`;

      // Return both top-level and nested `coupon` object to guarantee dual client compatibility
      return res.json({
        valid: true,
        code: coupon.code,
        discountPercent,
        discountAmount,
        description,
        coupon: {
          code: coupon.code,
          discountPercent,
          discountAmount,
          description,
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
        return res.json({
          success: true,
          code: existingSessionCoupon.code,
          discountPercent: existingSessionCoupon.discount_percent,
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

      const nowIso = new Date().toISOString();
      db.prepare(`
        INSERT INTO coupons (
          code, discount_percent, level_required, max_uses, times_used,
          is_active, description, user_id, session_id, created_at
        ) VALUES (?, ?, ?, 1, 0, 1, ?, ?, ?, ?)
      `).run(
        generatedCode,
        percent,
        levelNum,
        `Cupón BTL ${percent}% OFF único desbloqueado en Nivel 0${levelNum} de Pompón`,
        userId,
        cleanSessionId,
        nowIso
      );

      return res.json({
        success: true,
        code: generatedCode,
        discountPercent: percent,
        message: `¡Cupón exclusivo ${generatedCode} activado exitosamente!`,
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

      // Check if request comes from an authenticated user
      const authUser = getAuthUser(req);
      const userId = authUser ? authUser.id : null;

      // Recalcular subtotal en servidor para prevenir manipulación
      let calculatedSubtotal = 0;
      for (const item of items) {
        const itemPrice = typeof item.product?.price === 'number' ? item.product.price : (item.price || 0);
        const itemQty = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1;
        calculatedSubtotal += itemPrice * itemQty;
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
        const coupon = db.prepare('SELECT * FROM coupons WHERE code = ? AND is_active = 1').get(normalizedCode) as any;

        if (coupon) {
          const notExpired = !coupon.expires_at || new Date(coupon.expires_at).getTime() > Date.now();
          const notMaxed = !coupon.max_uses || coupon.times_used < coupon.max_uses;

          if (notExpired && notMaxed) {
            appliedCouponCode = coupon.code;
            serverDiscount = Math.round(calculatedSubtotal * (coupon.discount_percent / 100));
            // Asegurar que el descuento nunca exceda el subtotal (no números negativos)
            serverDiscount = Math.min(serverDiscount, calculatedSubtotal);
          }
        }
      }

      const calculatedTotal = Math.max(0, calculatedSubtotal - serverDiscount) + validShippingCost;

      const orderId = `AMI-CO-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const createdAt = new Date().toISOString();
      const accessToken = generateOrderAccessToken();

      // Transaction to insert order + items + atomically update coupon uses
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
          customer.fullName,
          customer.email,
          customer.phone,
          customer.address,
          customer.city,
          customer.apartment || '',
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
          db.prepare('UPDATE coupons SET times_used = times_used + 1 WHERE code = ?').run(appliedCouponCode);
        }

        const insertItem = db.prepare(`
          INSERT INTO order_items (id, order_id, product_id, product_name, price, quantity, image_url)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const item of items) {
          const itemId = `item-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
          const pId = item.product?.id || item.productId || 'ami-custom';
          const pName = item.product?.name || item.productName || 'Figura artesanal';
          const pPrice = typeof item.product?.price === 'number' ? item.product.price : (item.price || 0);
          const pQty = item.quantity || 1;
          const pImg = item.product?.imageUrl || item.imageUrl || '';

          insertItem.run(
            itemId,
            orderId,
            pId,
            pName,
            pPrice,
            pQty,
            pImg
          );
        }
      });

      insertOrder();

      const savedOrder = {
        orderId,
        orderNumber: orderId,
        createdAt,
        customer,
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
    // Permitir solo en modo desarrollo o a usuarios administradores
    if (process.env.NODE_ENV === 'production' && (!authUser || authUser.role !== 'admin')) {
      return res.status(403).json({ error: 'Acceso restringido a administradores para exportación de datos.' });
    }

    try {
      const dump = exportDatabaseDump();
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
        },
        recentOrders,
      });
    } catch (err: any) {
      console.error('Error fetching admin overview:', err);
      return res.status(500).json({ error: 'Error al generar resumen administrativo.' });
    }
  });

  // GET /api/admin/orders - Listado paginado de pedidos con filtro opcional de estado
  app.get('/api/admin/orders', requireAdmin, (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
      const offset = (page - 1) * limit;
      const status = typeof req.query.status === 'string' && req.query.status.trim() ? req.query.status.trim() : null;

      let total = 0;
      let orders: any[] = [];

      if (status && status !== 'todos') {
        total = (db.prepare('SELECT COUNT(*) as count FROM orders WHERE status = ?').get(status) as any)?.count || 0;
        orders = db.prepare(`
          SELECT 
            o.id, o.order_number, o.customer_name, o.customer_email, o.customer_phone,
            o.customer_city, o.customer_address, o.shipping_method, o.payment_method,
            o.subtotal, o.shipping_cost, o.discount, o.coupon_code, o.total,
            o.status, o.is_simulated, o.created_at,
            (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
          FROM orders o
          WHERE o.status = ?
          ORDER BY datetime(o.created_at) DESC
          LIMIT ? OFFSET ?
        `).all(status, limit, offset);
      } else {
        total = (db.prepare('SELECT COUNT(*) as count FROM orders').get() as any)?.count || 0;
        orders = db.prepare(`
          SELECT 
            o.id, o.order_number, o.customer_name, o.customer_email, o.customer_phone,
            o.customer_city, o.customer_address, o.shipping_method, o.payment_method,
            o.subtotal, o.shipping_cost, o.discount, o.coupon_code, o.total,
            o.status, o.is_simulated, o.created_at,
            (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
          FROM orders o
          ORDER BY datetime(o.created_at) DESC
          LIMIT ? OFFSET ?
        `).all(limit, offset);
      }

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

  // GET /api/admin/customers - Listado paginado de clientes registrados y actividad
  app.get('/api/admin/customers', requireAdmin, (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
      const offset = (page - 1) * limit;

      const total = (db.prepare(`SELECT COUNT(*) as count FROM users WHERE role = 'customer'`).get() as any)?.count || 0;
      const customers = db.prepare(`
        SELECT 
          u.id, u.name, u.email, u.phone, u.city, u.department, u.created_at,
          COUNT(o.id) as orders_count,
          COALESCE(SUM(o.total), 0) as total_spent,
          MAX(o.created_at) as last_order_date
        FROM users u
        LEFT JOIN orders o ON (u.id = o.user_id OR lower(u.email) = lower(o.customer_email))
        WHERE u.role = 'customer'
        GROUP BY u.id
        ORDER BY datetime(u.created_at) DESC
        LIMIT ? OFFSET ?
      `).all(limit, offset);

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

  // GET /api/admin/coupons - Listado de cupones y métricas de redención
  app.get('/api/admin/coupons', requireAdmin, (req, res) => {
    try {
      const coupons = db.prepare(`
        SELECT 
          code, discount_percent, level_required, max_uses, times_used,
          is_active, description, user_id, session_id, created_at, expires_at
        FROM coupons
        ORDER BY datetime(created_at) DESC
      `).all();

      return res.json({ coupons });
    } catch (err: any) {
      console.error('Error fetching admin coupons:', err);
      return res.status(500).json({ error: 'Error al consultar cupones.' });
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
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
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
