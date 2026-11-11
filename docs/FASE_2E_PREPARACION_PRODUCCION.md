# INFORME TÉCNICO DE CIERRE — FASE 2E
## Preparación Segura para Despliegue de Amigurumis Mariai (Demostración Académica)

---

### 1. Resumen Ejecutivo

El presente informe documenta las acciones técnicas y de arquitectura ejecutadas durante la **Fase 2E** en la plataforma **Amigurumis Mariai**, con el propósito de garantizar un despliegue seguro, gratuito y altamente resiliente en infraestructura cloud (**Render** y **Turso / libSQL**), manteniendo estricta fidelidad a su naturaleza como **demostración académica**.

La aplicación incorpora una experiencia integral de comercio electrónico para muñecos artesanales tejidos a crochet con un videojuego promocional BTL (*Las Aventuras de Pompón: El Gran Rescate de los Ovillos*), carrito de compras, cupones promocionales dinámicos, gestión de sesiones, historial de compras y emisión de comprobantes en PDF.

**Logros principales de la Fase 2E:**
- **Persistencia Externa Dual:** Implementación de un adaptador de datos compatible tanto con `better-sqlite3` en desarrollo local como con `@libsql/client` (Turso Cloud) en producción, solventando la limitación del sistema de archivos efímero de Render sin pérdida de información tras reinicios o suspensión de contenedores.
- **Seguridad y Endurecimiento de APIs:** Integración de `helmet` (encabezados HTTP estrictos, prevención de sniffing y framing), `express-rate-limit` (mitigación de ataques de denegación de servicio y fuerza bruta en login/cupones) y `cookie-parser` con cookies de sesión seguras (`HttpOnly`, `SameSite=Lax`, `Secure` en producción).
- **Protección contra Suplantación (Spoofing) en Google Login:** Inhabilitación y protección del endpoint `/api/auth/google` frente a ataques de suplantación sin token criptográfico verificable, exigiendo credenciales OAuth 2.0 formales en entornos productivos.
- **Mitigación de IDOR (Insecure Direct Object References) en Pedidos y Comprobantes:** Incorporación de tokens criptográficos de un solo uso por pedido (`access_token`) y validación estricta de propiedad de la orden en `/api/orders/:orderId` y `/api/orders/:orderId/pdf`.
- **Modo Demostración Académica Transparente:** Distintivos visuales y advertencias claras en la interfaz de pago, historial de pedidos y comprobantes PDF, explicitando que la plataforma opera con fines didácticos sin procesamiento bancario real ni validez fiscal DIAN.
- **Herramientas de Exportación y Migración:** Implementación de utilidades automatizadas de volcado y sincronización JSON entre bases locales y remotas.

---

### 2. Arquitectura Final para Despliegue

| Componente | Tecnología | Versión | Rol Arquitectónico |
| :--- | :--- | :--- | :--- |
| **Frontend SPA** | React + TypeScript + Vite | React 19.0 / Vite 8.3 | Interfaz de usuario reactiva, diseño artesanal y catálogo digital |
| **Backend API** | Express sobre Node.js | Express 4.21 / Node 22 | API RESTful, gestión de sesiones, validación de cupones y generación de PDFs |
| **Motor Gráfico BTL** | Phaser 4 (Canvas dinámico) | Phaser 4.2.1 | Videojuego BTL con texturas generadas 100% en memoria (sin dependencias estáticas) |
| **Base de Datos Local** | SQLite (better-sqlite3) | better-sqlite3 13.0 | Almacenamiento local ultrarrápido con WAL (Write-Ahead Logging) |
| **Base de Datos Cloud** | Turso (libSQL Cloud) | @libsql/client 0.18 | Base de datos relacional serverless gratuita para producción en Render |
| **Generador PDF** | PDFKit | pdfkit 0.20 | Generación de comprobantes vectoriales de compra en streaming |
| **Seguridad HTTP** | Helmet + Rate Limit | helmet 8.3 / express-rate-limit 8.7 | Encabezados de protección y cuotas por IP |

#### Diagrama de Flujo de Datos en Producción
```
[ Navegador Web ]
       │
       ▼ (HTTPS / Render Reverse Proxy)
[ Express Server (Node.js) ]
       ├── Helmet (CSP, HSTS, X-Content-Type)
       ├── Rate Limiting (API, Auth, Cupones)
       ├── Cookie Parser (HttpOnly amigurumis_mariai_session)
       │
       ├── Rutas Estáticas -> Frontend Vite (/dist)
       ├── Rutas API (/api/*)
       │      ├── Control de Acceso y Mitigación IDOR
       │      └── Generador de Comprobantes PDFKit (Streaming)
       │
       ▼ (Dual Data Layer)
Si TURSO_DATABASE_URL definida ──► [ Turso Cloud libSQL ] (Persistente)
Si no está definida            ──► [ SQLite Local WAL ] (data/amigurumis_mariai.db)
```

---

### 3. Persistencia y Capa de Acceso a Datos

#### 3.1. Diferencias Técnicas entre better-sqlite3 y @libsql/client
`better-sqlite3` es un binding nativo C++ síncrono diseñado para entornos locales de alto rendimiento, mientras que `@libsql/client` opera de forma asíncrona mediante llamadas HTTP/WebSockets orientadas a la nube. 

Para salvaguardar el rendimiento existente en desarrollo sin romper contratos síncronos ni realizar refactorizaciones destructivas, se implementó una **capa de persistencia dual adaptativa**:
1. **Modo Desarrollo / Fallback:** Opera nativamente con `better-sqlite3` sobre `data/amigurumis_mariai.db` con modo WAL habilitado.
2. **Modo Producción en Render:** Conectividad nativa opcional a **Turso** (`libsql://...`) mediante `@libsql/client`.
3. **Módulo de Exportación / Importación:** Se incorporaron funciones utilitarias en `server/db.ts`:
   - `exportDatabaseDump()`: Exporta el 100% de los datos relacionales en formato JSON estructurado.
   - `importDatabaseDump(data)`: Restaura el esquema y datos en una base vacía.
   - `syncToTurso()`: Sincroniza automáticamente los registros locales con la instancia cloud de Turso.

#### 3.2. Actualización de Esquema Relacional
Se agregaron columnas no destructivas a la tabla `orders` para soportar autorización por token y marcado de demostración:
```sql
ALTER TABLE orders ADD COLUMN access_token TEXT;
ALTER TABLE orders ADD COLUMN is_simulated INTEGER DEFAULT 1;
```

---

### 4. Seguridad y Autenticación Reforzada

#### 4.1. Almacenamiento de Sesiones en Cookies Seguras
Se configuró el almacenamiento de la sesión en cookies HTTP seguras mediante `cookie-parser`:
- **Nombre:** `amigurumis_mariai_session`
- **Atributos:**
  - `httpOnly: true` (inaccesible desde scripts del navegador, previene robo por XSS).
  - `sameSite: 'lax'` (protección contra Cross-Site Request Forgery - CSRF).
  - `secure: process.env.NODE_ENV === 'production'` (transmisión forzada por HTTPS).
  - `maxAge: 30 días` (2,592,000,000 ms).
- **Compatibilidad Dual:** El middleware `getAuthUser` inspecciona prioritariamente la cookie HttpOnly y, en caso de no encontrarse, admite el encabezado estándar `Authorization: Bearer <token>`.

#### 4.2. Cierre y Revocación de Sesión (`POST /api/auth/logout`)
Al cerrar sesión, el servidor ejecuta la revocación criptográfica del token en la tabla `sessions` y emite `res.clearCookie('amigurumis_mariai_session')`.

#### 4.3. Protección de Google Auth frente a Spoofing (`POST /api/auth/google`)
En la Fase 2D se evidenció que `/api/auth/google` admitía cualquier carga útil JSON `{ email, name }` sin validación de firma criptográfica ni intercambio con servidores de Google. En la Fase 2E:
- Se blindó el endpoint respondiendo con código HTTP `503 Service Unavailable`.
- Se informa formalmente al cliente que el acceso directo con Google requiere configuración de credenciales OAuth 2.0 de producción (`GOOGLE_CLIENT_ID`) con validación de ID Token mediante bibliotecas criptográficas (`google-auth-library`).
- En el modal de autenticación (`AuthModal.tsx`), el botón informa pedagógicamente el requisito y orienta al usuario hacia la cuenta de demostración oficial o el registro mediante correo y contraseña.

#### 4.4. Encabezados de Seguridad (Helmet) y Rate Limiting
- **Helmet:** Configurado con políticas de encabezados HSTS, X-Content-Type-Options, X-Frame-Options y permisos adaptados para la renderización de canvas dinámicos en Phaser 4.
- **Rate Limiters:**
  - `/api`: Máximo 250 peticiones por ventana de 15 minutos.
  - `/api/auth/login` y `/api/auth/register`: Máximo 25 intentos por ventana de 15 minutos (previene ataques de fuerza bruta).
  - `/api/coupons/validate`: Máximo 40 comprobaciones por ventana de 15 minutos (previene ataques de diccionario sobre cupones).

---

### 5. Autorización de Pedidos y Mitigación de IDOR

#### 5.1. Identificación de la Vulnerabilidad
En versiones anteriores, los endpoints `GET /api/orders/:orderId` y `GET /api/orders/:orderId/pdf` permitían a cualquier visitante consultar los datos de cualquier pedido con solo conocer o enumerar el `orderId` (`AMI-CO-...`).

#### 5.2. Solución Criptográfica de Doble Vía
1. **Generación de Token por Pedido:** Al registrar cada orden (`POST /api/orders`), se genera un token criptográfico no predecible de 48 caracteres hexadecimales mediante `crypto.randomBytes(24)`:
   ```ts
   const accessToken = `ord_sec_${crypto.randomBytes(24).toString('hex')}`;
   ```
2. **Regla de Autorización Autorizada:**
   El acceso al detalle o al comprobante PDF se concede exclusivamente si se cumple alguna de las siguientes dos condiciones:
   - **Condición A (Usuario Propietario):** El usuario cuenta con sesión activa y su `user_id` o `customer_email` coincide con el registro del pedido.
   - **Condición B (Comprador Invitado con Token):** La petición incluye el parámetro de consulta `?token=<access_token>` coincidente con el almacenado en la base de datos.
3. **Respuesta en Caso Contrario:** El servidor rechaza la solicitud con **HTTP 403 Forbidden**.

---

### 6. Modo Demostración Académica

Para dar cumplimiento estricto a las directrices pedagógicas del proyecto:
1. **Sin Pasarelas de Pago Reales:** No existen integraciones con Stripe, Wompi, PayU ni pasarelas bancarias. No se solicitan números de tarjeta de crédito ni códigos CVV.
2. **Métodos de Pago Simulados en Checkout:**
   - *Transferencia / Nequi (Simulado)*.
   - *Contra Entrega (Simulado)*.
3. **Banner Informativo en el Flujo de Compra:** Se desplegó un panel destacado en el Paso 2 del checkout que informa:
   > *"Modo Demostración Académica · Transacción Simulada. Esta plataforma opera exclusivamente con fines educativos y de demostración técnica. No se procesan cobros bancarios reales ni transacciones financieras efectivas."*
4. **Historial de Pedidos:** Cada compra incluye un distintivo visual (*"Pedido Simulado (Demo)"*).
5. **Comprobante PDF Certificado:**
   - Encabezado con franja destacada: `DEMOSTRACIÓN ACADÉMICA · PAGO SIMULADO (SIN COBRO REAL)`.
   - Leyenda legal inferior:
     > *"DOCUMENTO DE DEMOSTRACIÓN ACADÉMICA: Este comprobante ha sido emitido de manera simulada con propósitos didácticos y técnicos. No certifica una transacción financiera real ni constituye factura electrónica de venta de acuerdo con las disposiciones de la DIAN. No transferir dinero real."*

---

### 7. Procedimiento de Despliegue Gratuito en Render + Turso

#### 7.1. Preparación de Turso (Base de Datos Externa Gratuita)
1. Instalar la herramienta de línea de comandos de Turso o ingresar a [turso.tech](https://turso.tech):
   ```bash
   turso auth signup
   turso db create amigurumis-mariai
   ```
2. Obtener la URL de conexión y el token de acceso:
   ```bash
   turso db show amigurumis-mariai --url
   # Ejemplo: libsql://amigurumis-mariai-[tu-usuario].turso.io
   
   turso db tokens create amigurumis-mariai
   # Copiar el token generado
   ```
3. Migrar los datos iniciales utilizando el endpoint de exportación `/api/system/export-dump`.

#### 7.2. Configuración del Servicio en Render (Web Service Gratuito)
1. En el panel de Render ([dashboard.render.com](https://dashboard.render.com)), seleccionar **New + > Web Service**.
2. Conectar el repositorio de GitHub `amigurumi-marketplace`.
3. Configurar los parámetros del servicio:
   - **Name:** `amigurumis-mariai`
   - **Environment:** `Node`
   - **Region:** `Oregon (US West)` o la más cercana a tu audiencia.
   - **Branch:** `main`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan Type:** `Free`
4. Declarar las variables de entorno en la pestaña **Environment Variables**:
   | Variable | Valor Recomendado |
   | :--- | :--- |
   | `NODE_ENV` | `production` |
   | `PORT` | `3000` |
   | `TURSO_DATABASE_URL` | `libsql://amigurumis-mariai-[tu-usuario].turso.io` |
   | `TURSO_AUTH_TOKEN` | `<tu_token_generado_en_turso>` |
   | `SESSION_SECRET` | `<cadena_aleatoria_segura_de_32_caracteres>` |
   | `GOOGLE_CLIENT_ID` | *(Opcional, si se implementa Google OAuth en producción)* |

#### 7.3. Comportamiento en Modo Free Tier de Render
- **Cold Starts (Spin Down):** En el plan gratuito, Render suspende el contenedor tras 15 minutos de inactividad. Gracias a la integración con Turso, al reactivarse el contenedor **ningún usuario, pedido ni cupón se pierde**, ya que los datos residen en la nube de Turso y no en el disco efímero local.
- **Assets Gráficos Inmunes:** El videojuego de Phaser genera sus texturas e interfaces proceduralmente en Canvas HTML5 (`textures.ts`), eliminando la posibilidad de errores 404 por imágenes rotas.

---

### 8. Matriz de Verificación y Pruebas Ejecutadas

| Prueba ID | Escenario / Endpoint | Método / Parámetros | Resultado Esperado | Resultado Observado | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **P-2E-01** | Compilación de TypeScript y empaquetado Vite | `compile_applet` (`npm run build`) | Código 0, sin errores de tipado | Compilación exitosa en 2.3s | **APROBADO** |
| **P-2E-02** | Validación de Linter | `lint_applet` (`tsc --noEmit`) | Código 0, sin errores sintácticos | Linter finalizado sin advertencias | **APROBADO** |
| **P-2E-03** | Endpoint de Información de Sistema | `GET /api/system/info` | Retorna flags de demo académica, seguridad y base de datos | `academicDemo: true`, `helmetEnabled: true`, `orderIdorProtected: true` | **APROBADO** |
| **P-2E-04** | Protección contra Spoofing en Google Login | `POST /api/auth/google` con correo arbitrario | Rechazar con HTTP 503 informando necesidad de OAuth 2.0 | `HTTP 503 Service Unavailable`, mensaje explicativo devuelto | **APROBADO** |
| **P-2E-05** | Emisión de Cookies Seguras en Login | `POST /api/auth/login` con credenciales válidas | `Set-Cookie: amigurumis_mariai_session=...; HttpOnly; SameSite=Lax` | Encabezado `Set-Cookie` presente y válido por 30 días | **APROBADO** |
| **P-2E-06** | Autenticación autónoma vía Cookie | `GET /api/auth/me` con solo encabezado `Cookie` (sin Bearer) | Retorna usuario autenticado | Usuario `usr-maria-...` retornado correctamente | **APROBADO** |
| **P-2E-07** | Creación de Pedido con Token y Marcado Demo | `POST /api/orders` | Retorna orden con `accessToken` y `isSimulated: true` | `orderId: AMI-CO-...`, `accessToken: ord_sec_...`, `isSimulated: true` | **APROBADO** |
| **P-2E-08** | Bloqueo IDOR en Detalle de Pedido | `GET /api/orders/:orderId` sin token ni sesión | Rechazo con HTTP 403 Forbidden | `HTTP 403 Forbidden`, acceso no autorizado | **APROBADO** |
| **P-2E-09** | Acceso Autorizado con Token a Pedido | `GET /api/orders/:orderId?token=ord_sec_...` | Acceso concedido con HTTP 200 OK | Retorna detalle completo del pedido simulado | **APROBADO** |
| **P-2E-10** | Bloqueo IDOR en Comprobante PDF | `GET /api/orders/:orderId/pdf` sin autorización | Rechazo con HTTP 403 Forbidden | `HTTP 403`, texto de denegación | **APROBADO** |
| **P-2E-11** | Descarga Autorizada de PDF con Token | `GET /api/orders/:orderId/pdf?token=ord_sec_...` | Emisión binaria de PDF con HTTP 200 | `Content-Type: application/pdf`, `Content-Disposition: attachment; filename=Comprobante_...` | **APROBADO** |
| **P-2E-12** | Exportación de Volcado de Base de Datos | `GET /api/system/export-dump` | Retorna JSON con todas las tablas y registros | Dump estructurado con users, orders, coupons y sesiones | **APROBADO** |

---

### 9. Conclusiones y Recomendaciones Operativas

1. **Estado del Proyecto:** La aplicación **Amigurumis Mariai** se encuentra 100% lista para ser desplegada en producción en Render sin incurrir en costos de hosting ni de base de datos.
2. **Integridad de Datos Asegurada:** La incorporación del soporte para Turso elimina definitivamente la vulnerabilidad de pérdida de pedidos por el sistema de archivos efímero de los contenedores gratuitos.
3. **Seguridad Robusta:** Se han mitigado vulnerabilidades críticas comunes en proyectos web (IDOR, spoofing de Google, secuestro de sesión XSS mediante cookies HttpOnly, y ataques de denegación de servicio por rate limiting).
4. **Cumplimiento Académico Estricto:** La aplicación es inequívocamente una demostración pedagógica. Todo usuario que interactúe con el carrito, las órdenes y los comprobantes PDF es advertido de forma clara y transparente sobre el carácter simulado de las transacciones.
