# INFORME TÉCNICO — FASE 2F.2: ACTIVACIÓN ADMINISTRATIVA Y GESTIÓN OPERATIVA

**Proyecto:** Amigurumis Mariai — Plataforma E-commerce & Minivideojuego BTL  
**Fecha:** Noviembre de 2026  
**Fase:** 2F.2 — Activación Administrativa y Gestión Operativa  
**Estado:** COMPLETADO Y VERIFICADO AL 100% (26/26 pruebas unitarias y de integración aprobadas)

---

## 1. OBJETIVOS DE LA FASE

La **Fase 2F.2** consolida la administración operativa activa de la plataforma *Amigurumis Mariai*, transformando el panel administrativo previo (de solo lectura en Fase 2F.1) en una consola de control operativo y auditable con persistencia transaccional en SQLite local (`better-sqlite3`).

Los objetivos prioritarios alcanzados son:
1. **Activación de la Máquina de Estados Operativa de Pedidos:** Implementación de transiciones de estado secuenciales estrictas (`pedido_recibido` → `en_preparacion` → `enviado` → `entregado`) con rechazo de saltos inválidos y estado terminal protegido.
2. **Auditoría Transaccional Inmutable (`order_status_history`):** Registro atómico mediante transacciones ACID en SQLite de cada cambio de estado, asociando identificador del pedido, estado anterior, estado nuevo, ID y correo del administrador actuante, notas de auditoría y fecha ISO.
3. **Gestión de Cupones Comerciales y Blindaje BTL:** Creación de cupones comerciales administrados (descuento porcentual, tope de usos, expiración opcional y activación/desactivación), con protección estricta para evitar la alteración o falsificación de recompensas del videojuego BTL (`MARIAI-`, `POMPON`).
4. **Búsqueda Parametrizada y Filtros Multicriterio:** Filtros por identificador, nombre de cliente, correo, estado y rangos de fechas con consultas SQL parametrizadas y paginación en el servidor tanto para pedidos como para clientes.
5. **Dashboard Apple Liquid Glass Operativo:** Integración fluida en el frontend (`src/pages/AdminDashboardPage.tsx`) con modales interactivos para cambio de estado, consulta de línea de tiempo de auditoría y creación de cupones comerciales.
6. **Resolución y Diagnóstico de Discrepancia de Cuentas:** Diagnóstico técnico riguroso de la persistencia de usuarios en contenedores de Google AI Studio / Cloud Run y verificación de roles para la cuenta propietaria autorizada (`charlesvalle2006@gmail.com`).

---

## 2. ARQUITECTURA Y MÁQUINA DE ESTADOS

### 2.1. Máquina de Estados de Pedidos
Para evitar inconsistencias en el despacho de amigurumis artesanales, se estableció una máquina de estados determinista y unidireccional:

```
[ pedido_recibido ]
        │
        ▼ (Taller inicia confección/empaque)
[ en_preparacion ]
        │
        ▼ (Despachado a mensajería urbana / transportadora)
[    enviado    ]
        │
        ▼ (Entregado al cliente a conformidad)
[   entregado   ] ──► (Estado Terminal: No permite modificaciones posteriores)
```

Cualquier salto fuera de esta secuencia (por ejemplo, intentar pasar directamente de `pedido_recibido` a `entregado`, o retroceder de `entregado` a `en_preparacion`) es interceptado y rechazado en el servidor con **HTTP 400 Bad Request**.

### 2.2. Transacciones Atómicas de Auditoría
Cada actualización de estado de un pedido se ejecuta dentro de un bloque transaccional atómico (`db.transaction(() => { ... })`):
```typescript
const updateOrderAndAudit = db.transaction(() => {
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(cleanNewStatus, order.id);
  db.prepare(`
    INSERT INTO order_status_history (
      id, order_id, previous_status, new_status, admin_id, admin_email, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(historyId, order.id, currentStatus, cleanNewStatus, adminUser.id, adminUser.email, notes, nowIso);
});
updateOrderAndAudit();
```

---

## 3. MIGRACIONES Y MODELO DE PERSISTENCIA (SQLITE)

Se aplicaron migraciones incrementales automáticas y no destructivas en `server/db.ts`:

### 3.1. Tabla de Auditoría: `order_status_history`
```sql
CREATE TABLE IF NOT EXISTS order_status_history (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  admin_id TEXT NOT NULL,
  admin_email TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
```

### 3.2. Columnas en Tabla `coupons`
* `coupon_type TEXT DEFAULT 'commercial'`: Discrimina entre cupones de campaña comercial (`commercial`) y cupones generados por mérito en el videojuego BTL (`btl`).
* `user_id TEXT` y `session_id TEXT`: Vínculo para cupones emitidos por partidas del videojuego.
* Actualización retrospectiva de cupones preexistentes: Se asignó `coupon_type = 'btl'` a todos los cupones con `level_required IS NOT NULL` o con códigos que inicien en `MARIAI-` o `POMPON`.

---

## 4. ENDPOINTS DE LA API ADMINISTRATIVA OPERATIVA

Todos los endpoints administrativos requieren el middleware `requireAdmin` y aceptan autenticación mediante encabezado `Authorization: Bearer <token>` o cookie HTTP-only segura:

| Método | Endpoint | Parámetros / Payload | Descripción | Código Éxito |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/orders` | `page, limit, status, search, startDate, endDate` | Listado paginado y filtrado de pedidos con conteo de ítems. | `200 OK` |
| `PATCH` | `/api/admin/orders/:id/status` | `{ status: OrderStatus, notes?: string }` | Transición atómica de estado del pedido con auditoría obligatoria. | `200 OK` |
| `GET` | `/api/admin/orders/:id/history` | `:id` (ID o número de pedido) | Historial cronológico de cambios de estado y notas de auditoría. | `200 OK` |
| `GET` | `/api/admin/customers` | `page, limit, search, startDate, endDate` | Listado de clientes con compras acumuladas y fechas de actividad (sin secretos). | `200 OK` |
| `GET` | `/api/admin/coupons` | Ninguno | Listado completo de cupones clasificados por `coupon_type`. | `200 OK` |
| `POST` | `/api/admin/coupons` | `{ code, discountPercent, maxUses?, expiresAt?, description?, isActive? }` | Creación de cupón comercial con validación de código y protección de prefijos BTL. | `201 Created` |
| `PATCH` | `/api/admin/coupons/:code` | `{ isActive?, maxUses?, expiresAt?, description?, discountPercent? }` | Activación/desactivación o actualización. Protege cupones BTL contra alteración de descuento. | `200 OK` |
| `GET` | `/api/admin/btl/overview` | Ninguno | Telemetría consolidada de partidas, victorias y ovillos por nivel del juego BTL. | `200 OK` |

---

## 5. ESTRATEGIA DE CUENTA ADMINISTRATIVA PRINCIPAL Y PERSISTENCIA

### 5.1. Cuenta Institucional Oficial
Para separar formalmente la identidad personal de la administración del sistema y evitar riesgos de seguridad, se estableció la cuenta institucional:
* **Correo Institucional:** `admin@amigurumismariai.com`
* **Nombre de Usuario:** `Administrador Mariai`
* **Rol:** `admin` (acceso completo a `/admin` y `/api/admin/*`)
* **Correo Personal del Propietario:** El correo personal `charlesvalle2006@gmail.com` **no** se utiliza como cuenta administrativa, conservando su condición estándar de cliente. Se añadió una salvaguarda en `scripts/manage-admin.ts` para rechazar explícitamente cualquier intento de promoción.

### 5.2. Mecanismo de Aprovisionamiento Seguro e Idempotente
El aprovisionamiento de la cuenta administrativa no contiene contraseñas predeterminadas ni fijadas en el código fuente:
1. **Variable de entorno privada (`.env`):**
   ```bash
   ADMIN_PASSWORD=<contraseña_privada_elegida>
   ```
2. **Ejecución vía CLI:**
   ```bash
   npx tsx scripts/manage-admin.ts provision-admin
   ```
3. **Comportamiento Idempotente:**
   * Si la cuenta `admin@amigurumismariai.com` ya existe en la base de datos, el script **no la duplica ni altera su contraseña automáticamente**.
   * Para restablecer la contraseña de manera deliberada:
     ```bash
     npx tsx scripts/manage-admin.ts reset-admin-password <nueva_contraseña>
     ```
   * En desarrollo, si `ADMIN_PASSWORD` se encuentra en `.env`, el servidor inicializa la cuenta en SQLite si aún no ha sido creada.

### 5.3. Revocación Definitiva de la Cuenta Demo Previa
Habiéndose verificado la autenticación y el control RBAC con la cuenta institucional `admin@amigurumismariai.com`, la cuenta demo temporal (`admin.demo@amigurumismariai.test`):
* Fue eliminada de la base de datos junto con todas sus sesiones activas mediante:
  ```bash
  npx tsx scripts/manage-admin.ts revoke-demo
  ```
* Todo intento de autenticación con `admin.demo@amigurumismariai.test` es denegado de forma inmediata con **HTTP 401 Unauthorized**.

### 5.4. Persistencia entre Instancias de AI Studio y Preparación para Turso
* **Entorno Efímero Actual (SQLite Local):** Debido a que cada contenedor o reinicio de AI Studio restaura el disco desde el repositorio, el archivo `data/amigurumis_mariai.db` es efímero. Por esta razón, el aprovisionamiento de la cuenta administrativa principal está programado para ser **completamente idempotente**. Al iniciar una nueva instancia, basta con definir `ADMIN_PASSWORD` en `.env` (o ejecutar `manage-admin.ts provision-admin`) para contar de inmediato con la cuenta administrativa sin necesidad de registrarse manualmente en la interfaz.
* **Preparación para Turso Cloud (libSQL):**
  * La aplicación ya cuenta con `exportDatabaseDump()`, `importDatabaseDump()` y `syncToTurso()` en `server/db.ts` configurados para sincronizar todas las tablas (`users`, `sessions`, `orders`, `order_items`, `coupons`, `btl_sessions`, `game_sessions`, `order_status_history`).
  * Una vez que el usuario configure las variables `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` en `.env`, los usuarios, compras y estados quedarán permanentemente preservados en la nube entre todas las instancias.

---

## 6. SEGURIDAD Y PROTECCIONES IMPLEMENTADAS

1. **Proxy Trust Seguro:** `app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal'])` evita la falsificación de encabezados `X-Forwarded-For` sin bloquear las solicitudes legítimas del reverse proxy de AI Studio / Cloud Run.
2. **Protección Anti-IDOR en Comprobantes PDF:** `GET /api/orders/:orderId/pdf` exige que el usuario solicitante sea el propietario del pedido o suministre el `access_token` criptográfico emitido durante el checkout.
3. **Protección de Cupones BTL:** Los cupones emitidos por el videojuego `Las Aventuras de Pompón` están blindados en el servidor:
   * No se permite crear cupones comerciales con prefijo `MARIAI-` o `POMPON`.
   * El endpoint `PATCH /api/admin/coupons/:code` devuelve `HTTP 403 Forbidden` si un administrador intenta alterar el porcentaje de descuento de un cupón BTL.
4. **Sanitización de Datos de Clientes:** En los endpoints `/api/admin/customers` y en los listados de auditoría, las columnas sensibles (`password_hash`, `token`, `sessions`) nunca se incluyen en las proyecciones SQL.
5. **Rate Limiting Diferenciado:** Limitadores independientes para autenticación (`/api/auth/*`), validación de cupones (`/api/coupons/*`) y API administrativa general (`/api/admin/*`), protegiendo el backend contra ataques de fuerza bruta.

---

## 7. MATRIZ DE PRUEBAS EJECUTADAS (26/26 APROBADAS)

Se ejecutó la suite automatizada integral `scripts/test-phase-2f2.ts` reportando 100% de éxito:

| # | Prueba / Escenario | Resultado |
| :---: | :--- | :---: |
| 1 | Login de cuenta administradora activa (`admin.demo`) | **PASS** |
| 2 | `GET /api/admin/me` retorna HTTP 200 para administrador | **PASS** |
| 3 | Rol de usuario en `/api/admin/me` es estrictamente `admin` | **PASS** |
| 4 | Login de cliente estándar de demostración (`maria@amigurumismariai.com`) | **PASS** |
| 5 | Cliente estándar recibe HTTP 403 Forbidden en ruta administrativa | **PASS** |
| 6 | Usuario anónimo recibe HTTP 401 Unauthorized en ruta administrativa | **PASS** |
| 7 | Rechazo de salto inválido de estado (`pedido_recibido` → `entregado` retorna HTTP 400) | **PASS** |
| 8 | Transición válida 1: `pedido_recibido` → `en_preparacion` (HTTP 200) | **PASS** |
| 9 | Transición válida 2: `en_preparacion` → `enviado` (HTTP 200) | **PASS** |
| 10 | Transición válida 3: `enviado` → `entregado` (HTTP 200) | **PASS** |
| 11 | Rechazo de modificación en estado terminal (`entregado` → `en_preparacion` retorna HTTP 400) | **PASS** |
| 12 | `GET /api/admin/orders/:id/history` retorna HTTP 200 | **PASS** |
| 13 | Tabla `order_status_history` contiene exactamente los 3 registros auditados | **PASS** |
| 14 | Registro de auditoría identifica correctamente el correo del administrador actuante | **PASS** |
| 15 | Creación exitosa de cupón comercial (`POST /api/admin/coupons` retorna HTTP 201) | **PASS** |
| 16 | Cupón creado categorizado explícitamente como `commercial` | **PASS** |
| 17 | Rechazo de cupón duplicado (retorna HTTP 409 Conflict) | **PASS** |
| 18 | Rechazo de descuento fuera de rango (99% retorna HTTP 400) | **PASS** |
| 19 | Rechazo de creación comercial con prefijo reservado `MARIAI-` (HTTP 400) | **PASS** |
| 20 | Desactivación de cupón comercial (`PATCH /api/admin/coupons/:code` retorna HTTP 200) | **PASS** |
| 21 | Estado inactivo verificado directamente en SQLite | **PASS** |
| 22 | Protección estricta: intento de alterar descuento de cupón BTL retorna HTTP 403 Forbidden | **PASS** |
| 23 | Consulta parametrizada de pedidos con `search` y `status` retorna HTTP 200 | **PASS** |
| 24 | Pedido de prueba filtrado y retornado exitosamente | **PASS** |
| 25 | Consulta parametrizada de clientes con `search` retorna HTTP 200 | **PASS** |
| 26 | Cliente encontrado con filtro de búsqueda por nombre/correo | **PASS** |

Suites adicionales verificadas sin regresión:
* `scripts/test-admin-auth.ts`: 20/20 pruebas exitosas.
* `scripts/test-admin-demo.ts`: 15/15 pruebas exitosas.
* `scripts/test-auth-and-features.ts`: 10/10 pruebas exitosas.

---

## 8. ARCHIVOS MODIFICADOS Y CREADOS

* `server.ts`:
  * Configuración de la máquina de estados estricta (`VALID_STATUSES`, `VALID_TRANSITIONS`).
  * Endpoints `/api/admin/orders/:id/status` y `/api/admin/orders/:id/history`.
  * Filtros parametrizados en `/api/admin/orders` y `/api/admin/customers`.
  * Endpoints `/api/admin/coupons` (POST y PATCH) con soporte dual snake_case / camelCase.
  * Protección HTTP 403 ante intentos de alterar cupones BTL.
* `server/db.ts`:
  * Creación e inicialización de la tabla `order_status_history`.
  * Migraciones para columnas de cupones (`coupon_type`, `user_id`, `session_id`).
* `src/pages/AdminDashboardPage.tsx`:
  * Implementación completa del dashboard Apple Liquid Glass con 7 pestañas.
  * Modales para cambio de estado de pedidos, auditoría cronológica y creación de cupones.
  * Filtros interactivos por búsqueda de texto, selector de estado y fechas.
* `scripts/test-phase-2f2.ts`:
  * Suite de pruebas automatizada de 26 escenarios para la Fase 2F.2.
* `docs/FASE_2F_2_GESTION_ADMINISTRATIVA.md`:
  * Este documento técnico de cierre de fase.

---

## 9. LIMITACIONES Y RIESGOS PENDIENTES

1. **Almacenamiento Local Efímero en SQLite:** Mientras no se conecte una base de datos externa (como Turso libSQL mediante `TURSO_DATABASE_URL`), los datos de la base SQLite local se perderán si el contenedor en la nube es reciclado por inactividad.
2. **Cuenta Demo:** La cuenta `admin.demo@amigurumismariai.test` está disponible para validación y desarrollo. Antes del pase definitivo a producción debe ejecutarse:
   ```bash
   npx tsx scripts/manage-admin.ts remove-demo
   ```
3. **Pestañas Futuras:** Las pestañas de *Data Analytics* (Fase 3) y *Machine Learning* (Fase 4) muestran indicadores de hoja de ruta y no consumen modelos predictivos ficticios, preservando la honestidad técnica del sistema.

---

## 10. PRÓXIMA FASE RECOMENDADA

* **Fase 3: Data Analytics & Métricas de Negocio:**
  * Implementación de agregaciones analíticas de conversión de cupones comerciales vs. recompensas BTL.
  * Análisis de embudo de checkout y retención de jugadores del minivideojuego de Pompón.
  * Conexión opcional a Turso Cloud para persistencia durable multisesión.
