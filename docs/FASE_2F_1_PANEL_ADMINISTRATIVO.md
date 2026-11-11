# INFORME TÉCNICO — FASE 2F.1: AUTENTICACIÓN ADMINISTRATIVA Y DASHBOARD BASE

**Proyecto:** Amigurumis Mariai — Plataforma E-commerce & Minivideojuego BTL  
**Fecha:** Noviembre de 2026  
**Fase:** 2F.1 — Autenticación Administrativa (RBAC) y Dashboard Base  
**Estado:** IMPLEMENTADO Y VERIFICADO AL 100%  

---

## 1. OBJETIVO DE LA FASE

El objetivo primordial de la **Fase 2F.1** consiste en dotar a la plataforma *Amigurumis Mariai* de un sistema administrativo formal, seguro y desacoplado, sustentado en control de acceso basado en roles (RBAC: *Role-Based Access Control*), junto con una interfaz de gestión profesional (Apple Liquid Glass) conectada a los datos reales persistidos en SQLite (`better-sqlite3`).

Asimismo, la fase deja organizada la infraestructura visual y tipada para la futura incorporación de canalizaciones analíticas (*Data Analytics* en Fase 3) y modelos predictivos (*Machine Learning* en Fase 4), sin incorporar modelos ficticios ni dependencias prematuras.

---

## 2. ARQUITECTURA DE AUTORIZACIÓN Y SISTEMA DE ROLES

### 2.1. Fuente de Verdad y Modelo de Datos
* **Columna `role` en la tabla `users`:**  
  Constituye la única fuente de verdad en el servidor (`role TEXT DEFAULT 'customer'`).
* **Roles Soportados:**
  1. `customer`: Rol asignado de manera obligatoria a todo usuario registrado públicamente vía `/api/auth/register`. Otorga acceso a la tienda, carrito, checkout, videojuego BTL y consulta de sus propias compras (`/compras`).
  2. `admin`: Rol de privilegio restringido que habilita el acceso al panel `/admin` y a los endpoints bajo `/api/admin/*`.

### 2.2. Validación Estricta en el Servidor
* El frontend **nunca** puede asignar roles. Los formularios de registro y actualización de perfil omiten o ignoran cualquier parámetro de rol enviado por el cliente.
* La sesión del usuario se valida en cada petición HTTP mediante el middleware `getAuthUser(req)`, el cual ejecuta una consulta `JOIN` entre la tabla `sessions` y `users`, recuperando el valor actual de `u.role` directamente desde la base de datos SQLite en tiempo real.
* Si una sesión caduca o es revocada mediante `/api/auth/logout`, cualquier intento posterior de consumo administrativo es denegado de forma inmediata.

```
                      ┌───────────────────────────────────────────────┐
                      │    Petición HTTP entrante (/api/admin/*)      │
                      └──────────────────────┬────────────────────────┘
                                             │
                                   [ getAuthUser(req) ]
                                             │
                        ¿Token válido y sesión activa en SQLite?
                                     ├── No ──► HTTP 401 Unauthorized
                                     │
                                    SÍ
                                     │
                             ¿user.role === 'admin'?
                                     ├── No ──► HTTP 403 Forbidden
                                     │
                                    SÍ
                                     ▼
                      ┌───────────────────────────────────────────────┐
                      │     Controlador Administrativo Ejecutado      │
                      └───────────────────────────────────────────────┘
```

---

## 3. PROCEDIMIENTO DE APROVISIONAMIENTO DEL ADMINISTRADOR

Para salvaguardar la seguridad de la plataforma y evitar vulnerabilidades comunes en entornos académicos (como credenciales de administración fijadas en el código fuente o endpoints públicos de escalado de privilegios), el aprovisionamiento de administradores se realiza de forma **explícita y manual** a través de la interfaz de línea de comandos (CLI).

### Script de Mantenimiento: `scripts/manage-admin.ts`
El script reside en el servidor y opera exclusivamente en modo mantenimiento local:

1. **Listar usuarios registrados:**
   ```bash
   npx tsx scripts/manage-admin.ts list
   ```
   Muestra un consolidado tabular con ID, Nombre, Email, Rol y Fecha de Creación.

2. **Promover una cuenta existente a `admin`:**
   ```bash
   npx tsx scripts/manage-admin.ts promote usuario@correo.com
   ```
   - Valida que el correo exista previamente en la base de datos.
   - Si no existe, instruye que el usuario debe registrarse previamente por la vía normal.
   - Actualiza de forma atómica el campo `role = 'admin'` en SQLite.
   - El cambio toma efecto de forma instantánea sin requerir reinicio del servidor.

3. **Revocar privilegios de administración (`demote`):**
   ```bash
   npx tsx scripts/manage-admin.ts demote usuario@correo.com
   ```
   Restablece el rol a `customer`, revocando el acceso a `/admin` de inmediato.

> **Importante:** La cuenta de demostración (`maria@amigurumismariai.com`) se conserva intencionalmente como `customer` para permitir la prueba continua del flujo de clientes regulares sin privilegios.

---

## 4. ENDPOINTS DE LA API ADMINISTRATIVA (`/api/admin/*`)

Todos los endpoints implementados son de **solo lectura**, operan sobre datos reales de SQLite y aplican el middleware `requireAdmin`:

| Método | Endpoint | Rol Mínimo | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/me` | `admin` | Verifica el estado del administrador actual y retorna sus datos públicos. |
| `GET` | `/api/admin/overview` | `admin` | Agregación de KPIs: total de órdenes, ingresos simulados acumulados, ticket promedio, clientes registrados, cupones canjeados, partidas BTL y últimas 5 compras. |
| `GET` | `/api/admin/orders` | `admin` | Listado paginado de pedidos (`page`, `limit`, `status`). Retorna cliente, totales, ítems, método de pago/envío y estado. |
| `GET` | `/api/admin/customers` | `admin` | Listado paginado de clientes registrados, historial de pedidos acumulados y monto total gastado en COP (sin hashes de contraseña ni tokens). |
| `GET` | `/api/admin/coupons` | `admin` | Listado de cupones BTL y promocionales con contadores de uso (`times_used`), topes y vigencia. |
| `GET` | `/api/admin/btl/overview` | `admin` | Métricas del videojuego de Pompón: partidas jugadas, victorias, ovillos recolectados, tasa de éxito y desglose por nivel. |

### Protección contra Fuga de Información Sensible
Las consultas SQL seleccionan de forma explícita únicamente las columnas necesarias. Bajo ninguna circunstancia se retornan:
- Hashes de contraseñas (`password_hash`).
- Tokens de sesión (`token`).
- Claves privadas ni tokens de pago.

---

## 5. DASHBOARD ADMINISTRATIVO EN EL FRONTEND (`/admin`)

### 5.1. Componente Principal: `src/pages/AdminDashboardPage.tsx`
* **Estilo Visual:** Apple Liquid Glass, glassmorphism con bordes translúcidos (`liquid-glass`), tipografía sans-serif moderna (*Plus Jakarta Sans*), microinteracciones y paleta cálida (ámbar artesanal y piedra).
* **Navegación:**
  - Barra lateral (*sidebar*) en escritorio con accesos directos y distintivos numéricos.
  - Barra responsive superior adaptada a tabletas y teléfonos móviles.
  - Acceso directo para retornar a la tienda pública (`/`) o cerrar sesión.

### 5.2. Secciones Funcionales Implementadas
1. **Resumen Ejecutivo (`overview`):**
   - Tarjetas KPI: Ventas Simuladas Totales, Pedidos Totales, Clientes Registrados, Actividad BTL.
   - Tabla rápida de órdenes recientes.
   - Banner de estado de salud de SQLite y modo demostración académica.
2. **Gestión de Pedidos (`orders`):**
   - Pestañas de filtrado rápido por estado (`todos`, `pedido_recibido`, `en_preparacion`, `enviado`, `entregado`).
   - Tabla paginada con controles Anterior/Siguiente.
3. **Directorio de Clientes (`customers`):**
   - Listado tabular con nombre, correo, teléfono, ciudad, órdenes asociadas y gasto acumulado.
4. **Cupones & Recompensas BTL (`coupons`):**
   - Monitoreo del estado activo, porcentaje de descuento y ratio de utilización de códigos `POMPON*` y `MARIAI-*`.
5. **Telemetría de Pompón BTL (`btl`):**
   - Desglose por nivel de juego: *El Bosque de los Ovillos* (Nivel 1), *El Taller Encantado* (Nivel 2) y *El Castillo de las Puntadas* (Nivel 3).
6. **Data Analytics (`analytics`) [Preparado para Fase 3]:**
   - Panel estructurado que expone la arquitectura analítica futura (Series temporales de ventas, Embudo de conversión comercial multi-etapa) con etiquetas explícitas que indican su preparación sin simulación engañosa.
7. **Machine Learning (`ml`) [Preparado para Fase 4]:**
   - Fichas conceptuales de inferencia futura: Sistema de recomendación artesanal, Pronóstico de demanda de insumos (algodón y vellón) y Detección de anomalías en cupones BTL.

---

## 6. PREPARACIÓN ESTRUCTURAL PARA DATA ANALYTICS Y MACHINE LEARNING

En concordancia con los principios de arquitectura de software, se establecieron los contratos formales en `src/types/analytics.ts` y las interfaces de visualización en el dashboard:
* **Separación de Responsabilidades:** El motor transaccional OLTP (SQLite) opera de manera independiente a las futuras capas de agregación analítica (OLAP).
* **Interfaces Disponibles:** `CommercialKpisSummary`, `BtlGamificationKpisSummary`, `DemandForecastResult`, `SalesForecastResult`, `CustomerSegmentResult` y `AdminDashboardData`.
* **Rigor Metodológico:** No se introdujeron datos predictivos inventados ni librerías pesadas (TensorFlow, Scikit-Learn) antes de tiempo, preservando la ligereza y rendimiento del bundle Vite.

---

## 7. BATERÍA DE PRUEBAS EJECUTADAS

Se diseñó y ejecutó la suite automatizada `scripts/test-admin-auth.ts`, obteniendo una tasa de aprobación del **100% (20/20 pruebas exitosas)**:

1. **Rechazo Anónimo (401):** Solicitudes sin sesión hacia `/api/admin/overview` y subrutas retornan `401 Unauthorized`.
2. **Rechazo de Cliente Regular (403):** Usuarios autenticados con rol `customer` son bloqueados con `403 Forbidden` en todos los endpoints administrativos.
3. **Acceso Autorizado (200):** Usuario promovido a `admin` accede correctamente a `/api/admin/me`, `/api/admin/overview`, `/api/admin/orders`, `/api/admin/customers`, `/api/admin/coupons` y `/api/admin/btl/overview`.
4. **Higiene de Datos:** Comprobación estricta de que las respuestas JSON de clientes carecen de campos como `password_hash` o credenciales.
5. **Paginación:** Verificación de que las respuestas de pedidos y clientes respetan los límites `page` y `limit`.
6. **Integridad Comercial y de Juego:** Ejecución simultánea de `scripts/test-auth-and-features.ts` (10/10 pruebas exitosas), confirmando que el catálogo, carrito, cupones y checkout tradicional continúan operando sin regresiones.
7. **Compilación Estática:** `npm run build` ejecutado exitosamente (1.692 módulos procesados).

---

## 8. LIMITACIONES ACTUALES

1. **Solo Lectura:** El panel administrativo actual no permite modificar estados de pedidos (ej. cambiar de `pedido_recibido` a `enviado`) ni editar cupones desde la UI; esto se contemplará en la Fase 2F.2.
2. **Métricas en Memoria:** Las consultas de analítica se computan mediante agregaciones SQL en SQLite. Para conjuntos de datos de gran escala (Big Data), se requerirá la sincronización con un almacén analítico especializado en la Fase 3.

---

## 9. PRÓXIMO PASO RECOMENDADO

**Fase 2F.2: Gestión Operativa de Pedidos y Aprovisionamiento Remoto:**
- Permitir al administrador cambiar el estado de los pedidos desde la tabla administrativa.
- Habilitar la creación manual de cupones promocionales desde el panel.
- Validar la persistencia remota en Turso antes del empaquetado final para producción.
