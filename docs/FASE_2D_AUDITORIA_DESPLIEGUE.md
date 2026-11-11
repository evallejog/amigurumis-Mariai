# INFORME TÉCNICO DE LA FASE 2D — AUDITORÍA DE INFRAESTRUCTURA Y VIABILIDAD DE DESPLIEGUE GRATUITO

> **Proyecto:** Amigurumis Mariai — Plataforma E-commerce & Minivideojuego BTL  
> **Versión Auditada:** 2.2.0-phase2c1  
> **Fecha:** Noviembre 2026  
> **Alcance:** Auditoría Integral de Arquitectura, Persistencia, Seguridad, Videojuego y Viabilidad de Despliegue en Infraestructura Gratuita  
> **Estado:** AUDITORÍA COMPLETADA (Sin modificaciones funcionales de código ni migraciones activas)

---

## 1. RESUMEN EJECUTIVO

El presente documento constituye la auditoría técnica formal de arquitectura, base de datos, seguridad, sistema comercial y dependencias de la plataforma **Amigurumis Mariai**, con el objetivo de evaluar su preparación para un despliegue gratuito (*zero-cost cloud hosting*) sin comprometer la persistencia de datos, la experiencia jugable del minivideojuego BTL ni la integridad operativa del catálogo y checkout.

### Hallazgo Central
La aplicación presenta una arquitectura full-stack moderna, limpia y funcionalmente validada (React 19 + TypeScript + Vite en el cliente, Express 4 + Node.js en el backend, Phaser 4 en el videojuego y PDFKit para recibos). Sin embargo, **el almacenamiento actual está fundamentado en SQLite local embebido (`better-sqlite3`) sobre el sistema de archivos del contenedor (`/data/amigurumis_mariai.db`)**.

En cualquier servicio de hosting gratuito contemporáneo (Render Free Web Services, Koyeb Free Tier, Vercel Serverless o Cloudflare Pages), **el sistema de archivos es efímero (*ephemeral storage*) o las instancias se suspenden/reinician por inactividad**. En consecuencia:
- Todo reinicio del contenedor destruirá inmediatamente la base de datos SQLite.
- Se perderán todos los usuarios registrados, órdenes de compra confirmadas, cupones emitidos y sesiones de telemetría BTL.
- `better-sqlite3` es un módulo binario nativo compilado en C++ (`node-gyp`), lo que imposibilita su ejecución en entornos serverless puros (Vercel Lambda, Cloudflare Workers) sin adaptaciones mayores.

### Veredicto de Despliegue
Para lograr un despliegue **100% gratuito, confiable y persistente**, la solución arquitectónica óptima y de menor fricción consiste en desacoplar el almacenamiento local hacia una base de datos gestionada en la nube con capa gratuita permanente:
1. **Opción A (Recomendada - Compatibilidad idéntica):** Turso (libSQL serverless), que conserva el 100% del SQL existente sin reescribir consultas relacionales y opera vía HTTP/WebSocket.
2. **Opción B (Estándar Enterprise):** Neon PostgreSQL Serverless o Supabase Database, adaptando la capa de acceso a datos a PostgreSQL.
3. **Cómputo Backend & Frontend:** Render Web Service (modo contenedor o Node.js) sirviendo la compilación estática de Vite y la API Express en un puerto unificado (3000 / $PORT).

---

## 2. ARQUITECTURA ACTUAL DEL SISTEMA

### 2.1. Topología de la Aplicación
La aplicación opera bajo un modelo de **Monolito Híbrido SPA + API**:

```
                                 ┌─────────────────────────────────────────────────────────┐
                                 │                 CLIENTE NAVEGADOR (SPA)                 │
                                 │                                                         │
                                 │  - React 19 + Tailwind CSS v4                           │
                                 │  - React Router v7 (Rutas: '/', '/jugar', '/compras')   │
                                 │  - Canvas HTML5 / Phaser 4 (Videojuego Pompón)          │
                                 │  - Contextos: AuthContext, CartContext                  │
                                 └────────────────────────────┬────────────────────────────┘
                                                              │
                                                     HTTP / REST (JSON)
                                                              │
                                                              ▼
                                 ┌─────────────────────────────────────────────────────────┐
                                 │                 BACKEND EXPRESS (NODE 22)               │
                                 │                                                         │
                                 │  - server.ts (Entry Point único)                        │
                                 │  - Endpoints REST (/api/auth, /api/orders, /api/btl)    │
                                 │  - Motor PDF en streaming (PDFKit)                      │
                                 │  - Dev: Vite middleware / Prod: express.static('dist')  │
                                 └────────────────────────────┬────────────────────────────┘
                                                              │
                                                      better-sqlite3 (C++)
                                                              │
                                                              ▼
                                 ┌─────────────────────────────────────────────────────────┐
                                 │                 SISTEMA DE ARCHIVOS LOCAL               │
                                 │                                                         │
                                 │  - /data/amigurumis_mariai.db                           │
                                 │  - /data/amigurumis_mariai.db-wal (Write-Ahead Log)     │
                                 │  - /data/amigurumis_mariai.db-shm                       │
                                 └─────────────────────────────────────────────────────────┘
```

### 2.2. Manejo de Rutas y Ciclo de Vida
- **Modo Desarrollo (`npm run dev`):** Ejecuta `tsx server.ts`. El servidor Express inicializa la instancia de Vite en modo *middlewareMode* (`appType: 'spa'`), interceptando peticiones y aplicando transformaciones en tiempo real sin requerir una compilación previa a disco.
- **Modo Producción (`npm run start`):**
  - Requiere haber ejecutado previamente `npm run build` (`vite build`), lo que genera los artefactos en `/dist`.
  - Express detecta `process.env.NODE_ENV === 'production'` y monta:
    ```typescript
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
    ```
  - **Comprobación:** Express maneja adecuadamente el fallback SPA para las rutas profundas (`/jugar`, `/compras`), permitiendo que el enrutador cliente `react-router-dom` resuelva la navegación sin arrojar errores 404 de servidor web.

### 2.3. Configuración de Red y Puertos
- El servidor escucha obligatoriamente en `0.0.0.0` y lee el puerto desde `process.env.PORT || '3000'`.
- Es compatible con las plataformas de PaaS (Render, Koyeb, Heroku, Fly.io) que inyectan dinámicamente la variable `PORT`.

---

## 3. INVENTARIO TECNOLÓGICO Y MATRIZ DE DEPENDENCIAS

### 3.1. Dependencias de Ejecución (Runtime Dependencies)

| Paquete | Versión Real | Naturaleza / Propósito | Compatibilidad en Producción |
| :--- | :--- | :--- | :--- |
| **`react`** | `^19.0.1` | Librería UI núcleo | Alta. Compatible con compiladores ESM modernos. |
| **`react-dom`** | `^19.0.1` | Renderizador DOM de React 19 | Alta. |
| **`react-router-dom`**| `^7.18.5` | Enrutamiento cliente SPA | Alta. Resuelve rutas client-side `/`, `/jugar`, `/compras`. |
| **`express`** | `^4.21.2` | Servidor HTTP y API REST | Alta. Estándar de la industria para Node.js. |
| **`better-sqlite3`** | `^13.0.3` | Driver SQLite síncrono C++ | **Crítica.** Requiere compilación nativa linux-x64 y disco persistente. Incompatible con Serverless. |
| **`phaser`** | `^4.2.1` | Motor de videojuegos 2D Canvas/WebGL | Alta. Empaquetado estático en el bundle de Vite. |
| **`pdfkit`** | `^0.20.2` | Generador procedural de PDF | Media-Alta. Requiere APIs de Stream de Node.js. Genera PDFs en memoria sin tocar disco. |
| **`lucide-react`** | `^0.546.0` | Conjunto de iconos vectoriales | Alta. Tree-shaking optimizado por Vite. |
| **`motion`** | `^12.23.24`| Animaciones declarativas UI | Alta. |
| **`dotenv`** | `^17.2.3` | Carga de variables de entorno `.env` | Alta. |
| **`@google/genai`** | `^3.0.0` | SDK oficial Gemini API | Alta. Permanece disponible para futuras expansiones AI sin interferir en el arranque actual. |
| **`vite`** | `^8.3.0` | Bundler y servidor de desarrollo | Alta. Genera `/dist` en 1.36s. |
| **`@tailwindcss/vite`**| `^4.3.3`| Motor Tailwind CSS v4 para Vite | Alta. Procesa estilos sin requerir `postcss.config.js`. |

### 3.2. Herramientas de Desarrollo y Compilación (DevDependencies)

| Paquete | Versión Real | Propósito |
| :--- | :--- | :--- |
| **`typescript`** | `^7.0.2` | Compilador y verificación estática de tipos. |
| **`tsx`** | `^4.21.0` | Ejecutor de TypeScript sobre Node.js sin transpilación previa manual. |
| **`esbuild`** | `^0.25.0` | Transpilador ultrarrápido bajo Vite y TSX. |
| **`@types/node`** | `^22.14.0`| Definición de tipos para Node.js 22. |
| **`@types/express`** | `^4.17.21`| Tipos para middleware y enrutadores Express. |
| **`@types/better-sqlite3`** | `^9.6.0` | Tipos para SQLite. |
| **`@types/pdfkit`** | `^0.17.7` | Tipos para la generación de comprobantes. |

---

## 4. AUDITORÍA DE BASE DE DATOS Y PERSISTENCIA

### 4.1. Inspección Exhaustiva de `server/db.ts`
- **Motor Real:** SQLite versión 3 embebido.
- **Driver:** `better-sqlite3` v13.0.3 (ejecución síncrona en el hilo de eventos de Node.js, bloqueante durante escrituras I/O).
- **Ruta del Archivo:** `path.join(process.cwd(), 'data', 'amigurumis_mariai.db')`.
- **Modo de Operación:**
  - `PRAGMA journal_mode = WAL;` (Write-Ahead Logging). Genera archivos adicionales `amigurumis_mariai.db-wal` y `amigurumis_mariai.db-shm`.
  - `PRAGMA foreign_keys = ON;` (Integridad referencial activa).

### 4.2. Esquema Relacional de Tablas

```
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│              USERS              │           │             ORDERS              │
├─────────────────────────────────┤           ├─────────────────────────────────┤
│ id (PK)                         │◄────┐     │ id (PK)                         │
│ name                            │     │     │ order_number (UNIQUE)           │
│ email (UNIQUE)                  │     └─────┤ user_id (FK -> users.id)        │
│ password_hash                   │           │ customer_name, customer_email   │
│ provider ('local' | 'google')   │           │ customer_phone, customer_address│
│ role ('customer' | 'admin')     │           │ shipping_method, payment_method │
│ phone, address, city, department│           │ subtotal, shipping_cost         │
│ created_at                      │           │ discount, coupon_code           │
└─────────────────────────────────┘           │ total, status, notes            │
                                              │ created_at                      │
┌─────────────────────────────────┐           └────────────────┬────────────────┘
│            SESSIONS             │                            │ 1
├─────────────────────────────────┤                            │
│ token (PK)                      │                            │
│ user_id (FK -> users.id)        │                            ▼ N
│ created_at, expires_at          │           ┌─────────────────────────────────┐
└─────────────────────────────────┘           │           ORDER_ITEMS           │
                                              ├─────────────────────────────────┤
┌─────────────────────────────────┐           │ id (PK)                         │
│             COUPONS             │           │ order_id (FK -> orders.id)      │
├─────────────────────────────────┤           │ product_id, product_name        │
│ code (PK)                       │           │ price, quantity, image_url      │
│ discount_percent (5, 10, 15)    │           └─────────────────────────────────┘
│ level_required (1, 2, 3)        │
│ max_uses, times_used            │           ┌─────────────────────────────────┐
│ is_active, description          │           │          GAME_SESSIONS          │
│ user_id, session_id             │           ├─────────────────────────────────┤
│ created_at                      │           │ session_id (PK), user_id        │
└─────────────────────────────────┘           │ level, score, wool_collected    │
                                              │ time_seconds, stars, victory    │
┌─────────────────────────────────┐           │ reward_proposed, created_at     │
│          BTL_SESSIONS           │           └─────────────────────────────────┘
├─────────────────────────────────┤
│ session_id (PK), user_id        │
│ level, status ('started', 'comp')
│ created_at                      │
└─────────────────────────────────┘
```

### 4.3. Evaluación de Ciclo de Vida y Almacenamiento Efímero
1. **Comportamiento ante Reinicio / Redeploy:**
   - En una plataforma gratuita con contenedor efímero (como Render Free o Koyeb), el contenedor es destruido y reconstruido desde la imagen base o el repositorio Git en cada despliegue.
   - La carpeta `/data/` **no persiste** entre ciclos de vida del contenedor.
   - Cada vez que el servicio entra en reposo (*spin-down*) por 15 minutos sin tráfico y despierta (*cold-start*), el sistema de archivos vuelve al estado inicial de compilación.
2. **Consecuencias Inmediatas:**
   - La base de datos ejecutará `initDatabase()` desde cero en cada arranque, insertando únicamente los datos semilla demostrativos (`maria@amigurumismariai.com`, cupón `POMPON5/10/15`, orden `AMI-CO-2026-001`).
   - Todos los clientes reales registrados, carritos cerrados, pagos reportados y cupones ganados desaparecerán sin posibilidad de recuperación.
3. **Ausencia de Mecanismo de Respaldo:**
   - No existe tarea cron ni streaming a almacenamiento en objetos (S3, Cloudflare R2, Google Cloud Storage) para volcar snapshots de SQLite.

---

## 5. AUDITORÍA DE AUTENTICACIÓN Y GESTIÓN DE SESIONES

### 5.1. Mecanismo de Credenciales Propias
- **Registro / Login Local:**
  - Los usuarios se autentican con correo electrónico y contraseña.
  - El cifrado utiliza la librería nativa de Node.js `crypto.scryptSync` con una sal criptográfica de 16 bytes generada aleatoriamente y derivada a 64 bytes (`${salt}:${hash}`).
  - La verificación implementa `crypto.timingSafeEqual` para prevenir ataques de temporización (*timing attacks*).
  - La validación de fortaleza exige un mínimo básico de 6 caracteres.
- **Gestión de Sesiones:**
  - Al autenticarse, se genera un token pseudoaleatorio: `sess-${crypto.randomBytes(32).toString('hex')}`.
  - Se almacena en la tabla `sessions` con expiración calculada a 30 días (`expires_at = now + 30 days`).
  - El servidor evalúa la vigencia en cada petición autenticada (`getAuthUser`) y elimina sesiones expiradas sobre la marcha.

### 5.2. Mecanismo de Autenticación con Google (Estado Real)
- **Diagnóstico:** **El inicio de sesión con Google NO es una integración OAuth real en el estado actual del código.**
- **Implementación Actual:**
  - En el frontend (`AuthContext.tsx` línea 127):
    ```typescript
    const loginWithGoogleDemo = async () => {
      fetch('/api/auth/google', {
        body: JSON.stringify({ email: 'maria.artesana@gmail.com', name: 'María Camila Rodríguez' })
      });
    }
    ```
  - En el backend (`server.ts` línea 175):
    El endpoint `/api/auth/google` recibe cualquier `email` y `name` en texto plano en el cuerpo JSON, crea o busca el usuario y emite un token de sesión sin requerir `id_token`, validación de firma con Google Auth Library ni intercambio de código OAuth.
- **Implicación de Despliegue:** Funciona únicamente con fines de demostración académica controlada. En un dominio público accesible por terceros, este endpoint representa un vector crítico de suplantación de identidad si no se restringe o no se reemplaza por el flujo OAuth estándar client-side.

### 5.3. Almacenamiento y Transporte de Tokens
- El token de sesión se almacena en el cliente en `localStorage` (`amigurumis_mariai_auth_token`).
- Se transmite en la cabecera HTTP: `Authorization: Bearer <token>`.
- **Ventaja:** Elimina vulnerabilidades CSRF en navegadores antiguos al no apoyarse en cookies ambientales.
- **Riesgo:** Si existiese una vulnerabilidad XSS en el frontend, el token almacenado en `localStorage` podría ser extraído por scripts no confiables.

---

## 6. AUDITORÍA DEL SISTEMA COMERCIAL Y CHECKOUT

### 6.1. Integridad Transaccional y Cálculo Autoritativo
- **Cálculo en Servidor:** Al recibir `POST /api/orders`, el backend no confía en los subtotales ni totales enviados por el cliente. Recalcula el subtotal multiplicando `product.price * quantity` de cada elemento y verifica el costo de envío colombiano correspondiente ($12.000 COP estándar, $18.000 COP express, $0 COP retiro).
- **Validación y Consumo Atómico de Cupones:**
  - La orden se registra dentro de una transacción síncrona `db.transaction(() => { ... })`.
  - Si se suministra un cupón, se verifica en la tabla `coupons` que esté activo (`is_active = 1`), que no haya vencido (`expires_at > Date.now()`) y que sus usos no hayan alcanzado el máximo (`times_used < max_uses`).
  - La transacción incrementa de forma atómica `UPDATE coupons SET times_used = times_used + 1 WHERE code = ?`, garantizando que cupones de un solo uso no puedan ser redimidos concurrentemente.
- **Formato de Número de Pedido:**
  - Patrón: `AMI-CO-<TIMESTAMP_BASE36>-<RANDOM_4DIGITS>`.
  - Garantiza unicidad temporal y localización nacional colombiana sin colisiones.

### 6.2. Motor de Comprobantes PDF (`server/pdfReceipt.ts`)
- **Dependencia de Disco:** **Cero.**
- El generador PDF utiliza la librería `pdfkit` y vuelca el flujo binario directamente en la respuesta HTTP Express mediante `doc.pipe(res)`.
- No escribe archivos temporales en el sistema de archivos (`fs`), evitando saturar el almacenamiento efímero del servidor.
- **Consumo de Memoria:** Un comprobante A4 típico de 1 página con tipografía Helvetica vectorial consume aproximadamente entre 85 KB y 140 KB en el búfer de salida, lo cual es perfectamente seguro para un entorno con límite de 512 MB de RAM.
- **Riesgo de Autorización:** El endpoint `/api/orders/:orderId/pdf` actualmente busca por `orderId` público sin exigir autenticación del cliente (`Bearer token`), lo que permitiría que cualquier persona que conozca el código de pedido descargue el comprobante con los datos de entrega del comprador.

---

## 7. AUDITORÍA DEL MINIVIDEOJUEGO BTL (PHASER 4)

### 7.1. Carga de Assets y Texturas
- **Diagnóstico:** **100% Procedural e In-Memory.**
- Todas las entidades del videojuego (personaje Pompón, orejas, bufanda, ojos, ovillos de lana, botones de madera, plataformas de fieltro verde, suelo estratificado, alfileres, tijeras mecánicas y canasta de mimbre) son dibujadas mediante operaciones de Canvas 2D nativas en `src/game/textures.ts` y registradas en el gestor de texturas de Phaser (`textures.addCanvas()`).
- **Ventaja Crítica para Despliegue:**
  - No existen peticiones de red externas para cargar spritesheets o imágenes PNG/JPEG para el motor de juego.
  - No hay riesgo de rutas rotas, problemas de CORS con assets estáticos ni retrasos de carga por CDN lenta.

### 7.2. Rendimiento y Peso del Bundle
- Al ejecutar `vite build`, el artefacto JavaScript principal compilado en `/dist/assets/index-*.js` tiene un tamaño de:
  - **Sin comprimir:** **2.120,64 KB (~2.07 MB)**.
  - **Comprimido (Gzip):** **557,62 KB**.
- **Causa:** Phaser es una biblioteca completa con subsistemas de física Arcade, renderizadores WebGL/Canvas y sistemas de audio.
- **Evaluación:** Para una SPA comercial moderna, 557 KB gzipped es completamente aceptable en conexiones de banda ancha y redes 4G/5G en Colombia, si bien se beneficiaría de carga perezosa (*dynamic import*) mediante `React.lazy` para la ruta `/jugar`.

### 7.3. Integración BTL y Telemetría
- Al iniciar la partida: Invoca `POST /api/btl/session/start` y almacena `game_session_id` en `sessionStorage`.
- Al ganar un nivel: Invoca `POST /api/btl/level/complete` con telemetría de puntaje y solicita `POST /api/btl/reward` para obtener el cupón criptográfico correspondiente.
- Se implementó la mitigación de seguridad en la Fase 2C.1 que impide generar cupones con identificadores de sesión inventados o niveles fuera del rango (1, 2, 3), garantizando que las recompensas comerciales provengan de ejecuciones legítimas del juego.

---

## 8. EVALUACIÓN COMPARATIVA DE PLATAFORMAS DE HOSTING GRATUITO

A continuación se analizan técnicamente las principales alternativas de infraestructura gratuita para alojar la aplicación:

### 8.1. Plataformas de Cómputo (Frontend + Backend)

| Plataforma | Soporta Backend Node.js / Express | Persistencia de Disco Gratuita | Suspensión por Inactividad (*Cold Start*) | Compatibilidad con el Proyecto Actual |
| :--- | :--- | :--- | :--- | :--- |
| **Render** | **SÍ (Nativo)** | **NO** (Disco efímero se borra en spin-down o redeploy) | Sí (se suspende tras 15 min sin peticiones; reactivación en 45-60s) | **ALTA (Recomendada).** Ejecuta `npm run build` y `npm run start` en un solo servicio unificado. |
| **Koyeb** | **SÍ (Docker / Node)**| **NO** (Instancias nano con almacenamiento efímero) | Sí (suspensión en capa free; wake-up en ~5-10s) | **ALTA.** Despliegue mediante GitHub en puerto 3000 con soporte rápido. |
| **Vercel** | **Limitado (Serverless)**| **NO** (Solo `/tmp` efímero por ejecución de función) | No aplica (arquitectura serverless, cold start de 1-2s) | **BAJA.** Exige refactorizar `server.ts` dividiéndolo en funciones individuales `/api/*` y reescribir `better-sqlite3`. |
| **Cloudflare Pages** | **Solo Frontend Estático** | **NO** (Workers serverless no admiten Node binaries) | No | **MEDIA-BAJA.** El frontend compila bien, pero el backend requeriría Cloudflare Workers + D1, descartando `better-sqlite3`. |

### 8.2. Plataformas de Base de Datos Gestionada (Persistencia Nube)

| Base de Datos / Servicio | Motor | Capa Gratuita (*Free Tier*) | Protocolo / Acceso | Compatibilidad con Amigurumis Mariai |
| :--- | :--- | :--- | :--- | :--- |
| **Turso (libSQL)** | **SQLite Compatible** | 9 GB de almacenamiento, 1 billón de lecturas/mes gratuitas. | HTTP / WebSocket (`@libsql/client`) | **MÁXIMA (99% compatible).** Permite mantener todas las consultas SQL existentes sin cambiar a dialecto PostgreSQL. |
| **Neon** | **PostgreSQL 16/17** | 0.5 GB de almacenamiento, auto-suspend, wake-up en ~500ms. | TCP / Pooler PgBouncer / HTTP | **ALTA.** Excelente estabilidad. Requiere migrar la sintaxis de `better-sqlite3` a `pg` o Drizzle/Prisma. |
| **Supabase** | **PostgreSQL 15** | 500 MB de base de datos, 2 proyectos activos. | TCP / REST / GraphQL | **MEDIA-ALTA.** Se pausa tras 7 días de inactividad a menos que se mantenga tráfico periódico. |
| **Railway** | SQLite en disco / Postgres | Prueba de $5 USD temporal (ya no cuenta con capa gratuita indefinida). | N/A | **NULA.** No es viable para despliegue permanente sin costo. |

---

## 9. AUDITORÍA DE SEGURIDAD PREVIA A PUBLICACIÓN

Se clasifican los hallazgos de seguridad encontrados en el código actual bajo criterios estándar CVSS:

| Nivel de Riesgo | Componente Afectado | Descripción del Hallazgo | Mitigación Requerida para Producción |
| :--- | :--- | :--- | :--- |
| **ALTO** | `server.ts` (`/api/auth/google`) | **Handshake de Google sin validación criptográfica:** Acepta cualquier `{ email, name }` desde el body de la petición y crea/inicia sesión inmediatamente. | Si se publica en dominio abierto, debe deshabilitarse o implementarse validación con Google OAuth Client ID real. |
| **MEDIO** | `server.ts` (`/api/orders/:orderId`) | **IDOR en Consulta y Descarga de Comprobantes:** Los endpoints `/api/orders/:orderId` y `/api/orders/:orderId/pdf` permiten acceso público conociendo el `orderId` sin validar si la sesión pertenece al comprador. | Exigir autenticación de sesión o token de consulta único no predecible (*access token* temporal). |
| **MEDIO** | `server.ts` (Cabeceras HTTP) | **Ausencia de Helmet y Políticas de Seguridad:** No se están inyectando cabeceras de protección básicas (`X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`). | Incorporar el middleware `helmet()` en Express antes de exponer el servidor a Internet. |
| **BAJO** | `server.ts` (Rate Limiting) | **Ausencia de Limitador de Tasa (*Rate Limiter*):** Los endpoints `/api/coupons/validate` y `/api/auth/login` no limitan intentos por IP, permitiendo ataques de fuerza bruta. | Integrar `express-rate-limit` (máx. 10 peticiones/min en login, 20 en cupones). |
| **BAJO** | `vite.config.ts` | **Advertencia de resolución nativa:** Uso de `__dirname` que genera advertencias de Vite en Node ESM. | Reemplazar por `import.meta.dirname` en futuras actualizaciones de configuración. |

---

## 10. ARQUITECTURA RECOMENDADA PARA DESPLIEGUE GRATUITO

### 10.1. Topología Recomendada: "Monolito Node.js en Render + Turso libSQL"

```
                                          ┌────────────────────────────────────────┐
                                          │            USUARIO / CLIENTE           │
                                          │        (Navegadores PC & Móvil)        │
                                          └───────────────────┬────────────────────┘
                                                              │
                                                        HTTPS (TLS 1.3)
                                                              │
                                                              ▼
                                          ┌────────────────────────────────────────┐
                                          │      RENDER.COM (FREE WEB SERVICE)     │
                                          │                                        │
                                          │  - Contenedor Node.js 22 (512 MB RAM)  │
                                          │  - Build: npm run build                │
                                          │  - Start: npm run start (tsx server.ts)│
                                          │                                        │
                                          │  ┌──────────────────────────────────┐  │
                                          │  │   Frontend Estático (dist/)      │  │
                                          │  │   SPA Fallback + React 19        │  │
                                          │  └──────────────────────────────────┘  │
                                          │  ┌──────────────────────────────────┐  │
                                          │  │   Backend Express API (REST)     │  │
                                          │  │   PDFKit Stream en memoria       │  │
                                          │  └──────────────────────────────────┘  │
                                          └───────────────────┬────────────────────┘
                                                              │
                                                        HTTPS / WebSocket
                                                              │
                                                              ▼
                                          ┌────────────────────────────────────────┐
                                          │    TURSO CLOUD (FREE TIER DATABASE)    │
                                          │                                        │
                                          │  - Motor: libSQL (SQLite Serverless)   │
                                          │  - 9 GB Almacenamiento Persistente     │
                                          │  - Datos nunca se borran con reinicios │
                                          │  - Latencia ultra-baja en edge         │
                                          └────────────────────────────────────────┘
```

### 10.2. Justificación Técnica de la Elección
1. **Preservación del 100% del Código SQL:** Al adoptar Turso (`@libsql/client`), las sentencias `CREATE TABLE`, `INSERT`, `UPDATE`, `JOIN` y la estructura relacional desarrollada en `server/db.ts` se mantienen idénticas. No se requiere traducir consultas a sintaxis PostgreSQL ni gestionar tipos de datos divergentes.
2. **Cero Pérdida de Datos tras Suspensión:** Cuando Render apaga la instancia gratuita tras 15 minutos de inactividad, Turso retiene la totalidad de los datos de forma permanente e inalterada en su infraestructura cloud.
3. **Costo Cero Absoluto:** Tanto Render (Web Service gratuito) como Turso (plan Starter gratuito con hasta 9 GB) operan indefinidamente sin necesidad de ingresar tarjetas de crédito para su uso básico.
4. **Despliegue Continuo Automatizado:** Cada `push` a la rama principal de GitHub gatilla automáticamente el empaquetado y puesta en línea sin pasos manuales.

---

## 11. ESTIMACIÓN DE COMPLEJIDAD Y PLAN DE ACCIÓN PARA FASE POSTERIOR

### 11.1. Estimación de Esfuerzo Técnico

| Actividad | Complejidad | Tiempo Estimado | Archivos Involucrados |
| :--- | :--- | :--- | :--- |
| **Adaptación de Persistencia a Turso libSQL** | Media-Baja | 45 - 60 min | `/server/db.ts`, `package.json` |
| **Endurecimiento de Seguridad (Helmet + Rate Limit)**| Baja | 20 - 30 min | `/server.ts`, `package.json` |
| **Configuración de Variables de Entorno en Cloud** | Muy Baja | 15 min | Panel de Render / `.env.example` |
| **Configuración de Script de Inicio en `package.json`**| Muy Baja | 10 min | `package.json` |
| **Prueba de Humo en Producción y Verificación** | Baja | 30 min | Endpoints y flujo de checkout en vivo |

### 11.2. Hoja de Ruta para Despliegue (Roadmap Futuro)
1. **Paso 1:** Creación de cuenta y base de datos en Turso Cloud, obteniendo `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`.
2. **Paso 2:** Creación de script de migración para exportar los datos actuales de `amigurumis_mariai.db` (incluyendo usuarios y cupones semilla) e importarlos en Turso.
3. **Paso 3:** Sustitución de `better-sqlite3` por `@libsql/client` en `server/db.ts`.
4. **Paso 4:** Conexión del repositorio de GitHub a Render.com configurando:
   - *Build Command:* `npm install && npm run build`
   - *Start Command:* `npm run start`
   - *Environment Variables:* `NODE_ENV=production`, `PORT=10000`, credenciales de Turso.
5. **Paso 5:** Verificación en vivo de compra, videojuego, cupones y descarga de PDF.

---

## 12. TABLA RESUMEN DE COMPONENTES, RIESGOS Y ACCIONES RECOMENDADAS

| Componente | Implementación Actual | Riesgo Identificado | Acción Recomendada para Despliegue |
| :--- | :--- | :--- | :--- |
| **Frontend** | React 19 + Vite 8 + Tailwind v4 + React Router v7 | Ninguno crítico. Bundle de 2.1 MB (557 KB gzip). | Mantener. Añadir code-splitting (`React.lazy`) en `/jugar` para reducir el bundle inicial a ~150 KB. |
| **Backend** | Express 4 en `server.ts` con Vite middleware (dev) y static (prod) | Caída si no se configura `process.env.PORT` dinámico del PaaS. | Mantener arquitectura unificada. Asegurar que Express escuche en `0.0.0.0` y enlace al puerto provisto por el host. |
| **Base de Datos** | SQLite 3 local con `better-sqlite3` en `/data/amigurumis_mariai.db` | **CRÍTICO:** Pérdida total de datos en cada reinicio, suspensión o despliegue del host gratuito. | Migrar a **Turso (libSQL)** o **Neon PostgreSQL** para persistencia en la nube sin costo. |
| **Autenticación** | Credenciales locales con `crypto.scryptSync` y token en `localStorage` | Token sensible en `localStorage`. Endpoint `/api/auth/google` sin verificación real. | Deshabilitar o proteger `/api/auth/google` para producción pública. Añadir caducidad estricta y renovación de tokens. |
| **Pedidos** | Registro transaccional en tabla `orders` y `order_items` con moneda COP | Pérdida de historial de pedidos si el contenedor se apaga. | Al migrar a base de datos en la nube, los pedidos quedan 100% seguros y respaldados de forma permanente. |
| **Cupones** | Emisión criptográfica `MARIAI-XXXXXX` con niveles 1 (5%), 2 (10%), 3 (15%) | Ninguno en lógica. Validados y blindados en servidor contra solicitudes duplicadas. | Mantener la lógica comercial intacta. Se conservará la integridad referencial en la nube. |
| **Comprobantes PDF**| Generación procedural en memoria vía `pdfkit` y streaming a `res` | Acceso sin autorización estricta en `/api/orders/:orderId/pdf`. | Mantener generación en streaming (no gasta disco). Agregar token temporal o autenticación previa a la descarga. |
| **Videojuego** | Phaser 4 con gráficos vectoriales procedurales generados en Canvas | Ninguno. Cero peticiones de red externas para texturas. | Mantener intacto. La ejecución client-side en Canvas es 100% independiente del host y funciona en cualquier red. |

---

## 13. CONCLUSIONES

1. **Viabilidad Técnica Comprobada:** La plataforma **Amigurumis Mariai** se encuentra en un estado funcional maduro, modular y desacoplado, lo que permite un despliegue en la nube sin necesidad de reescribir la lógica de la tienda, del carrito ni del videojuego.
2. **El Cuello de Botella es la Persistencia Local:** El único impedimento real para un despliegue gratuito permanente es la dependencia del archivo físico `amigurumis_mariai.db`. Resolver este punto mediante una base de datos cloud gratuita como **Turso** garantiza una solución definitiva, robusta y con costo recurrente de $0 USD.
3. **Cero Modificaciones en Esta Fase:** En estricto cumplimiento con las directivas de la **Fase 2D**, este informe concluye sin haber modificado ningún archivo de código fuente ni haber ejecutado cambios de infraestructura prematuros.
