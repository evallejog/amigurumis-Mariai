import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'amigurumis_mariai.db');
const db = new Database(DB_PATH);
const BASE_URL = 'http://localhost:3000';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
    failed++;
  }
}

async function run() {
  console.log('================================================================');
  console.log('TEST SUITE: FASE 2F.4 - ESTABILIZACIÓN UX, CUPONES Y MULTIUSUARIO');
  console.log('================================================================\n');

  // ---------------------------------------------------------
  // 1. Diagnóstico e Inspección del Cupón EXCL-USRA-19299
  // ---------------------------------------------------------
  console.log('--- 1. Diagnóstico del Cupón Exclusivo EXCL-USRA-19299 ---');

  const coupon = db.prepare('SELECT * FROM coupons WHERE code = ?').get('EXCL-USRA-19299') as any;
  assert(!!coupon, '1. Cupón EXCL-USRA-19299 existe en la base de datos SQLite');
  assert(coupon?.coupon_type === 'commercial_exclusive', '2. Tipo de cupón es commercial_exclusive');
  assert(coupon?.target_type === 'exclusive', '3. target_type es exclusive');
  assert(coupon?.is_active === 1, '4. Cupón se encuentra activo');
  assert(coupon?.discount_percent === 25, '5. Descuento configurado es 25%');
  assert(!!coupon?.user_id, '6. Cupón tiene asignado un user_id destinatario');
  assert(!!coupon?.user_email, '7. Cupón tiene asignado un user_email destinatario');

  // ---------------------------------------------------------
  // 2. Validación Autoritativa en Endpoint /api/coupons/validate
  // ---------------------------------------------------------
  console.log('\n--- 2. Validación de Exclusividad en /api/coupons/validate ---');

  // A. Petición Anónima (Sin Authorization)
  const anonRes = await fetch(`${BASE_URL}/api/coupons/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'EXCL-USRA-19299', subtotal: 50000 })
  });
  const anonData = await anonRes.json();
  assert(anonRes.status === 403, '8. Petición anónima rechazada con HTTP 403 Forbidden');
  assert(
    anonData.error === 'Este cupón es exclusivo y requiere iniciar sesión con la cuenta destinataria para aplicarse.',
    '9. Mensaje explicativo claro de necesidad de login'
  );

  // B. Petición con cuenta distinta (María cliente demo)
  const mariaLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'maria@amigurumismariai.com', password: 'Mariai2026!' })
  });
  const mariaAuth = await mariaLoginRes.json();
  assert(mariaLoginRes.status === 200, '10a. Login exitoso de cliente demo María');

  const otherUserRes = await fetch(`${BASE_URL}/api/coupons/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${mariaAuth.token}`
    },
    body: JSON.stringify({ code: 'EXCL-USRA-19299', subtotal: 50000 })
  });
  const otherUserData = await otherUserRes.json();
  assert(otherUserRes.status === 403, '10b. Intento de cuenta distinta rechazado con HTTP 403 Forbidden');
  assert(
    otherUserData.error === 'Este cupón de descuento está asignado a otra cuenta y no puede ser redimido por tu usuario.',
    '11. Mensaje explicativo claro de exclusividad asignada a otra cuenta'
  );

  // C. Petición con cuenta propietaria legítima
  const ownerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: coupon.user_email, password: 'Password123!' })
  });
  const ownerAuth = await ownerLoginRes.json();

  const ownerRes = await fetch(`${BASE_URL}/api/coupons/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerAuth.token}`
    },
    body: JSON.stringify({ code: 'EXCL-USRA-19299', subtotal: 50000 })
  });
  const ownerData = await ownerRes.json();
  assert(ownerRes.status === 200, '12. Cuenta propietaria validada con HTTP 200 OK');
  assert(ownerData.valid === true, '13. Respuesta indica valid: true');
  assert(ownerData.discountPercent === 25, '14. Porcentaje retornado coincide con 25%');
  assert(ownerData.discountAmount === 12500, '15. Monto descontado calculado exactamente: $12.500 COP');

  // ---------------------------------------------------------
  // 3. Aislamiento del Carrito por Usuario (Lógica de Almacenamiento)
  // ---------------------------------------------------------
  console.log('\n--- 3. Verificación de Reglas de Aislamiento de Carrito ---');

  const { getCartStorageKey, getCouponStorageKey } = await import('../src/context/CartContext.js');
  
  assert(
    getCartStorageKey(null) === 'amigurumis_mariai_cart_guest',
    '16. Clave de carrito para usuario invitado es "amigurumis_mariai_cart_guest"'
  );
  assert(
    getCartStorageKey('usr-1234') === 'amigurumis_mariai_cart_user_usr-1234',
    '17. Clave de carrito para usuario registrado incluye su identificador único'
  );
  assert(
    getCouponStorageKey(null) === 'amigurumis_mariai_coupon_guest',
    '18. Clave de cupón pendiente para usuario invitado es "amigurumis_mariai_coupon_guest"'
  );
  assert(
    getCouponStorageKey('usr-1234') === 'amigurumis_mariai_coupon_user_usr-1234',
    '19. Clave de cupón pendiente para usuario registrado incluye su identificador único'
  );
  assert(
    getCartStorageKey('usr-admin') !== getCartStorageKey('usr-maria'),
    '20. Las claves de administrador y cliente María son completamente disjuntas'
  );

  // ---------------------------------------------------------
  // 4. Integridad Administrativa y Seguridad de Credenciales
  // ---------------------------------------------------------
  console.log('\n--- 4. Integridad del Panel Administrativo y Credenciales ---');

  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@amigurumismariai.com', password: adminPassword })
  });
  const adminAuth = await adminLoginRes.json();
  assert(adminLoginRes.status === 200, '21. Administrador institucional autentica con credencial oficial');

  const overviewRes = await fetch(`${BASE_URL}/api/admin/overview`, {
    headers: { Authorization: `Bearer ${adminAuth.token}` }
  });
  assert(overviewRes.status === 200, '22. Endpoint administrativo /api/admin/overview operativo');

  const manageAdminScriptExists = db.prepare("SELECT count(*) as c FROM users WHERE role = 'admin'").get() as any;
  assert(manageAdminScriptExists.c >= 1, '23. Usuario con rol admin activo registrado en SQLite');

  // ---------------------------------------------------------
  // 5. Resumen
  // ---------------------------------------------------------
  console.log('\n================================================================');
  console.log(`RESULTADO DE LA SUITE DE PRUEBAS FASE 2F.4`);
  console.log(`TOTAL PRUEBAS: ${passed + failed}`);
  console.log(`SUPERADAS:     ${passed}`);
  console.log(`FALLIDAS:      ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal error running Phase 2F.4 suite:', err);
  process.exit(1);
});
