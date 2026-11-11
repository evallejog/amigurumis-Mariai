/**
 * Suite de pruebas automatizadas: Autorización Administrativa y Endpoints /api/admin/* (Fase 2F.1)
 */

import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'data', 'amigurumis_mariai.db');
const db = new Database(dbPath);

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('=== INICIANDO PRUEBAS DE AUTORIZACIÓN Y ENDPOINTS ADMINISTRATIVOS ===\n');

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

  // 1. Rechazo de usuario anónimo (sin token / sesión) en /api/admin/overview (401)
  const anonRes = await fetch(`${BASE_URL}/api/admin/overview`);
  assert(anonRes.status === 401, '1. Rechazo HTTP 401 para solicitudes anónimas a /api/admin/overview');

  // 2. Rechazo de usuario anónimo en todos los demás endpoints /api/admin/*
  const endpoints = ['me', 'orders', 'customers', 'coupons', 'btl/overview'];
  for (const ep of endpoints) {
    const res = await fetch(`${BASE_URL}/api/admin/${ep}`);
    assert(res.status === 401, `2.${ep} Rechazo HTTP 401 anónimo en /api/admin/${ep}`);
  }

  // 3. Crear o autenticar un usuario con rol 'customer'
  const customerEmail = `customer_test_${Date.now()}@amigurumismariai.com`;
  const customerPass = 'PruebaCliente2026!';

  const regCustomerRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Cliente No Admin',
      email: customerEmail,
      password: customerPass,
      phone: '3009998877',
      address: 'Calle 100 # 15-20',
      city: 'Bogotá D.C.',
      department: 'Cundinamarca',
    }),
  });
  const regCustomerData = await regCustomerRes.json();
  const customerToken = regCustomerData.token;

  assert(regCustomerRes.status === 201 && !!customerToken, '3. Registro exitoso de usuario estándar');

  // 4. Verificar que el rol en DB sea estrictamente 'customer'
  const dbUser = db.prepare('SELECT role FROM users WHERE email = ?').get(customerEmail) as any;
  assert(dbUser?.role === 'customer', '4. Verificación de rol estrictamente "customer" asignado por defecto');

  // 5. Rechazo HTTP 403 para usuario cliente normal intentando acceder a /api/admin/overview
  const forbiddenRes = await fetch(`${BASE_URL}/api/admin/overview`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert(forbiddenRes.status === 403, '5. Rechazo HTTP 403 para usuario cliente normal en /api/admin/overview');

  for (const ep of endpoints) {
    const res = await fetch(`${BASE_URL}/api/admin/${ep}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(res.status === 403, `6.${ep} Rechazo HTTP 403 para usuario cliente normal en /api/admin/${ep}`);
  }

  // 7. Promover un usuario a 'admin' para probar el acceso autorizado
  const adminEmail = `admin_test_${Date.now()}@amigurumismariai.com`;
  const adminPass = 'ClaveAdmin2026!';

  const regAdminRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Super Administrador',
      email: adminEmail,
      password: adminPass,
      phone: '3112223344',
      city: 'Medellín',
      department: 'Antioquia',
    }),
  });
  const regAdminData = await regAdminRes.json();
  const adminToken = regAdminData.token;

  // Promover de forma segura en la base de datos (emulando scripts/manage-admin.ts)
  db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(adminEmail);

  // 8. Acceso autorizado a /api/admin/me
  const adminMeRes = await fetch(`${BASE_URL}/api/admin/me`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const adminMeData = await adminMeRes.json();
  assert(adminMeRes.status === 200 && adminMeData.user?.role === 'admin', '8. Acceso autorizado HTTP 200 a /api/admin/me con rol admin');

  // 9. Acceso autorizado a /api/admin/overview y datos reales
  const overviewRes = await fetch(`${BASE_URL}/api/admin/overview`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const overviewData = await overviewRes.json();
  assert(
    overviewRes.status === 200 &&
    typeof overviewData.overview?.totalOrders === 'number' &&
    typeof overviewData.overview?.totalRevenue === 'number' &&
    Array.isArray(overviewData.recentOrders),
    '9. Acceso y esquema válido de datos en /api/admin/overview'
  );

  // 10. Acceso a /api/admin/orders con paginación
  const ordersRes = await fetch(`${BASE_URL}/api/admin/orders?page=1&limit=5`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const ordersData = await ordersRes.json();
  assert(
    ordersRes.status === 200 &&
    Array.isArray(ordersData.orders) &&
    ordersData.pagination?.page === 1 &&
    ordersData.pagination?.limit === 5,
    '10. Paginación y listado de órdenes en /api/admin/orders'
  );

  // 11. Acceso a /api/admin/customers y ausencia de datos sensibles
  const custRes = await fetch(`${BASE_URL}/api/admin/customers?page=1&limit=5`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const custData = await custRes.json();
  const hasSensitiveData = custData.customers?.some((c: any) => c.password_hash || c.password || c.token);
  assert(
    custRes.status === 200 &&
    Array.isArray(custData.customers) &&
    !hasSensitiveData,
    '11. Listado de clientes en /api/admin/customers sin datos sensibles (sin hashes ni tokens)'
  );

  // 12. Acceso a /api/admin/coupons
  const couponsRes = await fetch(`${BASE_URL}/api/admin/coupons`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const couponsData = await couponsRes.json();
  assert(
    couponsRes.status === 200 &&
    Array.isArray(couponsData.coupons) &&
    couponsData.coupons.length > 0,
    '12. Listado de cupones reales en /api/admin/coupons'
  );

  // 13. Acceso a /api/admin/btl/overview
  const btlRes = await fetch(`${BASE_URL}/api/admin/btl/overview`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const btlData = await btlRes.json();
  assert(
    btlRes.status === 200 &&
    typeof btlData.summary?.totalGameRuns === 'number' &&
    Array.isArray(btlData.levelStats),
    '13. Telemetría de juego BTL en /api/admin/btl/overview'
  );

  // Limpiar usuarios temporales creados para la prueba
  db.prepare('DELETE FROM users WHERE email IN (?, ?)').run(customerEmail, adminEmail);

  console.log(`\n=== RESULTADO: ${passed}/${total} PRUEBAS EXITOSAS ===\n`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Error fatal durante pruebas administrativas:', err);
  process.exit(1);
});
