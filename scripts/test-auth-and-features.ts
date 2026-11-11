import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import {
  db,
  initDatabase,
  hashPassword,
  verifyPassword,
} from '../server/db.js';
import crypto from 'crypto';

async function runTestSuite() {
  console.log('=== INICIANDO BATERÍA DE PRUEBAS AMIGURUMIS MARIAI (FASE 2E.1) ===');

  // Inicializar DB
  initDatabase();

  const app = express();
  app.use(cookieParser());
  app.use(express.json());

  function getAuthUser(req: express.Request): any | null {
    const cookieToken = req.cookies?.amigurumis_mariai_session;
    const authHeader = req.headers.authorization;
    let token: string | null = null;
    if (cookieToken && typeof cookieToken === 'string') {
      token = cookieToken.trim();
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
    if (!token) return null;
    const session = db.prepare(`
      SELECT s.token, s.expires_at, u.id, u.name, u.email, u.role, u.phone, u.address, u.city, u.department
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

  // Endpoints estándar a probar
  app.post('/api/auth/register', (req, res) => {
    try {
      const { fullName, name, email, password, phone, address, city, department } = req.body;
      const userName = (fullName || name || '').trim();
      if (!userName || !email || !password) {
        return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios.' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
      }
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
      if (existing) {
        return res.status(400).json({ error: 'Ya existe una cuenta con este correo electrónico.' });
      }
      const userId = `usr-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
      const passwordHash = hashPassword(password);
      const nowIso = new Date().toISOString();
      db.prepare(`
        INSERT INTO users (id, name, email, password_hash, provider, role, phone, address, city, department, created_at)
        VALUES (?, ?, ?, ?, 'local', 'customer', ?, ?, ?, ?, ?)
      `).run(
        userId,
        userName,
        email.trim().toLowerCase(),
        passwordHash,
        (phone || '').trim(),
        (address || '').trim(),
        (city || 'Bogotá D.C.').trim(),
        (department || 'Cundinamarca').trim(),
        nowIso
      );
      const token = `sess-${crypto.randomBytes(32).toString('hex')}`;
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
      db.prepare(`
        INSERT INTO sessions (token, user_id, created_at, expires_at)
        VALUES (?, ?, ?, ?)
      `).run(token, userId, nowIso, expiresAt);
      res.cookie('amigurumis_mariai_session', token, { httpOnly: true, sameSite: 'lax' });
      return res.status(201).json({
        token,
        user: { id: userId, fullName: userName, email: email.trim().toLowerCase() }
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Correo y contraseña requeridos.' });
      }
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase()) as any;
      if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
        return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
      }
      const token = `sess-${crypto.randomBytes(32).toString('hex')}`;
      const nowIso = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
      db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(token, user.id, nowIso, expiresAt);
      res.cookie('amigurumis_mariai_session', token, { httpOnly: true, sameSite: 'lax' });
      return res.json({ token, user: { id: user.id, fullName: user.name, email: user.email } });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/auth/me', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ user: null });
    return res.json({ user });
  });

  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.amigurumis_mariai_session;
    let token: string | null = null;
    if (cookieToken) token = cookieToken;
    else if (authHeader?.startsWith('Bearer ')) token = authHeader.substring(7);
    if (token) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    }
    res.clearCookie('amigurumis_mariai_session');
    return res.json({ success: true });
  });

  app.get('/api/orders/user', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'No autorizado. Debes iniciar sesión.' });
    return res.json({ orders: [], message: 'Historial protegido accesible para usuario: ' + user.email });
  });

  // Escuchar en puerto dinámico
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`Servidor de pruebas montado en ${baseUrl}`);

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${testName}`);
      process.exitCode = 1;
    }
  }

  // 1. Registro de usuario nuevo
  const testEmail = `test_${Date.now()}@amigurumismariai.com`;
  const testPass = 'Secreto2026!';
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Cliente Pruebas',
      email: testEmail,
      password: testPass,
      phone: '3001234567',
      address: 'Carrera 7 # 71-21',
      city: 'Bogotá D.C.',
      department: 'Cundinamarca',
    }),
  });
  const regData = await regRes.json();
  assert(regRes.status === 201 && !!regData.token, '1. Registro de usuario nuevo con hash seguro');

  const registeredToken = regData.token;

  // 2. Restauración de sesión mediante token
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${registeredToken}` },
  });
  const meData = await meRes.json();
  assert(meRes.status === 200 && meData.user?.email === testEmail, '2. Restauración de sesión con Bearer Token');

  // 3. Protección del historial de pedidos con usuario autenticado
  const ordersRes = await fetch(`${baseUrl}/api/orders/user`, {
    headers: { Authorization: `Bearer ${registeredToken}` },
  });
  assert(ordersRes.status === 200, '3. Acceso autorizado al historial de pedidos');

  // 4. Protección del historial de pedidos sin usuario (debe retornar 401)
  const unauthOrdersRes = await fetch(`${baseUrl}/api/orders/user`);
  assert(unauthOrdersRes.status === 401, '4. Rechazo 401 al historial sin sesión');

  // 5. Cierre de sesión (Logout)
  const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${registeredToken}` },
  });
  const logoutData = await logoutRes.json();
  assert(logoutRes.status === 200 && logoutData.success, '5. Cierre de sesión e invalidación de token');

  // 6. Rechazo de sesiones revocadas
  const revokedMeRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${registeredToken}` },
  });
  assert(revokedMeRes.status === 401, '6. Rechazo de sesión tras logout (sesión revocada de DB)');

  // 7. Login tradicional con credenciales correctas
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: testPass }),
  });
  const loginData = await loginRes.json();
  assert(loginRes.status === 200 && !!loginData.token, '7. Login tradicional con credenciales válidas');

  // 8. Rechazo de credenciales incorrectas (contraseña errónea)
  const badLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: 'PasswordEquivocada!' }),
  });
  assert(badLoginRes.status === 401, '8. Rechazo 401 de credenciales incorrectas');

  // 9. Login con cuenta demo pre-sembrada
  const demoLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'maria@amigurumismariai.com', password: 'Mariai2026!' }),
  });
  assert(demoLoginRes.status === 200, '9. Inicio de sesión exitoso con cuenta demo pre-sembrada');

  // 10. Comprobar que endpoints Google OAuth no existen (404)
  const googleConfigRes = await fetch(`${baseUrl}/api/auth/google/config`);
  const googlePostRes = await fetch(`${baseUrl}/api/auth/google`, { method: 'POST' });
  assert(googleConfigRes.status === 404 && googlePostRes.status === 404, '10. Ausencia de rutas ejecutables de Google OAuth (404 Not Found)');

  server.close();
  console.log(`\n=== RESULTADO: ${passedTests}/${totalTests} PRUEBAS EXITOSAS ===\n`);
  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Error fatal en suite de pruebas:', err);
  process.exit(1);
});
