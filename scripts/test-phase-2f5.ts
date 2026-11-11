/**
 * End-to-End Integration Test for Fase 2F.5:
 * Gestión Integral del Catálogo y Refinamiento de Interfaz
 * 
 * Verifies:
 * 1. Public catalog retrieval from SQLite (/api/products & /api/products/:id)
 * 2. Admin authentication and administrative product querying (/api/admin/products)
 * 3. Administrative creation of a new artisanal amigurumi (/api/admin/products)
 * 4. Safe image upload validation and storage (/api/admin/products/upload-image)
 * 5. Incremental stock update & status toggling (/api/admin/products/:id)
 * 6. Checkout atomic stock deduction and over-selling rejection (/api/orders)
 */

import { db } from '../server/db.js';

const BASE_URL = 'http://127.0.0.1:3000';

// 1x1 transparent PNG as base64 data URI for image upload test
const SAMPLE_BASE64_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function runTests() {
  console.log('===========================================================');
  console.log('EJECUCIÓN DE PRUEBAS DE INTEGRACIÓN: FASE 2F.5');
  console.log('===========================================================');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] #${total}: ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] #${total}: ${testName}`);
      if (detail) console.error(`         Detalle: ${detail}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // TEST 1: Public Catalog Endpoints
    // -------------------------------------------------------------
    console.log('\n--- 1. Endpoints Públicos del Catálogo ---');
    const pubRes = await fetch(`${BASE_URL}/api/products`);
    assert(pubRes.ok, 'GET /api/products responde 200 OK');
    const pubData = await pubRes.json();
    const productsList = Array.isArray(pubData) ? pubData : (pubData.products || []);
    assert(Array.isArray(productsList) && productsList.length >= 8, 'El catálogo público retorna los amigurumis persistidos');
    
    // Check first product structure
    const sampleProduct = productsList[0];
    assert(
      sampleProduct && sampleProduct.id && sampleProduct.name && sampleProduct.price > 0,
      'Cada amigurumi público incluye ID, nombre y precio COP',
      `ID: ${sampleProduct?.id}, Nombre: ${sampleProduct?.name}, Precio: ${sampleProduct?.price}`
    );

    // GET single product
    const singleRes = await fetch(`${BASE_URL}/api/products/${sampleProduct.id}`);
    assert(singleRes.ok, `GET /api/products/${sampleProduct.id} responde 200 OK`);
    const singleDataRaw = await singleRes.json();
    const singleData = singleDataRaw.product || singleDataRaw;
    assert(
      singleData.id === sampleProduct.id && singleData.dimensions && singleData.materials,
      'El amigurumi individual incluye dimensiones y lista de materiales artesanales'
    );

    // -------------------------------------------------------------
    // TEST 2: Admin Authentication & Product Querying
    // -------------------------------------------------------------
    console.log('\n--- 2. Autenticación Administrativa & Consulta ---');
    const adminEmail = `admin_test_${Date.now()}@amigurumismariai.com`;
    const adminPass = 'ClaveAdmin2026!';
    const regAdminRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Super Administrador Test',
        email: adminEmail,
        password: adminPass,
        phone: '3112223344',
        city: 'Medellín',
        department: 'Antioquia',
      }),
    });
    assert(regAdminRes.ok, 'Registro de usuario administrativo de prueba retorna 201 OK');
    const regAdminData = await regAdminRes.json();
    let token = regAdminData.token;

    // Promote in SQLite
    db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(adminEmail);

    // Login to get fresh token with admin role
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPass }),
    });
    assert(loginRes.ok, 'Login con credenciales administrativas retorna 200 OK');
    const loginData = await loginRes.json();
    token = loginData.token;
    assert(Boolean(token) && loginData.user?.role === 'admin', 'Se obtiene JWT token con rol admin verificado');

    const adminHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    const adminListRes = await fetch(`${BASE_URL}/api/admin/products`, { headers: adminHeaders });
    assert(adminListRes.ok, 'GET /api/admin/products responde 200 OK');
    const adminListData = await adminListRes.json();
    assert(
      Boolean(adminListData.metrics && adminListData.metrics.totalProducts >= 8),
      'GET /api/admin/products retorna métricas completas de inventario'
    );
    console.log(`     Métricas detectadas: ${adminListData.metrics.totalProducts} productos, ${adminListData.metrics.totalUnits} unidades en taller`);

    // -------------------------------------------------------------
    // TEST 3: Image Upload Endpoint
    // -------------------------------------------------------------
    console.log('\n--- 3. Carga Segura de Fotografías (/api/admin/products/upload-image) ---');
    const uploadRes = await fetch(`${BASE_URL}/api/admin/products/upload-image`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        fileName: 'test-amigurumi-colibri.png',
        mimeType: 'image/png',
        fileData: SAMPLE_BASE64_PNG,
      }),
    });
    assert(uploadRes.ok, 'POST /api/admin/products/upload-image responde 200 OK');
    const uploadData = await uploadRes.json();
    assert(
      uploadData.imageUrl && uploadData.imageUrl.startsWith('/uploads/'),
      'Retorna ruta pública accesible en /uploads/',
      `Ruta generada: ${uploadData.imageUrl}`
    );

    // -------------------------------------------------------------
    // TEST 4: Create New Artisanal Amigurumi
    // -------------------------------------------------------------
    console.log('\n--- 4. Creación Administrativa de Amigurumi (POST /api/admin/products) ---');
    const newSku = `TEST-COLIBRI-${Date.now().toString().slice(-4)}`;
    const createRes = await fetch(`${BASE_URL}/api/admin/products`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'Colibrí Esmeralda Andino',
        sku: newSku,
        category: 'animales',
        price: 24000,
        stockUnits: 4,
        lowStockThreshold: 2,
        status: 'published',
        shortDescription: 'Colibrí multicolor en plumaje esmeralda con pico reforzado.',
        fullDescription: 'Pieza miniatura confeccionada con hilo de algodón mercerizado ultrafino.',
        heightCm: 14,
        widthCm: 8,
        depthCm: 6,
        craftTimeHours: 7,
        difficulty: 'Avanzada',
        weaveType: 'Punto raso en espiral con cambios de hebra',
        materials: ['Hilo 100% algodón mercerizado', 'Fibra siliconada', 'Alambre dulce protegido'],
        colors: 'Verde esmeralda, turquesa, oro viejo',
        careInstructions: 'Limpieza en seco con brocha suave.',
        imageUrl: uploadData.imageUrl,
        featured: true,
      }),
    });
    assert(createRes.ok, 'POST /api/admin/products crea amigurumi exitosamente');
    const createData = await createRes.json();
    const createdProduct = createData.product;
    assert(
      createdProduct && createdProduct.sku === newSku && createdProduct.price === 24000,
      `Amigurumi registrado con SKU ${newSku} y precio 24000 COP`
    );

    // Verify in SQLite directly
    const dbRow: any = db.prepare('SELECT * FROM products WHERE sku = ?').get(newSku);
    assert(Boolean(dbRow), 'El amigurumi fue persistido en SQLite');
    assert(dbRow.stock_units === 4, 'Stock inicial registrado correctamente en 4 unidades');

    // -------------------------------------------------------------
    // TEST 5: Stock Increment & Fast Toggle Status
    // -------------------------------------------------------------
    console.log('\n--- 5. Ajuste de Stock & Alternancia Rápida de Estado ---');
    // Update stock to 6 units
    const patchStockRes = await fetch(`${BASE_URL}/api/admin/products/${createdProduct.id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ stockUnits: 6 }),
    });
    assert(patchStockRes.ok, 'PATCH /api/admin/products/:id actualiza stock a 6 unidades');

    // Toggle status to hidden
    const toggleStatusRes = await fetch(`${BASE_URL}/api/admin/products/${createdProduct.id}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'hidden' }),
    });
    assert(toggleStatusRes.ok, 'PATCH /api/admin/products/:id/status oculta el amigurumi');
    const toggleData = await toggleStatusRes.json();
    assert(toggleData.product.status === 'hidden', 'Estado actualizado a hidden');

    // Toggle back to published
    await fetch(`${BASE_URL}/api/admin/products/${createdProduct.id}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'published' }),
    });

    // -------------------------------------------------------------
    // TEST 6: Atomic Stock Deduction & Over-Selling Prevention
    // -------------------------------------------------------------
    console.log('\n--- 6. Deducción Atómica de Stock & Control de Sobreventa ---');

    // Attempt to order 99 units (more than 6 in stock)
    const overOrderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: {
          fullName: 'Comprador Test',
          email: 'comprador@test.com',
          phone: '3001234567',
          shippingAddress: 'Cra 7 # 71-21',
          city: 'Bogotá D.C.',
          department: 'Cundinamarca',
        },
        items: [
          {
            product: { id: createdProduct.id, name: createdProduct.name, price: 24000 },
            quantity: 99,
          },
        ],
        shippingMethod: 'local',
        paymentMethod: 'contraentrega',
        subtotal: 24000 * 99,
        discount: 0,
        shippingCost: 8000,
        total: (24000 * 99) + 8000,
      }),
    });
    assert(!overOrderRes.ok && overOrderRes.status === 400, 'Pedido con cantidad > stock es RECHAZADO con 400');
    const overOrderData = await overOrderRes.json();
    assert(
      overOrderData.error && overOrderData.error.toLowerCase().includes('stock'),
      'El mensaje de error indica falta de stock en taller'
    );

    // Place valid order for 2 units
    const validOrderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: {
          fullName: 'Comprador Test',
          email: 'comprador@test.com',
          phone: '3001234567',
          shippingAddress: 'Cra 7 # 71-21',
          city: 'Bogotá D.C.',
          department: 'Cundinamarca',
        },
        items: [
          {
            product: { id: createdProduct.id, name: createdProduct.name, price: 24000 },
            quantity: 2,
          },
        ],
        shippingMethod: 'local',
        paymentMethod: 'contraentrega',
        subtotal: 48000,
        discount: 0,
        shippingCost: 8000,
        total: 56000,
      }),
    });
    assert(validOrderRes.ok, 'Pedido válido de 2 unidades es PROCESADO exitosamente');
    const validOrderData = await validOrderRes.json();
    assert(Boolean(validOrderData.orderNumber), `Pedido confirmado con número: ${validOrderData.orderNumber}`);

    // Verify stock decrement in SQLite (6 - 2 = 4)
    const afterOrderRow: any = db.prepare('SELECT stock_units, status FROM products WHERE id = ?').get(createdProduct.id);
    assert(
      afterOrderRow.stock_units === 4,
      `El inventario en SQLite se redujo atómicamente a 4 unidades (actual: ${afterOrderRow.stock_units})`
    );

    // Clean up test amigurumi and test admin user from SQLite
    db.prepare('DELETE FROM products WHERE id = ?').run(createdProduct.id);
    db.prepare('DELETE FROM users WHERE email = ?').run(adminEmail);
    console.log('     [Limpieza] Datos temporales de prueba eliminados de SQLite.');

    // -------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------
    console.log('\n===========================================================');
    console.log(`RESUMEN DE PRUEBAS: ${passed}/${total} pruebas superadas (${Math.round((passed / total) * 100)}%)`);
    console.log('===========================================================');

    if (passed === total) {
      console.log('Todas las pruebas de la Fase 2F.5 concluyeron exitosamente.');
      process.exit(0);
    } else {
      console.error('Hubo fallas en las pruebas de la Fase 2F.5.');
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Excepción crítica durante la ejecución de pruebas:', err);
    process.exit(1);
  }
}

runTests();
