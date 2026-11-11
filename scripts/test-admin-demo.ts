/**
 * Test Suite de Verificación Integral: Registro, RBAC y Aprovisionamiento Administrativo Demo (Fase 2F.1.2)
 */

import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

const dbPath = path.resolve(process.cwd(), 'data', 'amigurumis_mariai.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const BASE_URL = 'http://localhost:3000';

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function runTests() {
  console.log('=== TEST SUITE FASE 2F.1.2: VERIFICACIÓN REGISTRO Y ADMIN DEMO ===\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`[PASS] ${msg}`);
      passed++;
    } else {
      console.error(`[FAIL] ${msg}`);
      process.exitCode = 1;
    }
  }

  // 1. Verificación del endpoint de Registro (corrección de encabezados y normalización)
  const testCustomerEmail = `cliente_prueba_${Date.now()}@amigurumismariai.com`;
  const testCustomerPassword = 'ClaveSegura2026!';

  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Cliente de Prueba',
      email: `  ${testCustomerEmail.toUpperCase()}  `, // Test normalization
      password: testCustomerPassword,
      phone: '310 123 4567',
      address: 'Calle 45 # 12-34',
      city: 'Medellín',
      department: 'Antioquia',
    }),
  });

  const regData = await regRes.json();
  assert(regRes.status === 201 && !!regData.token, '1. Registro exitoso vía POST /api/auth/register');
  assert(regData.user?.email === testCustomerEmail.toLowerCase(), '2. Normalización de correo a minúsculas y sin espacios');

  // 2. Verificación de persistencia real en la base de datos activa
  const dbCustomer = db.prepare('SELECT id, name, email, role FROM users WHERE email = ?').get(testCustomerEmail.toLowerCase()) as any;
  assert(!!dbCustomer && dbCustomer.role === 'customer', '3. Usuario persistido inmediatamente en SQLite con rol "customer"');

  // 3. Verificación de rechazo anónimo (HTTP 401)
  const anonRes = await fetch(`${BASE_URL}/api/admin/overview`);
  assert(anonRes.status === 401, '4. Solicitud anónima a /api/admin/overview rechazada con HTTP 401');

  // 4. Verificación de rechazo a cliente estándar (HTTP 403)
  const forbiddenRes = await fetch(`${BASE_URL}/api/admin/overview`, {
    headers: { Authorization: `Bearer ${regData.token}` },
  });
  assert(forbiddenRes.status === 403, '5. Cliente estándar con rol "customer" rechazado con HTTP 403 en /api/admin/overview');

  // 5. Aprovisionamiento seguro de cuenta administrativa demo
  const DEMO_ADMIN_EMAIL = 'admin.demo@amigurumismariai.test';
  const ephemeralDemoPassword = `DemoAdmin_${crypto.randomBytes(8).toString('hex')}!`;
  const demoHash = hashPassword(ephemeralDemoPassword);
  const nowIso = new Date().toISOString();

  // Insertar o actualizar en SQLite activo
  const existingDemo = db.prepare('SELECT id FROM users WHERE email = ?').get(DEMO_ADMIN_EMAIL) as any;
  let demoUserId = existingDemo?.id;

  if (existingDemo) {
    db.prepare("UPDATE users SET password_hash = ?, role = 'admin' WHERE email = ?").run(demoHash, DEMO_ADMIN_EMAIL);
  } else {
    demoUserId = `usr-admin-demo-${Date.now().toString(36)}`;
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, provider, role, created_at)
      VALUES (?, 'Administrador Demo', ?, ?, 'local', 'admin', ?)
    `).run(demoUserId, DEMO_ADMIN_EMAIL, demoHash, nowIso);
  }

  // 6. Verificación de la cuenta demo en la base de datos activa
  const verifiedDemo = db.prepare('SELECT id, name, email, role FROM users WHERE email = ?').get(DEMO_ADMIN_EMAIL) as any;
  assert(verifiedDemo?.role === 'admin', '6. Cuenta administrativa demo existe en DB activa con rol estrictamente "admin"');

  // 7. Autenticación tradicional mediante POST /api/auth/login
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: DEMO_ADMIN_EMAIL,
      password: ephemeralDemoPassword,
    }),
  });

  const loginData = await loginRes.json();
  assert(loginRes.status === 200 && !!loginData.token, '7. Autenticación tradicional exitosa para admin.demo@amigurumismariai.test');
  assert(loginData.user?.role === 'admin', '8. Sesión emitida reconoce rol "admin"');

  const adminToken = loginData.token;

  // 8. Acceso autorizado a endpoints administrativos protegidos
  const adminEndpoints = [
    { ep: 'me', desc: 'Perfil del administrador' },
    { ep: 'overview', desc: 'Resumen global comercial y operativo' },
    { ep: 'orders', desc: 'Listado de órdenes paginadas' },
    { ep: 'customers', desc: 'Directorio de clientes sin datos sensibles' },
    { ep: 'coupons', desc: 'Gestión de cupones BTL' },
    { ep: 'btl/overview', desc: 'Telemetría de juego de Pompón' },
  ];

  for (const item of adminEndpoints) {
    const res = await fetch(`${BASE_URL}/api/admin/${item.ep}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(res.status === 200, `9.${item.ep} Acceso HTTP 200 exitoso a /api/admin/${item.ep} (${item.desc})`);
  }

  // 9. Verificación de no exposición de hashes o tokens en API de clientes
  const custRes = await fetch(`${BASE_URL}/api/admin/customers`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const custData = await custRes.json();
  const hasExposedSecrets = custData.customers?.some((c: any) => c.password_hash || c.password || c.token);
  assert(!hasExposedSecrets, '10. Directorio de clientes sanitizado: sin exposición de hashes ni tokens');

  // 10. Limpieza del usuario de prueba (mantenemos la cuenta demo para que el usuario pueda usarla)
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(dbCustomer.id);
  db.prepare('DELETE FROM users WHERE id = ?').run(dbCustomer.id);

  console.log(`\n=== RESULTADO: ${passed}/${total} PRUEBAS EXITOSAS ===\n`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Error fatal durante suite de pruebas:', err);
  process.exit(1);
});
