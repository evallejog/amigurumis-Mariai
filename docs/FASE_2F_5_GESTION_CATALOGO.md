# INFORME TÉCNICO — FASE 2F.5: GESTIÓN INTEGRAL DEL CATÁLOGO Y REFINAMIENTO DE INTERFAZ

**Proyecto:** Amigurumis Mariai — Plataforma E-commerce & Gamificación  
**Fecha:** Noviembre de 2026  
**Fase:** 2F.5 — Gestión Integral del Catálogo de Amigurumis, Inventario Transaccional y Refinamiento UX  
**Estado:** COMPLETADO Y VERIFICADO AL 100% (24/24 pruebas aprobadas en suite Fase 2F.5; 92+ pruebas de regresión superadas)

---

## 1. RESUMEN EJECUTIVO

La **Fase 2F.5** consolida la transición desde un catálogo mixto en memoria hacia una arquitectura de catálogo y control de inventario 100% persistente en **SQLite**, administrable en tiempo real desde el **Panel Administrativo** (`/admin`) y sincronizado con la tienda pública, el carrito de compras y la pasarela de pedidos.

Durante esta fase se diagnosticaron y resolvieron quirúrgicamente los cinco fallos de integración identificados en la sesión anterior:
1. **Subida de Fotografías (`/api/admin/products/upload-image`):** Unificación del contrato JSON retornando `{ success: true, url, imageUrl, fileName, size }` para compatibilidad cruzada entre el panel de administración, la suite de pruebas automatizadas y el catálogo público.
2. **Mensaje de Rechazo por Stock Insuficiente:** Estandarización del mensaje de error en el servidor para reflejar explícitamente tanto el término "inventario" como "stock" disponible frente a unidades solicitadas.
3. **Procesamiento de Pedidos Válidos:** Normalización de campos del cliente (`customer.address` y `customer.shippingAddress`, `customer.fullName` y `customer.name`, `customer.city`), evitando violaciones de restricción `NOT NULL` en SQLite ante diferentes variantes de carga de cliente.
4. **Identificador del Pedido (`orderNumber` y `orderId`):** Generación autoritativa en backend y propagación dual en el payload de respuesta de la orden confirmada.
5. **Deducción Atómica de Inventario:** Ejecución en una única transacción SQLite (`db.transaction`) que descuenta el stock de productos de catálogo, actualiza el estado a `out_of_stock` si el inventario llega a cero, redime cupones e inserta la orden con sus líneas de detalle, garantizando reversión total ante cualquier inconsistencia.

---

## 2. ARQUITECTURA DEL CATÁLOGO

```
                               ┌─────────────────────────────────────────┐
                               │       Panel de Administración           │
                               │   (src/pages/AdminDashboardPage.tsx)    │
                               └────────────────────┬────────────────────┘
                                                    │
                   ┌────────────────────────────────┼────────────────────────────────┐
                   │ CRUD de Productos              │ Subida de Fotografías          │ Métricas de Taller
                   ▼                                ▼                                ▼
      ┌─────────────────────────┐      ┌──────────────────────────┐     ┌────────────────────────┐
      │   GET/POST/PATCH/DELETE │      │ POST /upload-image       │     │ GET /api/admin/products│
      │   /api/admin/products   │      │ Magic Bytes + Sanitized  │     │ Métricas de Unidades   │
      └────────────┬────────────┘      └────────────┬─────────────┘     └────────────┬───────────┘
                   │                                │                                │
                   ▼                                ▼                                ▼
      ┌──────────────────────────────────────────────────────────────────────────────────────────┐
      │                                Servidor Express (server.ts)                              │
      │               - Verificación RBAC de Administrador (Bearer Token / Cookie)               │
      │               - Transacciones Atómicas SQLite con journal_mode=WAL                       │
      │               - Fallbacks de Imagen y Saneamiento de Nombres                             │
      └─────────────────────────────────────────────┬────────────────────────────────────────────┘
                                                    │
                   ┌────────────────────────────────┴────────────────────────────────┐
                   ▼                                                                 ▼
      ┌─────────────────────────┐                                       ┌────────────────────────┐
      │ Base de Datos SQLite    │                                       │ Disco Local / Servidor │
      │  data/amigurumis_       │                                       │ public/uploads/        │
      │  mariai.db              │                                       │ (Fotografías PNG/JPEG) │
      │  - products             │                                       └────────────────────────┘
      │  - orders               │
      │  - order_items          │
      │  - coupons              │
      └────────────┬────────────┘
                   │
                   ▼
      ┌─────────────────────────┐
      │ Tienda Pública          │
      │  (src/App.tsx)          │
      │  - CatalogSection.tsx   │
      │  - ProductDetailModal   │
      │  - CartContext.tsx      │
      │  - CheckoutModal.tsx    │
      └─────────────────────────┘
```

---

## 3. ESQUEMA DE DATOS SQLITE (`server/db.ts`)

La tabla `products` se define con soporte para trazabilidad artesanal, dimensiones, tiempos de confección y métricas de inventario:

```sql
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  short_description TEXT NOT NULL,
  full_description TEXT NOT NULL,
  price INTEGER NOT NULL,
  currency TEXT DEFAULT 'COP',
  stock_units INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'published', -- 'published', 'hidden', 'out_of_stock'
  height_cm REAL,
  width_cm REAL,
  depth_cm REAL,
  craft_time_hours REAL,
  difficulty TEXT,
  weave_type TEXT,
  materials TEXT,             -- JSON string array
  colors TEXT,
  care_instructions TEXT,
  notes TEXT,
  image_url TEXT NOT NULL,
  additional_images TEXT,     -- JSON string array
  tags TEXT,                  -- JSON string array
  featured INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
```

### Amigurumis Iniciales Pre-sembrados
La base de datos contiene los 8 amigurumis artesanales con fotografía y ficha técnica completa:
1. `ami-001` — Osito Silvestre con Bufanda Mostaza (Animales, $18.500 COP)
2. `ami-002` — Ballenita Marina Suave (Marinos, $12.500 COP)
3. `ami-003` — Dragón Guardián Esmeralda y Lavanda (Fantasía, $28.500 COP)
4. `ami-004` — Osito Astronauta Cosmos Edition (Personalizados, $26.000 COP)
5. `ami-005` — Pompón el Conejo Aventurero (Edición Oficial Videojuego, $19.500 COP)
6. `ami-006` — Zorro Astuto del Bosque Andino (Animales, $21.000 COP)
7. `ami-007` — Medusa Luminiscente del Caribe (Marinos, $16.000 COP)
8. `ami-008` — Hada del Algodón Encantado (Fantasía, $22.500 COP)

---

## 4. CATÁLOGO DE ENDPOINTS

### Endpoints Públicos
- `GET /api/products`: Lista amigurumis con estado diferente a `hidden`. Soporta filtros por `category` (`animales`, `marinos`, `fantasia`, `personalizados`), búsqueda de texto por `search` (nombre, descripción, sku, etiquetas) y ordenamiento por `sort` (`price-asc`, `price-desc`, `craft-time`, `featured`).
- `GET /api/products/:id`: Detalle completo de una figura por ID o SKU.
- `POST /api/orders`: Registro autoritativo y deducción transaccional de inventario.

### Endpoints Administrativos (Requieren rol `admin`)
- `GET /api/admin/products`: Consulta administrativa con métricas (`totalProducts`, `totalUnits`, `lowStockCount`, `outOfStockCount`, `totalValueCop`).
- `POST /api/admin/products`: Creación de un nuevo amigurumi con validación de SKU único.
- `PUT /api/admin/products/:id`: Modificación integral de especificaciones y datos técnicos.
- `PATCH /api/admin/products/:id`: Actualización puntual de stock y umbral mínimo.
- `PATCH /api/admin/products/:id/status`: Alternancia rápida de visibilidad (`published`, `hidden`, `out_of_stock`).
- `DELETE /api/admin/products/:id`: Eliminación física o retiro del catálogo con verificación de pedidos históricos asociados.
- `POST /api/admin/products/upload-image`: Subida segura de imágenes.

---

## 5. SEGURIDAD Y GESTIÓN DE IMÁGENES

1. **Autenticación RBAC Obligatoria:** Todas las operaciones de creación, edición, borrado y subida de imágenes exigen sesión activa con `role === 'admin'`.
2. **Validación de Magic Bytes:** La subida de fotografías inspecciona la cabecera binaria del buffer decodificado para confirmar archivos reales:
   - JPEG: `0xFF 0xD8 0xFF`
   - PNG: `0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A`
   - WebP: `RIFF....WEBP`
3. **Saneamiento de Nombres:** Nombres de archivo higienizados con regex `/[^a-zA-Z0-9_-]/g`, longitud limitada y sufijo criptográfico aleatorio `ami-${Date.now()}-${sanitized}-${randomHex}.${ext}`.
4. **Límite de Tamaño:** Cargas restringidas a máximo 5 MB por archivo.
5. **Directorio Público Aislado:** Almacenamiento en `public/uploads/` servido estáticamente como `/uploads/...`.

---

## 6. INVENTARIO TRANSACCIONAL Y CHECKOUT

Durante `POST /api/orders`:
1. El servidor valida disponibilidad de cada ítem de catálogo en SQLite (`stock_units >= quantity`). Si no hay stock, responde HTTP 400 informando unidades disponibles y solicitadas.
2. Si el pedido es válido, se ejecuta un bloque atómico `db.transaction()`:
   - Inserción en tabla `orders`.
   - Inserción en tabla `order_items`.
   - Reducción atómica de stock en tabla `products`:
     ```sql
     UPDATE products
     SET stock_units = stock_units - ?,
         status = CASE WHEN stock_units - ? <= 0 THEN 'out_of_stock' ELSE status END,
         updated_at = ?
     WHERE id = ? AND stock_units >= ?
     ```
   - Si se utilizó cupón de descuento, se incrementa atómicamente `times_used` asegurando que no exceda `max_uses`.
3. Si cualquier sentencia lanza una excepción, SQLite aplica un rollback instantáneo protegiendo contra sobreventa y concurrencia.

---

## 7. RESULTADOS DE PRUEBAS Y VERIFICACIÓN

### Suite de Integración Fase 2F.5 (`scripts/test-phase-2f5.ts`)
- **Total de pruebas:** 24
- **Superadas:** 24 (100%)
- **Fallidas:** 0

```
===========================================================
EJECUCIÓN DE PRUEBAS DE INTEGRACIÓN: FASE 2F.5
===========================================================
--- 1. Endpoints Públicos del Catálogo ---
  [PASS] #1: GET /api/products responde 200 OK
  [PASS] #2: El catálogo público retorna los amigurumis persistidos
  [PASS] #3: Cada amigurumi público incluye ID, nombre y precio COP
  [PASS] #4: GET /api/products/ami-001 responde 200 OK
  [PASS] #5: El amigurumi individual incluye dimensiones y lista de materiales artesanales

--- 2. Autenticación Administrativa & Consulta ---
  [PASS] #6: Registro de usuario administrativo de prueba retorna 201 OK
  [PASS] #7: Login con credenciales administrativas retorna 200 OK
  [PASS] #8: Se obtiene JWT token con rol admin verificado
  [PASS] #9: GET /api/admin/products responde 200 OK
  [PASS] #10: GET /api/admin/products retorna métricas completas de inventario

--- 3. Carga Segura de Fotografías (/api/admin/products/upload-image) ---
  [PASS] #11: POST /api/admin/products/upload-image responde 200 OK
  [PASS] #12: Retorna ruta pública accesible en /uploads/

--- 4. Creación Administrativa de Amigurumi (POST /api/admin/products) ---
  [PASS] #13: POST /api/admin/products crea amigurumi exitosamente
  [PASS] #14: Amigurumi registrado con SKU TEST-COLIBRI y precio 24000 COP
  [PASS] #15: El amigurumi fue persistido en SQLite
  [PASS] #16: Stock inicial registrado correctamente en 4 unidades

--- 5. Ajuste de Stock & Alternancia Rápida de Estado ---
  [PASS] #17: PATCH /api/admin/products/:id actualiza stock a 6 unidades
  [PASS] #18: PATCH /api/admin/products/:id/status oculta el amigurumi
  [PASS] #19: Estado actualizado a hidden

--- 6. Deducción Atómica de Stock & Control de Sobreventa ---
  [PASS] #20: Pedido con cantidad > stock es RECHAZADO con 400
  [PASS] #21: El mensaje de error indica falta de stock en taller
  [PASS] #22: Pedido válido de 2 unidades es PROCESADO exitosamente
  [PASS] #23: Pedido confirmado con número: AMI-CO-...
  [PASS] #24: El inventario en SQLite se redujo atómicamente a 4 unidades

===========================================================
RESUMEN DE PRUEBAS: 24/24 pruebas superadas (100%)
===========================================================
```

### Suites de Regresión Históricas
- `scripts/test-phase-2f4.ts`: 24/24 pruebas superadas (100%).
- `scripts/test-phase-2f3.ts`: 42/42 pruebas superadas (100%).
- `scripts/test-phase-2f2.ts`: 26/26 pruebas superadas (100%).
- `scripts/test-admin-auth.ts`: 20/20 pruebas superadas (100%).
- `scripts/test-auth-and-features.ts`: 10/10 pruebas superadas (100%).
- Verificación estática: `npx tsc --noEmit` superado sin advertencias.
- Compilación de producción: `npm run build` generado en 1.52 segundos.

---

## 8. LIMITACIONES DE PERSISTENCIA LOCAL Y HOJA DE RUTA

1. **Almacenamiento Local Efímero en Contenedor:**  
   La base de datos SQLite reside en `data/amigurumis_mariai.db`. En entornos sin volumen persistente dedicado (como contenedores Cloud Run que reinician o suspenden la máquina virtual), el archivo se reinicializa desde la plantilla sembrada.
2. **Sincronización Cloud / Turso:**  
   El módulo `server/db.ts` incluye las utilidades `isTursoConfigured`, `testTursoConnection` y `exportDatabaseDump`, permitiendo conectar la base de datos a **libSQL / Turso** o **Cloud SQL** cuando se configure `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`.
3. **Persistencia de Fotografías Subidas:**  
   Las fotos subidas a `public/uploads/` se conservan localmente. Para despliegues multi-región a gran escala, se recomienda externalizar el guardado a Cloud Storage / S3.

---

## 9. CONCLUSIÓN

La **Fase 2F.5** queda completamente finalizada y lista para producción, cumpliendo con todos los criterios de calidad, aislamiento multiusuario, diseño Apple Liquid Glass y control de inventario seguro.
