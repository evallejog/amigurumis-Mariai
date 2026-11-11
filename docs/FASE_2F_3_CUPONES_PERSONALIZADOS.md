# FASE 2F.3: SISTEMA DE CUPONES PERSONALIZADOS Y RECOMPENSAS BTL
## AMIGURUMIS MARIAI — INFORME DE ARQUITECTURA Y VALIDACIÓN TÉCNICA

---

### 1. RESUMEN EJECUTIVO

La **Fase 2F.3** culmina la integración integral del sistema de cupones y recompensas gamificadas de **Amigurumis Mariai**, estableciendo un modelo autoritativo, seguro y transaccional entre el minivideojuego BTL ("Las Aventuras de Pompón"), el catálogo comercial, el carrito de compras, el checkout y el panel administrativo.

Se solucionaron las inconsistencias visuales en badges administrativos y de cliente, se garantizó la estricta exclusividad de cupones entre usuarios registrados previniendo suplantaciones y dobles redenciones, y se verificó la suite completa de 42 pruebas automatizadas sin fallos.

---

### 2. ARQUITECTURA DEL SISTEMA

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (REACT 19 + VITE 8)                    │
│                                                                        │
│   [ Videojuego BTL ]       [ Carrito / Checkout ]     [ Mis Cupones ] │
│   Las Aventuras de Pompón   Validación y Descuento    Área de Cliente  │
│          │                          │                        │         │
└──────────┼──────────────────────────┼────────────────────────┼─────────┘
           │ (token / Bearer)         │ (token / Bearer)       │ (token)
┌──────────▼──────────────────────────▼────────────────────────▼─────────┐
│                    BACKEND EXPRESS (NODE.JS + TYPESCRIPT)               │
│                                                                        │
│   POST /api/btl/reward             POST /api/coupons/validate          │
│   • Generación MARIAI-XXXXXX       • Comprobación de vigencia          │
│   • Asignación autoritativa        • Verificación estricta propietario │
│                                                                        │
│   POST /api/orders                 GET /api/user/coupons               │
│   • Transacción atómica SQLite     • Aislamiento por usuario           │
│   • Consumo con times_used + 1     • Cupones vigentes y canjeados      │
│                                                                        │
│   PANEL ADMINISTRATIVO (/api/admin/coupons)                            │
│   • Creación general vs exclusivo • Activación/desactivación segura    │
└─────────────────────────────────────┬──────────────────────────────────┘
                                      │
┌─────────────────────────────────────▼──────────────────────────────────┐
│                 BASE DE DATOS PERSISTENTE (SQLITE WAL)                 │
│                                                                        │
│   Tabla: coupons                                                       │
│   • code (PK)                      • discount_percent                  │
│   • coupon_type (btl/commercial)   • target_type (general/exclusive)   │
│   • user_id (FK users.id)          • user_email                        │
│   • level_required                 • session_id                        │
│   • max_uses                       • times_used                        │
│   • expires_at                     • is_active                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 3. MODELO DE DATOS Y MIGRACIONES SQLITE

El esquema de la tabla `coupons` fue extendido mediante migraciones idempotentes en `server/db.ts`:

```sql
CREATE TABLE IF NOT EXISTS coupons (
  code TEXT PRIMARY KEY,
  discount_percent INTEGER NOT NULL,
  level_required INTEGER,
  max_uses INTEGER DEFAULT 9999,
  times_used INTEGER DEFAULT 0,
  expires_at TEXT,
  is_active INTEGER DEFAULT 1,
  description TEXT,
  created_at TEXT NOT NULL
);

-- Migraciones incrementales idempotentes (Fases 2F.2 y 2F.3)
ALTER TABLE coupons ADD COLUMN user_id TEXT;
ALTER TABLE coupons ADD COLUMN session_id TEXT;
ALTER TABLE coupons ADD COLUMN coupon_type TEXT DEFAULT 'commercial_general';
ALTER TABLE coupons ADD COLUMN user_email TEXT;
ALTER TABLE coupons ADD COLUMN target_type TEXT DEFAULT 'general';

CREATE INDEX IF NOT EXISTS idx_coupons_user_id ON coupons(user_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
```

#### Tipos de Cupones Soportados:
1. **Recompensa BTL (`coupon_type = 'btl'`, `target_type = 'exclusive'`):**
   - Emitido tras superar un nivel en "Las Aventuras de Pompón".
   - Formato de código: `MARIAI-XXXXXX` (charset criptográfico sin caracteres ambiguos `0/O`, `1/I`).
   - Porcentajes fijos: Nivel 1 = 5%, Nivel 2 = 10%, Nivel 3 = 15%.
   - Límite de usos: 1 por defecto.
   - Vinculado al `user_id` del jugador autenticado.
2. **Cupón Comercial Exclusivo (`coupon_type = 'commercial_exclusive'`, `target_type = 'exclusive'`):**
   - Creado por administración para un cliente registrado en específico.
   - Requiere `userId` obligatorio y existente.
   - Solo puede ser validado y redimido por el usuario propietario autenticado.
3. **Cupón Comercial General (`coupon_type = 'commercial_general'`, `target_type = 'general'`):**
   - Campañas públicas de la tienda (e.g. `POMPON5`, promociones estacionales).
   - Accesible a cualquier cliente mientras esté activo, vigente y dentro del límite de usos.

---

### 4. ENDPOINTS IMPLEMENTADOS Y ACTUALIZADOS

| Método | Endpoint | Rol / Acceso | Descripción |
|---|---|---|---|
| `POST` | `/api/btl/reward` | Público / Cliente | Emite cupón `MARIAI-XXXXXX` validando nivel (1, 2, 3) y sesión de juego previa sin duplicaciones. |
| `POST` | `/api/btl/claim-guest-reward` | Autenticado | Permite vincular a la cuenta del usuario un cupón BTL ganado en modo invitado. |
| `POST` | `/api/coupons/validate` | Público / Cliente | Valida cupón, verifica expiración, estado activo, límite de usos y propiedad de cuenta si es exclusivo. |
| `GET` | `/api/user/coupons` | Autenticado | Retorna los cupones personales del cliente autenticado y promociones generales vigentes. |
| `POST` | `/api/orders` | Público / Cliente | Registra la orden y ejecuta atómicamente la redención del cupón (`times_used + 1`). |
| `GET` | `/api/admin/coupons` | Administrador | Listado paginado con filtros por tipo (`all`, `btl`, `commercial_general`, `commercial_exclusive`) y estado. |
| `POST` | `/api/admin/coupons` | Administrador | Creación de cupón general o exclusivo para un cliente registrado seleccionado. |
| `PATCH` | `/api/admin/coupons/:code` | Administrador | Activación, desactivación y modificación segura de límites y vigencias. |

---

### 5. REGLAS DE SEGURIDAD Y REDENCIÓN TRANSACCIONAL

1. **Prevención de Suplantación de Propietario (Anti-Spoofing):**
   - La redención de cupones exclusivos (`target_type = 'exclusive'`) exige que la solicitud provenga de una sesión autenticada (`authUser`).
   - Se descartó la validación por correo tipeado en el formulario sin autenticación, impidiendo que un tercero ingrese el correo de otra persona para robar un cupón.
2. **Atomicidad Transaccional contra Condiciones de Carrera:**
   - La inserción de la orden y la redención del cupón se ejecutan en un bloque `db.transaction()`:
     ```sql
     UPDATE coupons 
     SET times_used = times_used + 1 
     WHERE code = ? AND is_active = 1 
       AND (max_uses IS NULL OR times_used < max_uses)
       AND (expires_at IS NULL OR datetime(expires_at) >= datetime('now'));
     ```
   - Si `changes === 0` (el cupón fue consumido concurrentemente o expiró), la transacción revierte por completo (`ROLLBACK`), evitando órdenes con descuentos indebidos.
3. **Inmutabilidad de Porcentajes BTL:**
   - Se bloquea la modificación administrativa del porcentaje de descuento en cupones con prefijo `MARIAI-` o `POMPON` emitidos por el motor de juego.
4. **Protección IDOR en Pedidos y Comprobantes PDF:**
   - Las órdenes y sus comprobantes PDF requieren credencial de propietario autenticado o el `access_token` criptográfico generado al momento de la compra.

---

### 6. CORRECCIONES VISUALES (APPLE LIQUID GLASS)

Se corrigieron los problemas de salto de línea en etiquetas en las tablas administrativas y de cliente:
- **Badges de Pedidos:**
  - `Pedido recibido` (`bg-stone-200 text-stone-800 border-stone-300`)
  - `En preparación` (`bg-amber-100 text-amber-900 border-amber-300`)
  - `Enviado` (`bg-blue-100 text-blue-900 border-blue-300`)
  - `Entregado` (`bg-emerald-100 text-emerald-900 border-emerald-300`)
- **Badges de Cupones:**
  - `Recompensa BTL` (`bg-purple-100 text-purple-900 border-purple-200`)
  - `Exclusivo Cliente` (`bg-amber-100 text-amber-900 border-amber-300`)
  - `Comercial General` (`bg-blue-100 text-blue-900 border-blue-200`)
  - Descuentos: `5% OFF`, `10% OFF`, `15% OFF` (`whitespace-nowrap inline-flex items-center justify-center shrink-0`)
- **Responsive:**
  - Tablas encapsuladas en contenedores con scroll horizontal suave (`overflow-x-auto min-w-[960px]`).

---

### 7. RESULTADOS DE LA SUITE DE PRUEBAS AUTOMATIZADAS

Ejecución sobre SQLite en vivo (`scripts/test-phase-2f3.ts`):

```
================================================================
TEST SUITE: FASE 2F.3 - SISTEMA DE CUPONES PERSONALIZADOS Y BTL
================================================================

--- 1. Registro e inicio de sesión ---
  [PASS] 1. Registro exitoso de usuario cliente A en SQLite
  [PASS] 2. Registro exitoso de usuario cliente B en SQLite
--- 2. Control de Acceso RBAC Administrativo ---
  [PASS] 3. Administrador principal autenticado exitosamente
  [PASS] 4. Cliente común rechazado con HTTP 403 en ruta administrativa /api/admin/coupons
  [PASS] 5. Administrador autorizado con HTTP 200 en /api/admin/coupons
--- 3. Creación y Validación de Cupón Comercial General ---
  [PASS] 6. Cupón comercial general creado exitosamente (HTTP 201)
  [PASS] 7. Tipo asignado correctamente como commercial_general
--- 4. Creación de Cupón Exclusivo para Usuario ---
  [PASS] 8. Cupón exclusivo creado exitosamente para Cliente A (HTTP 201)
  [PASS] 9. Cupón exclusivo vinculado al user_id de Cliente A
--- 5. Rechazos de Validación de Creación ---
  [PASS] 10. Rechazo de cupón exclusivo con usuario inexistente (HTTP 400)
  [PASS] 11. Rechazo de porcentaje de descuento mayor a 90% (HTTP 400)
  [PASS] 12. Rechazo de código duplicado con HTTP 409 Conflict
--- 8. Activación y Desactivación de Cupones ---
  [PASS] 13. Desactivación de cupón por administrador (HTTP 200)
  [PASS] 14. Cupón desactivado rechazado en /api/coupons/validate (valid: false)
--- 10. Control de Vencimiento y Límites ---
  [PASS] 15. Cupón con fecha de vencimiento expirada es rechazado
  [PASS] 16. Cupón con usos agotados (3/3) es rechazado
--- 12. Exclusividad de Cupones entre Usuarios ---
  [PASS] 17. Intento de Cliente B de validar cupón exclusivo de Cliente A retorna HTTP 403 Forbidden
  [PASS] 18. Usuario anónimo intentando validar cupón exclusivo retorna HTTP 403 Forbidden
  [PASS] 19. Cliente A (propietario) valida exitosamente su cupón exclusivo
--- 13. Recompensas BTL y Gamificación ---
  [PASS] 20. Sesión de juego BTL iniciada y registrada en SQLite
  [PASS] 21. Emisión de recompensa BTL tras completar Nivel 1
  [PASS] 22. Código generado cumple con formato único criptográfico MARIAI-XXXXXX
  [PASS] 23. Descuento emitido para Nivel 1 es 5% OFF
  [PASS] 24. Recompensa BTL asociada al user_id del jugador autenticado
  [PASS] 25. Solicitud repetida devuelve el cupón existente (Idempotencia BTL sin duplicar)
  [PASS] 26. Rechazo de nivel inválido o sesión manipulada (HTTP 400/403)
--- 17. Visualización y Filtros en Dashboard Administrativo ---
  [PASS] 27. Consulta filtrada de cupones BTL en dashboard administrativo
  [PASS] 28. Cupón BTL generado visible en listado administrativo
--- 18. Visualización en "Mis Cupones" ---
  [PASS] 29. Cupón comercial exclusivo visible en "Mis cupones" de Cliente A
  [PASS] 30. Recompensa BTL visible en "Mis cupones" de Cliente A
  [PASS] 31. Aislamiento estricto: Cliente B no puede ver los cupones exclusivos ni recompensas de Cliente A
--- 19. Validación y Redención en Checkout ---
  [PASS] 32. Validación en checkout aprueba cupón BTL
  [PASS] 33. Cálculo de descuento exacto: 5% de 50.000 = $2.500 COP
--- 20. Creación de Pedido con Redención Transaccional ---
  [PASS] 34. Creación de pedido persistente con cupón BTL (HTTP 201)
  [PASS] 35. Descuento aplicado en orden por el backend ($2.500 COP)
  [PASS] 36. Total calculado autoritativamente: Subtotal - Descuento + Envío
  [PASS] 37. times_used incrementado a 1 atómicamente en base de datos SQLite
--- 21. Prevención de Doble Redención ---
  [PASS] 38. Rechazo de segundo pedido con el mismo cupón de uso único ya consumido
--- 22. Regresión de Consulta y PDF ---
  [PASS] 39. Consulta individual de orden con access_token legítimo (HTTP 200)
  [PASS] 40. Descarga de comprobante PDF con token de seguridad (HTTP 200)
  [PASS] 41. Cabecera Content-Type es application/pdf
  [PASS] 42. Protección IDOR: Acceso a orden sin credencial ni token es bloqueado con HTTP 403

================================================================
TOTAL PRUEBAS: 42 | SUPERADAS: 42 | FALLIDAS: 0 (100% EXITOSAS)
================================================================
```

---

### 8. LIMITACIONES Y RIESGOS PENDIENTES

1. **Almacenamiento Local Efímero en AI Studio:**
   - La base de datos opera localmente en `./data/amigurumis_mariai.db`. Si el contenedor se destruye, los datos vuelven al estado del commit git. La sincronización cloud con Turso (`libSQL`) está preparada para la fase de producción.
2. **Pasarela de Pagos Simulada:**
   - Acorde al alcance académico y las instrucciones explícitas, los pagos continúan siendo simulaciones educativas sin pasarelas de cobro bancario real.
3. **Escalabilidad Horizontal:**
   - SQLite en modo WAL admite múltiples lectores y un escritor concurrente garantizado por transacciones serializables. Para tráfico masivo multi-instancia, se recomienda activar la réplica distribuida en Turso.
