/**
 * Automated Test Suite - Phase 2F.2: Administrative Activation & Operative Management
 * Amigurumis Mariai
 */
import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const DB_PATH = path.join(process.cwd(), 'data', 'amigurumis_mariai.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

async function runTestSuite() {
  console.log('====================================================');
  console.log('TEST SUITE: FASE 2F.2 - GESTIÓN ADMINISTRATIVA OPERATIVA');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${desc}`);
      failed++;
    }
  }

  const BASE_URL = 'http://localhost:3000';

  // Helper to login and get token
  async function login(email: string, pass: string): Promise<string | null> {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.token;
  }

  // 1. Authenticated admin login
  console.log('\n--- 1. Pruebas de Autenticación y Autorización RBAC ---');
  const adminEmail = 'admin@amigurumismariai.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'MariaiAdmin2026!#Sec';
  const adminToken = await login(adminEmail, adminPassword);
  assert(Boolean(adminToken), '1. Login de cuenta administradora activa (admin@amigurumismariai.com)');

  const resAdminMe = await fetch(`${BASE_URL}/api/admin/me`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(resAdminMe.status === 200, '2. GET /api/admin/me retorna HTTP 200 para administrador');
  const adminMeData = await resAdminMe.json();
  assert(adminMeData.user?.role === 'admin', '3. Rol de usuario en /api/admin/me es "admin"');

  // Customer authorization (403)
  const custToken = await login('maria@amigurumismariai.com', 'Mariai2026!');
  assert(Boolean(custToken), '4. Login de cliente estándar de demostración (maria@amigurumismariai.com)');

  const resCustAdminMe = await fetch(`${BASE_URL}/api/admin/me`, {
    headers: { Authorization: `Bearer ${custToken}` },
  });
  assert(resCustAdminMe.status === 403, '5. Cliente estándar recibe HTTP 403 Forbidden en ruta administrativa');

  // Anonymous authorization (401)
  const resAnonAdminMe = await fetch(`${BASE_URL}/api/admin/me`);
  assert(resAnonAdminMe.status === 401, '6. Usuario anónimo recibe HTTP 401 Unauthorized en ruta administrativa');

  // 2. Operative Order Management & State Machine
  console.log('\n--- 2. Pruebas de Transiciones de Estado y Auditoría de Pedidos ---');

  // Create a test order in SQLite to test transitions
  const testOrderId = `test-ord-${Date.now()}`;
  const testOrderNumber = `TEST-${Date.now().toString().slice(-6)}`;
  db.prepare(`
    INSERT INTO orders (
      id, order_number, user_id, customer_name, customer_email, customer_phone,
      customer_address, customer_city, customer_apartment, shipping_method, payment_method,
      subtotal, shipping_cost, discount, total, status, is_simulated, access_token, created_at
    ) VALUES (?, ?, null, 'Cliente Prueba F2F2', 'cliente.prueba@test.com', '3001234567',
      'Calle 100 #15-20', 'Bogotá D.C.', 'Apto 301', 'standard', 'nequi',
      55000, 12000, 0, 67000, 'pedido_recibido', 1, 'token-f2f2-123', ?
    )
  `).run(testOrderId, testOrderNumber, new Date().toISOString());

  // Test invalid transition (skipping state: pedido_recibido -> entregado)
  const resInvalidTrans = await fetch(`${BASE_URL}/api/admin/orders/${testOrderId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ status: 'entregado', notes: 'Salto inválido' }),
  });
  assert(resInvalidTrans.status === 400, '7. Rechazo de salto inválido de estado (pedido_recibido -> entregado retorna HTTP 400)');

  // Step 1: pedido_recibido -> en_preparacion
  const resTrans1 = await fetch(`${BASE_URL}/api/admin/orders/${testOrderId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ status: 'en_preparacion', notes: 'Empaque de amigurumi en curso en taller' }),
  });
  assert(resTrans1.status === 200, '8. Transición válida 1: pedido_recibido -> en_preparacion (HTTP 200)');

  // Step 2: en_preparacion -> enviado
  const resTrans2 = await fetch(`${BASE_URL}/api/admin/orders/${testOrderId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ status: 'enviado', notes: 'Despachado con guía de mensajería urbana' }),
  });
  assert(resTrans2.status === 200, '9. Transición válida 2: en_preparacion -> enviado (HTTP 200)');

  // Step 3: enviado -> entregado
  const resTrans3 = await fetch(`${BASE_URL}/api/admin/orders/${testOrderId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ status: 'entregado', notes: 'Entregado a conformidad al destinatario' }),
  });
  assert(resTrans3.status === 200, '10. Transición válida 3: enviado -> entregado (HTTP 200)');

  // Step 4: entregado -> any (terminal state rejection)
  const resTransTerminal = await fetch(`${BASE_URL}/api/admin/orders/${testOrderId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ status: 'en_preparacion', notes: 'Intento de modificar orden finalizada' }),
  });
  assert(resTransTerminal.status === 400, '11. Rechazo de modificación en estado terminal (entregado -> en_preparacion retorna HTTP 400)');

  // Audit history verification
  const resHistory = await fetch(`${BASE_URL}/api/admin/orders/${testOrderId}/history`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(resHistory.status === 200, '12. GET /api/admin/orders/:id/history retorna HTTP 200');
  const historyData = await resHistory.json();
  assert(Array.isArray(historyData.history) && historyData.history.length === 3, '13. Tabla order_status_history contiene exactamente los 3 registros auditados');
  assert(historyData.history[0]?.admin_email === adminEmail, '14. Registro de auditoría identifica correctamente el correo del administrador ejecutante (admin@amigurumismariai.com)');

  // 3. Commercial Coupon Management
  console.log('\n--- 3. Pruebas de Gestión de Cupones Comerciales y Protección BTL ---');

  const testCouponCode = `PROMO${Date.now().toString().slice(-5)}`;

  // Create commercial coupon
  const resCreateCoupon = await fetch(`${BASE_URL}/api/admin/coupons`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      code: testCouponCode,
      discountPercent: 15,
      maxUses: 50,
      description: 'Cupón comercial de prueba automatizada',
      isActive: true,
    }),
  });
  assert(resCreateCoupon.status === 201, '15. Creación exitosa de cupón comercial (POST /api/admin/coupons retorna HTTP 201)');
  const createdCouponData = await resCreateCoupon.json();
  assert(createdCouponData.coupon?.coupon_type === 'commercial', '16. Cupón creado categorizado explícitamente como "commercial"');

  // Duplicate rejection
  const resDupCoupon = await fetch(`${BASE_URL}/api/admin/coupons`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      code: testCouponCode,
      discountPercent: 20,
    }),
  });
  assert(resDupCoupon.status === 409, '17. Rechazo de cupón duplicado (retorna HTTP 409 Conflict)');

  // Invalid discount percent (<1 or >90)
  const resBadDiscount = await fetch(`${BASE_URL}/api/admin/coupons`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      code: `BAD${Date.now().toString().slice(-4)}`,
      discountPercent: 99,
    }),
  });
  assert(resBadDiscount.status === 400, '18. Rechazo de descuento fuera de rango (99% retorna HTTP 400)');

  // Reserved BTL prefix protection
  const resReservedPrefix = await fetch(`${BASE_URL}/api/admin/coupons`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      code: 'MARIAI-FAKE01',
      discountPercent: 20,
    }),
  });
  assert(resReservedPrefix.status === 400, '19. Rechazo de creación comercial con prefijo reservado "MARIAI-" (HTTP 400)');

  // Toggle active/inactive
  const resToggleCoupon = await fetch(`${BASE_URL}/api/admin/coupons/${testCouponCode}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ isActive: false }),
  });
  assert(resToggleCoupon.status === 200, '20. Desactivación de cupón comercial (PATCH /api/admin/coupons/:code retorna HTTP 200)');
  const couponInDb = db.prepare('SELECT is_active FROM coupons WHERE code = ?').get(testCouponCode) as any;
  assert(couponInDb?.is_active === 0, '21. Estado inactivo verificado directamente en SQLite');

  // Protect BTL coupon from discount alteration
  const btlCoupon = db.prepare("SELECT code FROM coupons WHERE coupon_type = 'btl' OR level_required IS NOT NULL LIMIT 1").get() as any;
  if (btlCoupon) {
    const resAlterBtl = await fetch(`${BASE_URL}/api/admin/coupons/${btlCoupon.code}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ discountPercent: 80 }),
    });
    assert(resAlterBtl.status === 403, '22. Protección estricta: intento de alterar descuento de cupón BTL retorna HTTP 403 Forbidden');
  }

  // 4. Parameterized Search and Filter Endpoints
  console.log('\n--- 4. Pruebas de Búsqueda Parametrizada y Filtros ---');

  const resOrderFilter = await fetch(`${BASE_URL}/api/admin/orders?search=${testOrderNumber}&status=entregado`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(resOrderFilter.status === 200, '23. Consulta parametrizada de pedidos con search y status retorna HTTP 200');
  const orderFilterData = await resOrderFilter.json();
  assert(orderFilterData.orders.some((o: any) => o.order_number === testOrderNumber), '24. El pedido de prueba fue filtrado y retornado exitosamente');

  const resCustFilter = await fetch(`${BASE_URL}/api/admin/customers?search=maria`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(resCustFilter.status === 200, '25. Consulta parametrizada de clientes con search retorna HTTP 200');
  const custFilterData = await resCustFilter.json();
  assert(custFilterData.customers.some((c: any) => c.email.includes('maria')), '26. Cliente encontrado con filtro de búsqueda por nombre/correo');

  // Clean up test order and coupon
  db.prepare('DELETE FROM order_status_history WHERE order_id = ?').run(testOrderId);
  db.prepare('DELETE FROM orders WHERE id = ?').run(testOrderId);
  db.prepare('DELETE FROM coupons WHERE code = ?').run(testCouponCode);

  console.log('\n====================================================');
  console.log(`RESUMEN DE PRUEBAS: ${passed} PASADAS | ${failed} FALLIDAS`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Error fatal ejecutando test suite:', err);
  process.exit(1);
});
