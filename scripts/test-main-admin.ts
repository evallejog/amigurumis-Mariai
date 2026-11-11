/**
 * Test Suite: Verificación Integral de Cuenta Administrativa Principal (admin@amigurumismariai.com)
 * y Revocación de Cuenta Demo Expuesta
 */

import Database from 'better-sqlite3';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const dbPath = path.resolve(process.cwd(), 'data', 'amigurumis_mariai.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const BASE_URL = 'http://localhost:3000';
const ADMIN_EMAIL = 'admin@amigurumismariai.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

async function runTests() {
  console.log('======================================================================');
  console.log('TEST SUITE: CUENTA ADMINISTRATIVA PRINCIPAL Y REVOCACIÓN DE DEMO');
  console.log('======================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${msg}`);
      process.exitCode = 1;
    }
  }

  if (!ADMIN_PASSWORD) {
    console.error('ERROR: ADMIN_PASSWORD no está definida en .env.');
    process.exit(1);
  }

  // 1. Rechazo con contraseña errónea
  const resBadPass = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: 'WrongPassword123!' }),
  });
  assert(resBadPass.status === 401, '1. Rechazo HTTP 401 para intento con contraseña incorrecta en admin@amigurumismariai.com');

  // 2. Login exitoso con credenciales válidas
  const resLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  assert(resLogin.status === 200, '2. Inicio de sesión exitoso (HTTP 200) para admin@amigurumismariai.com');

  const loginData = await resLogin.json();
  const adminToken = loginData.token;
  assert(Boolean(adminToken && adminToken.startsWith('sess-')), '3. Emisión de token de sesión cryptográfico (sess-*)');
  assert(loginData.user?.role === 'admin', '4. Rol emitido en login es estrictamente "admin"');
  assert(loginData.user?.name === 'Administrador Mariai', '5. Nombre de cuenta verificado: "Administrador Mariai"');

  // 3. Verificación de endpoint /api/admin/me
  const resMe = await fetch(`${BASE_URL}/api/admin/me`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(resMe.status === 200, '6. Acceso autorizado a /api/admin/me (HTTP 200)');
  const meData = await resMe.json();
  assert(meData.user?.email === ADMIN_EMAIL && meData.user?.role === 'admin', '7. Verificación de identidad administrativa en /api/admin/me');

  // 4. Verificación de endpoints administrativos operativos
  const endpoints = ['overview', 'orders', 'customers', 'coupons', 'btl/overview'];
  for (const ep of endpoints) {
    const res = await fetch(`${BASE_URL}/api/admin/${ep}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(res.status === 200, `8.${ep} Acceso HTTP 200 concedido a /api/admin/${ep}`);
  }

  // 5. Restricción para usuarios normales (403 Forbidden)
  const custLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'maria@amigurumismariai.com', password: 'Mariai2026!' }),
  });
  const custData = await custLogin.json();
  const custToken = custData.token;
  assert(Boolean(custToken), '9. Login exitoso de cliente estándar (maria@amigurumismariai.com)');

  const resCustForbidden = await fetch(`${BASE_URL}/api/admin/overview`, {
    headers: { Authorization: `Bearer ${custToken}` },
  });
  assert(resCustForbidden.status === 403, '10. Cliente estándar recibe estrictamente HTTP 403 Forbidden');

  // 6. Restricción para anónimos (401 Unauthorized)
  const resAnon = await fetch(`${BASE_URL}/api/admin/overview`);
  assert(resAnon.status === 401, '11. Usuario anónimo recibe HTTP 401 Unauthorized');

  // 7. Revocación de cuenta demo previa (admin.demo@amigurumismariai.test)
  console.log('\n--- Revocando cuenta demo expuesta (admin.demo@amigurumismariai.test) ---');
  const demoEmail = 'admin.demo@amigurumismariai.test';
  const demoUser = db.prepare('SELECT id FROM users WHERE email = ?').get(demoEmail) as any;
  if (demoUser) {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(demoUser.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(demoUser.id);
    console.log('  [INFO] Cuenta demo y sus sesiones eliminadas de SQLite.');
  }

  // Verificar que la cuenta demo ya no existe en SQLite
  const demoCheck = db.prepare('SELECT id FROM users WHERE email = ?').get(demoEmail);
  assert(demoCheck === undefined, '12. Cuenta demo eliminada de la base de datos');

  // Verificar que el login con la cuenta demo es rechazado
  const resDemoLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: demoEmail, password: 'AdminDemo2026!' }),
  });
  assert(resDemoLogin.status === 401, '13. Intento de inicio de sesión con cuenta demo revocada es rechazado (HTTP 401)');

  // 8. Verificar que el correo personal del propietario NO está en rol admin
  const ownerUser = db.prepare('SELECT id, role FROM users WHERE email = ?').get('charlesvalle2006@gmail.com') as any;
  assert(!ownerUser || ownerUser.role !== 'admin', '14. Correo personal del propietario no está configurado como admin');

  console.log('\n======================================================================');
  console.log(`RESUMEN: ${passed}/${total} PRUEBAS COMPLETADAS EXITOSAMENTE`);
  console.log('======================================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Error fatal durante suite de pruebas:', err);
  process.exit(1);
});
