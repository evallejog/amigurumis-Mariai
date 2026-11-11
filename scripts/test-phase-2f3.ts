/**
 * Automated Test Suite - Phase 2F.3: Personalized Coupons & BTL Rewards
 * Amigurumis Mariai
 */
import Database from 'better-sqlite3';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const DB_PATH = path.join(process.cwd(), 'data', 'amigurumis_mariai.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

async function runTestSuite() {
  console.log('================================================================');
  console.log('TEST SUITE: FASE 2F.3 - SISTEMA DE CUPONES PERSONALIZADOS Y BTL');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string, details?: any) {
    if (condition) {
      console.log(`  [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${desc}`, details ? details : '');
      failed++;
    }
  }

  const BASE_URL = 'http://localhost:3000';

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

  const adminEmail = 'admin@amigurumismariai.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const adminToken = await login(adminEmail, adminPassword);

  // 1. Registro e inicio de sesión
  console.log('\n--- 1. Registro e inicio de sesión ---');
  const testCustomerEmail1 = `cliente.f2f3.a.${Date.now()}@test.com`;
  const testCustomerEmail2 = `cliente.f2f3.b.${Date.now()}@test.com`;

  const regRes1 = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Cliente Prueba 2F3 A',
      email: testCustomerEmail1,
      password: 'Password123!',
      phone: '3001112233',
      address: 'Calle 100 #20-30',
      city: 'Medellín, Antioquia',
    }),
  });
  assert(regRes1.status === 201, '1. Registro exitoso de usuario cliente A en SQLite');
  const regData1 = await regRes1.json();
  const tokenCustomerA = regData1.token;
  const userIdA = regData1.user.id;

  const regRes2 = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Cliente Prueba 2F3 B',
      email: testCustomerEmail2,
      password: 'Password123!',
      phone: '3004445566',
      address: 'Carrera 7 #40-50',
      city: 'Bogotá D.C.',
    }),
  });
  assert(regRes2.status === 201, '2. Registro exitoso de usuario cliente B en SQLite');
  const regData2 = await regRes2.json();
  const tokenCustomerB = regData2.token;
  const userIdB = regData2.user.id;

  // 2. RBAC administrativo
  console.log('\n--- 2. Control de Acceso RBAC Administrativo ---');
  assert(Boolean(adminToken), '3. Administrador principal autenticado exitosamente');
  const resCustAdminAccess = await fetch(`${BASE_URL}/api/admin/coupons`, {
    headers: { Authorization: `Bearer ${tokenCustomerA}` },
  });
  assert(resCustAdminAccess.status === 403, '4. Cliente común rechazado con HTTP 403 en ruta administrativa /api/admin/coupons');

  const resAdminAccess = await fetch(`${BASE_URL}/api/admin/coupons`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(resAdminAccess.status === 200, '5. Administrador autorizado con HTTP 200 en /api/admin/coupons');

  // 3. Creación de cupón comercial general
  console.log('\n--- 3. Creación y Validación de Cupón Comercial General ---');
  const genCouponCode = `PROMO-GEN-${Date.now().toString().slice(-5)}`;
  const resCreateGen = await fetch(`${BASE_URL}/api/admin/coupons`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      code: genCouponCode,
      discountPercent: 20,
      targetType: 'general',
      maxUses: 100,
      description: 'Promoción general 20% OFF para todos los clientes',
    }),
  });
  assert(resCreateGen.status === 201, '6. Cupón comercial general creado exitosamente (HTTP 201)');
  const createGenData = await resCreateGen.json();
  assert(createGenData.coupon.coupon_type === 'commercial_general', '7. Tipo asignado correctamente como commercial_general');

  // 4. Creación de cupón exclusivo para usuario específico
  console.log('\n--- 4. Creación de Cupón Exclusivo para Usuario ---');
  const exclCouponCode = `EXCL-USRA-${Date.now().toString().slice(-5)}`;
  const resCreateExcl = await fetch(`${BASE_URL}/api/admin/coupons`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      code: exclCouponCode,
      discountPercent: 25,
      targetType: 'exclusive',
      userId: userIdA,
      maxUses: 1,
      description: 'Cupón exclusivo 25% OFF para Cliente A',
    }),
  });
  assert(resCreateExcl.status === 201, '8. Cupón exclusivo creado exitosamente para Cliente A (HTTP 201)');
  const createExclData = await resCreateExcl.json();
  assert(createExclData.coupon.user_id === userIdA, '9. Cupón exclusivo vinculado al user_id de Cliente A');

  // 5. Rechazo de usuario inexistente para cupón exclusivo
  console.log('\n--- 5. Rechazos de Validación de Creación ---');
  const resNonExistentUser = await fetch(`${BASE_URL}/api/admin/coupons`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      code: `FAIL-NOUSER-${Date.now().toString().slice(-4)}`,
      discountPercent: 15,
      targetType: 'exclusive',
      userId: 'usr-inexistente-999',
    }),
  });
  assert(resNonExistentUser.status === 400, '10. Rechazo de cupón exclusivo con usuario inexistente (HTTP 400)');

  // 6. Rechazo de porcentaje inválido
  const resInvalidPercent = await fetch(`${BASE_URL}/api/admin/coupons`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      code: `FAIL-PCT-${Date.now().toString().slice(-4)}`,
      discountPercent: 99, // superior al 90%
      targetType: 'general',
    }),
  });
  assert(resInvalidPercent.status === 400, '11. Rechazo de porcentaje de descuento mayor a 90% (HTTP 400)');

  // 7. Rechazo de código duplicado
  const resDupCode = await fetch(`${BASE_URL}/api/admin/coupons`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      code: genCouponCode, // ya existente
      discountPercent: 10,
      targetType: 'general',
    }),
  });
  assert(resDupCode.status === 409, '12. Rechazo de código duplicado con HTTP 409 Conflict');

  // 8. Activación y desactivación administrativa
  console.log('\n--- 8. Activación y Desactivación de Cupones ---');
  const resDeactivate = await fetch(`${BASE_URL}/api/admin/coupons/${genCouponCode}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ isActive: false }),
  });
  assert(resDeactivate.status === 200, '13. Desactivación de cupón por administrador (HTTP 200)');

  // 9. Rechazo de cupón desactivado en validación
  const resValInactive = await fetch(`${BASE_URL}/api/coupons/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: genCouponCode, subtotal: 50000 }),
  });
  const valInactiveData = await resValInactive.json();
  assert(valInactiveData.valid === false, '14. Cupón desactivado rechazado en /api/coupons/validate (valid: false)');

  // Reactivar para siguientes pruebas
  await fetch(`${BASE_URL}/api/admin/coupons/${genCouponCode}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ isActive: true }),
  });

  // 10. Rechazo de cupón vencido
  console.log('\n--- 10. Control de Vencimiento y Límites ---');
  const expCode = `EXP-${Date.now().toString().slice(-5)}`;
  // Insertar directamente cupón con fecha vencida en SQLite
  db.prepare(`
    INSERT INTO coupons (code, discount_percent, coupon_type, target_type, max_uses, times_used, expires_at, is_active, description, created_at)
    VALUES (?, 15, 'commercial_general', 'general', 10, 0, '2020-01-01T00:00:00.000Z', 1, 'Cupón vencido', ?)
  `).run(expCode, new Date().toISOString());

  const resValExpired = await fetch(`${BASE_URL}/api/coupons/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: expCode, subtotal: 40000 }),
  });
  const valExpData = await resValExpired.json();
  assert(valExpData.valid === false, '15. Cupón con fecha de vencimiento expirada es rechazado');

  // 11. Rechazo de cupón agotado (límite de usos alcanzado)
  const exhaustedCode = `AGOTADO-${Date.now().toString().slice(-4)}`;
  db.prepare(`
    INSERT INTO coupons (code, discount_percent, coupon_type, target_type, max_uses, times_used, is_active, description, created_at)
    VALUES (?, 10, 'commercial_general', 'general', 3, 3, 1, 'Cupón agotado', ?)
  `).run(exhaustedCode, new Date().toISOString());

  const resValExhausted = await fetch(`${BASE_URL}/api/coupons/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: exhaustedCode, subtotal: 30000 }),
  });
  const valExhaustedData = await resValExhausted.json();
  assert(valExhaustedData.valid === false, '16. Cupón con usos agotados (3/3) es rechazado');

  // 12. Rechazo de cupón exclusivo utilizado por otro cliente o anónimo
  console.log('\n--- 12. Exclusividad de Cupones entre Usuarios ---');
  // Usuario B intenta validar el cupón exclusivo de Usuario A
  const resValOtherUser = await fetch(`${BASE_URL}/api/coupons/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCustomerB}`,
    },
    body: JSON.stringify({ code: exclCouponCode, subtotal: 60000 }),
  });
  assert(resValOtherUser.status === 403, '17. Intento de Cliente B de validar cupón exclusivo de Cliente A retorna HTTP 403 Forbidden');

  // Usuario no autenticado intenta validar cupón exclusivo
  const resValAnonExcl = await fetch(`${BASE_URL}/api/coupons/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: exclCouponCode, subtotal: 60000 }),
  });
  assert(resValAnonExcl.status === 403, '18. Usuario anónimo intentando validar cupón exclusivo retorna HTTP 403 Forbidden');

  // Usuario A (legítimo propietario) valida su cupón exclusivo
  const resValOwner = await fetch(`${BASE_URL}/api/coupons/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCustomerA}`,
    },
    body: JSON.stringify({ code: exclCouponCode, subtotal: 60000 }),
  });
  assert(resValOwner.status === 200, '19. Cliente A (propietario) valida exitosamente su cupón exclusivo');

  // 13. Emisión de recompensa BTL para jugador
  console.log('\n--- 13. Recompensas BTL y Gamificación ---');
  // Iniciar sesión de juego válida
  const resStartGame = await fetch(`${BASE_URL}/api/btl/session/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCustomerA}`,
    },
    body: JSON.stringify({ level: 1 }),
  });
  const gameSessData = await resStartGame.json();
  const btlSessionId = gameSessData.sessionId;
  assert(Boolean(btlSessionId), '20. Sesión de juego BTL iniciada y registrada en SQLite');

  // Reclamar recompensa de Nivel 1 (5% OFF)
  const resBtlReward = await fetch(`${BASE_URL}/api/btl/reward`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCustomerA}`,
    },
    body: JSON.stringify({ level: 1, sessionId: btlSessionId }),
  });
  assert(resBtlReward.status === 200, '21. Emisión de recompensa BTL tras completar Nivel 1');
  const btlRewardData = await resBtlReward.json();
  const btlCode = btlRewardData.code;
  assert(btlCode.startsWith('MARIAI-'), '22. Código generado cumple con formato único criptográfico MARIAI-XXXXXX');
  assert(btlRewardData.discountPercent === 5, '23. Descuento emitido para Nivel 1 es 5% OFF');

  // 14. Asociación de recompensa con usuario autenticado
  const couponInDb = db.prepare('SELECT * FROM coupons WHERE code = ?').get(btlCode) as any;
  assert(couponInDb.user_id === userIdA, '24. Recompensa BTL asociada al user_id del jugador autenticado');

  // 15. Prevención de duplicaciones por nivel/sesión
  const resBtlDuplicate = await fetch(`${BASE_URL}/api/btl/reward`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCustomerA}`,
    },
    body: JSON.stringify({ level: 1, sessionId: btlSessionId }),
  });
  const btlDupData = await resBtlDuplicate.json();
  assert(btlDupData.code === btlCode, '25. Solicitud repetida devuelve el cupón existente (Idempotencia BTL sin duplicar)');

  // 16. Prevención de recompensas manipuladas
  const resManipulated = await fetch(`${BASE_URL}/api/btl/reward`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level: 99, sessionId: 'sesion-falsa-123' }),
  });
  assert(resManipulated.status === 400 || resManipulated.status === 403, '26. Rechazo de nivel inválido o sesión manipulada (HTTP 400/403)');

  // 17. Visualización administrativa
  console.log('\n--- 17. Visualización y Filtros en Dashboard Administrativo ---');
  const resAdminCoupons = await fetch(`${BASE_URL}/api/admin/coupons?type=btl`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const adminCouponsData = await resAdminCoupons.json();
  assert(Array.isArray(adminCouponsData.coupons), '27. Consulta filtrada de cupones BTL en dashboard administrativo');
  assert(adminCouponsData.coupons.some((c: any) => c.code === btlCode), '28. Cupón BTL generado visible en listado administrativo');

  // 18. Visualización en "Mis cupones" del cliente
  console.log('\n--- 18. Visualización en "Mis Cupones" ---');
  const resUserCouponsA = await fetch(`${BASE_URL}/api/user/coupons`, {
    headers: { Authorization: `Bearer ${tokenCustomerA}` },
  });
  const userCouponsA = await resUserCouponsA.json();
  assert(
    userCouponsA.personalCoupons.some((c: any) => c.code === exclCouponCode),
    '29. Cupón comercial exclusivo visible en "Mis cupones" de Cliente A'
  );
  assert(
    userCouponsA.personalCoupons.some((c: any) => c.code === btlCode),
    '30. Recompensa BTL visible en "Mis cupones" de Cliente A'
  );

  // Cliente B no debe ver los cupones de Cliente A
  const resUserCouponsB = await fetch(`${BASE_URL}/api/user/coupons`, {
    headers: { Authorization: `Bearer ${tokenCustomerB}` },
  });
  const userCouponsB = await resUserCouponsB.json();
  assert(
    !userCouponsB.personalCoupons.some((c: any) => c.code === exclCouponCode || c.code === btlCode),
    '31. Aislamiento estricto: Cliente B no puede ver los cupones exclusivos ni recompensas de Cliente A'
  );

  // 19. Validación en checkout
  console.log('\n--- 19. Validación y Redención en Checkout ---');
  const orderSubtotal = 50000;
  const resValidateCheckout = await fetch(`${BASE_URL}/api/coupons/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCustomerA}`,
    },
    body: JSON.stringify({ code: btlCode, subtotal: orderSubtotal }),
  });
  const valCheckoutData = await resValidateCheckout.json();
  assert(valCheckoutData.valid === true, '32. Validación en checkout aprueba cupón BTL');
  assert(valCheckoutData.discountAmount === 2500, '33. Cálculo de descuento exacto: 5% de 50.000 = $2.500 COP');

  // 20. Redención transaccional de orden
  console.log('\n--- 20. Creación de Pedido con Redención Transaccional ---');
  const orderPayload = {
    customer: {
      fullName: 'Cliente Prueba 2F3 A',
      email: testCustomerEmail1,
      phone: '3001112233',
      address: 'Calle 100 #20-30',
      city: 'Medellín',
    },
    shippingMethod: 'standard',
    paymentMethod: 'bank_transfer',
    couponCode: btlCode,
    items: [
      {
        product: { id: 'ami-001', name: 'Osito Silvestre', price: 50000 },
        quantity: 1,
      },
    ],
    subtotal: 50000,
  };

  const resCreateOrder = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCustomerA}`,
    },
    body: JSON.stringify(orderPayload),
  });
  assert(resCreateOrder.status === 201, '34. Creación de pedido persistente con cupón BTL (HTTP 201)');
  const createdOrder = await resCreateOrder.json();
  const createdOrderId = createdOrder.orderId;
  assert(createdOrder.discount === 2500, '35. Descuento aplicado en orden por el backend ($2.500 COP)');
  assert(createdOrder.total === 50000 - 2500 + 12000, '36. Total calculado autoritativamente: Subtotal - Descuento + Envío');

  // Verificar que el cupón incrementó times_used en SQLite
  const couponAfterUse = db.prepare('SELECT times_used, max_uses FROM coupons WHERE code = ?').get(btlCode) as any;
  assert(couponAfterUse.times_used === 1, '37. times_used incrementado a 1 atómicamente en base de datos SQLite');

  // 21. Prevención de doble redención
  console.log('\n--- 21. Prevención de Doble Redención ---');
  const resDoubleRedeem = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCustomerA}`,
    },
    body: JSON.stringify(orderPayload),
  });
  assert(resDoubleRedeem.status === 400 || resDoubleRedeem.status === 500, '38. Rechazo de segundo pedido con el mismo cupón de uso único ya consumido');

  // 22. Regresión de pedidos y comprobante PDF
  console.log('\n--- 22. Regresión de Consulta y PDF ---');
  const resGetOrder = await fetch(`${BASE_URL}/api/orders/${createdOrderId}?token=${createdOrder.accessToken}`);
  assert(resGetOrder.status === 200, '39. Consulta individual de orden con access_token legítimo (HTTP 200)');

  const resGetPdf = await fetch(`${BASE_URL}/api/orders/${createdOrderId}/pdf?token=${createdOrder.accessToken}`);
  assert(resGetPdf.status === 200, '40. Descarga de comprobante PDF con token de seguridad (HTTP 200)');
  assert(resGetPdf.headers.get('content-type')?.includes('application/pdf') === true, '41. Cabecera Content-Type es application/pdf');

  // 23. Consulta sin token (Protección contra IDOR)
  const resGetOrderNoAuth = await fetch(`${BASE_URL}/api/orders/${createdOrderId}`);
  assert(resGetOrderNoAuth.status === 403, '42. Protección IDOR: Acceso a orden sin credencial ni token es bloqueado con HTTP 403');

  // Resumen final
  console.log('\n================================================================');
  console.log(`RESULTADO DE LA SUITE DE PRUEBAS FASE 2F.3`);
  console.log(`TOTAL PRUEBAS: ${passed + failed}`);
  console.log(`SUPERADAS:     ${passed}`);
  console.log(`FALLIDAS:      ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Error fatal durante la ejecución de las pruebas:', err);
  process.exit(1);
});
