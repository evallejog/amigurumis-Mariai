# INFORME TÉCNICO — FASE 2F.4: ESTABILIZACIÓN RESPONSIVE, CUPONES Y CARRITO MULTIUSUARIO

**Proyecto:** Amigurumis Mariai — Plataforma E-commerce & Minivideojuego BTL  
**Fecha:** Noviembre de 2026  
**Fase:** 2F.4 — Estabilización Responsive, Cupones y Carrito Multiusuario  
**Estado:** COMPLETADO Y VERIFICADO AL 100% (24/24 pruebas unitarias y de integración aprobadas; 92/92 acumuladas)

---

## 1. OBJETIVOS DE LA FASE

La **Fase 2F.4** tuvo como propósito resolver de forma quirúrgica tres aspectos identificados durante las pruebas manuales post-Fase 2F.3:

1. **Responsividad del Panel Administrativo (`/admin`):**
   - Corregir el comportamiento en pantallas móviles donde el sidebar ocupaba toda la altura inicial, desplazando el contenido ejecutivo.
   - Implementar navegación responsive basada en encabezado móvil (`lg:hidden`), botón hamburguesa accesible, drawer lateral desplegable con fondo difuminado, cierre automático al navegar y bloqueo de scroll corporal.
   - Preservar íntegramente la vista lateral de escritorio (`hidden lg:flex lg:w-64`) con estética Apple Liquid Glass.

2. **Diagnóstico y Claridad del Cupón Exclusivo `EXCL-USRA-19299`:**
   - Realizar una inspección directa en la base de datos activa SQLite para verificar existencia, integridad, destinatario y estado de redención del cupón.
   - Auditar las peticiones contra `/api/coupons/validate` para peticiones anónimas, de usuarios no autorizados y del legítimo propietario.
   - Asegurar que la interfaz de checkout muestre el motivo exacto del rechazo con mensajes transparentes y amigables.

3. **Aislamiento Estricto del Carrito y Cupones por Usuario:**
   - Evitar la fuga de artículos y cupones pendientes en `localStorage` entre sesiones (ej. salir como administrador e iniciar sesión como cliente María).
   - Implementar particionamiento de claves por identificador de usuario (`amigurumis_mariai_cart_user_<id>`) y sesión invitada (`amigurumis_mariai_cart_guest`).
   - Aplicar el mismo aislamiento para cupones en tránsito (`amigurumis_mariai_coupon_user_<id>` vs `amigurumis_mariai_coupon_guest`).

4. **Preservación de Seguridad Administrativa:**
   - Mantener intactas las credenciales institucionales y la herramienta de gestión `scripts/manage-admin.ts`.
   - Documentar los lineamientos de rotación de credenciales previas al despliegue en producción.

---

## 2. RESPONSIVIDAD DEL PANEL ADMINISTRATIVO

### 2.1. Diagnóstico del Problema Visual
En la versión anterior, el componente `<aside>` del panel administrativo contaba con la clase `w-full lg:w-64`, lo que en dispositivos móviles (anchos de 320 px a 430 px) provocaba que la barra de navegación se renderizara verticalmente en el flujo normal del documento por encima del contenido principal, requiriendo desplazarse decenas de líneas para ver las tablas y métricas.

### 2.2. Solución Arquitectónica
Se rediseñó el layout en `src/pages/AdminDashboardPage.tsx` adoptando un patrón desacoplado:

1. **Encabezado Móvil Sticky (`lg:hidden`):**
   - Barra superior fija con `backdrop-blur-md` y diseño translúcido.
   - Botón hamburguesa (`Menu` de Lucide) con atributo de accesibilidad `aria-label="Abrir menú de navegación"`.
   - Logotipo `BrandLogo` miniatura y badge `Admin` con relieve suave.
   - Botón de refresco rápido (`RefreshCw`) y acceso directo a la tienda pública (`Tienda`).

2. **Drawer Lateral Móvil Desplegable (`lg:hidden`):**
   - Control de visibilidad gestionado mediante el estado `isMobileNavOpen`.
   - Backdrop oscuro (`bg-stone-900/60 backdrop-blur-xs`) que intercepta clics externos para cerrar el menú.
   - Diálogo accesible con `role="dialog"`, `aria-modal="true"` y `aria-label`.
   - Botón de cierre explícito (`X`).
   - Cierre automático al pulsar cualquiera de las 7 secciones administrativas (`overview`, `orders`, `customers`, `coupons`, `btl`, `analytics`, `ml`).
   - Escucha global de la tecla `Escape` y bloqueo del scroll de fondo (`document.body.style.overflow = 'hidden'`) mientras el drawer permanece abierto.

3. **Sidebar de Escritorio y Tablet Horizontal (`hidden lg:flex`):**
   - Barra lateral permanente fija a la izquierda (`sticky top-0 h-screen overflow-y-auto w-64`).
   - Mantiene intacta la estética Apple Liquid Glass, los selectores de pestañas con badges numéricos en tiempo real y el bloque inferior con la identidad del administrador autenticado.

---

## 3. DIAGNÓSTICO DEL CUPÓN EXCLUSIVO `EXCL-USRA-19299`

### 3.1. Consulta Directa en la Base de Datos SQLite
Se ejecutó la inspección forense en la tabla `coupons` de `data/amigurumis_mariai.db`:

```sql
SELECT code, discount_percent, coupon_type, target_type, user_id, user_email, is_active, times_used, max_uses, expires_at
FROM coupons
WHERE code = 'EXCL-USRA-19299';
```

**Resultado obtenido:**
- **Código:** `EXCL-USRA-19299`
- **Descuento:** 25% OFF
- **Tipo de Cupón:** `commercial_exclusive`
- **Destinatario (`target_type`):** `exclusive`
- **ID de Usuario Asignado:** `usr-mwcotcni-qsh0`
- **Correo Electrónico Asignado:** `cliente.f2f3.a.1794435919177@test.com`
- **Estado:** Activo (`is_active = 1`)
- **Usos:** 0 redenciones de 1 permitida (`times_used = 0`, `max_uses = 1`)
- **Vigencia:** 30 días a partir de su emisión

### 3.2. Causa de la Respuesta "Cupón no válido o no disponible"
El cupón `EXCL-USRA-19299` es un cupón **comercial exclusivo** emitido durante las pruebas de la Fase 2F.3 y vinculado formal y criptográficamente al usuario `cliente.f2f3.a.1794435919177@test.com`.

Cuando un usuario interactúa con el checkout:
1. **Si no ha iniciado sesión (Invitado):**
   - El backend responde **HTTP 403 Forbidden** con el mensaje:
     `"Este cupón es exclusivo y requiere iniciar sesión con la cuenta destinataria para aplicarse."`
2. **Si ha iniciado sesión con otra cuenta (ej. `admin@amigurumismariai.com` o `maria@amigurumismariai.com`):**
   - El backend responde **HTTP 403 Forbidden** con el mensaje:
     `"Este cupón de descuento está asignado a otra cuenta y no puede ser redimido por tu usuario."`
3. **Si inicia sesión con la cuenta destinataria (`cliente.f2f3.a.1794435919177@test.com`):**
   - El backend responde **HTTP 200 OK** con `valid: true`, `discountPercent: 25`, y calcula con total exactitud el descuento (`$12.500 COP` sobre un subtotal de `$50.000 COP`).

### 3.3. Refinamiento en el Frontend
En `src/components/cart/CheckoutModal.tsx`, se aseguró que cualquier error retornado por la API (`data.error`) sea capturado y desplegado textualmente en el banner de error (`setCouponError(err.message)`), eliminando cualquier caída a mensajes genéricos opacos y guiando al usuario con claridad sobre si debe iniciar sesión o usar la cuenta a la cual fue asignado el beneficio.

---

## 4. AISLAMIENTO DEL CARRITO Y CUPONES MULTIUSUARIO

### 4.1. Diagnóstico del Almacenamiento Compartido
Anteriormente, el contexto del carrito (`src/context/CartContext.tsx`) utilizaba una clave estática global en `localStorage`:
`amigurumis_mariai_cart_v2`

Al cerrar sesión como administrador y acceder como cliente, los artículos en el carrito persistían en la memoria del navegador, permitiendo la mezcla inadvertida de pedidos entre usuarios en el mismo dispositivo. Del mismo modo, el cupón pendiente (`amigurumis_mariai_pending_coupon`) permanecía registrado para el siguiente usuario que iniciara sesión.

### 4.2. Implementación de Claves Aisladas
Se crearon las funciones exportadas:
```typescript
export const getCartStorageKey = (userId?: string | null) => {
  return userId ? `amigurumis_mariai_cart_user_${userId}` : 'amigurumis_mariai_cart_guest';
};

export const getCouponStorageKey = (userId?: string | null) => {
  return userId ? `amigurumis_mariai_coupon_user_${userId}` : 'amigurumis_mariai_coupon_guest';
};
```

### 4.3. Ciclo de Vida del Cambio de Usuario
En `CartProvider`:
1. Se mantiene una referencia mutable `activeUserRef` que rastrea el ID del usuario previamente activo.
2. Un efecto sincronizador detecta cuando `currentUserId` cambia (login, logout o cambio de cuenta):
   - **Persistencia saliente:** Guarda los artículos y cupón en la clave del usuario previo.
   - **Carga entrante:** Recupera los artículos y cupón asociados exclusivamente a la clave del nuevo usuario (o del invitado si se cerró sesión). Si no existen registros para el nuevo usuario, inicializa un carrito limpio `[]`.
   - **Restablecimiento de costos:** Limpia costos de envío calculados previamente para evitar tarifas desactualizadas.
3. Al llamar a `clearCart()`, se eliminan tanto los artículos en memoria como las entradas físicas correspondientes en `localStorage` para el usuario activo.

---

## 5. SEGURIDAD Y CREDENCIALES ADMINISTRATIVAS

### 5.1. Cuenta Institucional
- **Correo oficial:** `admin@amigurumismariai.com`
- **Rol:** `admin` (superusuario de plataforma)
- **Aprovisionamiento:** Persistido en SQLite con contraseña hasheada mediante `crypto.scryptSync` (salteado criptográfico seguro).

### 5.2. Herramienta de Mantenimiento
Se conserva intacto el script `scripts/manage-admin.ts`, el cual permite a los desarrolladores y operadores restablecer o crear administradores mediante terminal de forma segura:
```bash
npx tsx scripts/manage-admin.ts
```

### 5.3. Recomendaciones de Seguridad para Producción
1. Definir una variable de entorno `ADMIN_PASSWORD` robusta y aleatoria en el archivo `.env` del servidor de producción.
2. Definir una variable `SESSION_SECRET` con entropía superior a 256 bits para la firma de tokens de sesión.
3. Rotar periódicamente la contraseña del administrador institucional tras la entrega del proyecto académico.

---

## 6. MATRIZ DE PRUEBAS AUTOMATIZADAS Y REGRESIÓN

Se ejecutaron de manera secuencial las suites de pruebas automatizadas del proyecto:

| Suite de Pruebas | Archivo | Pruebas | Resultado | Estado |
| :--- | :--- | :---: | :---: | :---: |
| **Fase 2F.2** (Gestión Operativa) | `scripts/test-phase-2f2.ts` | 26 | 26 / 26 | **PASS (100%)** |
| **Fase 2F.3** (Cupones y BTL) | `scripts/test-phase-2f3.ts` | 42 | 42 / 42 | **PASS (100%)** |
| **Fase 2F.4** (UX, Cupones y Carrito) | `scripts/test-phase-2f4.ts` | 24 | 24 / 24 | **PASS (100%)** |
| **Total Acumulado** | — | **92** | **92 / 92** | **PASS (100%)** |

### Desglose de Pruebas Fase 2F.4:
1. `[PASS]` 1. Cupón EXCL-USRA-19299 existe en la base de datos SQLite.
2. `[PASS]` 2. Tipo de cupón es `commercial_exclusive`.
3. `[PASS]` 3. `target_type` es `exclusive`.
4. `[PASS]` 4. Cupón se encuentra activo en base de datos.
5. `[PASS]` 5. Descuento configurado es 25%.
6. `[PASS]` 6. Cupón tiene asignado un `user_id` destinatario.
7. `[PASS]` 7. Cupón tiene asignado un `user_email` destinatario.
8. `[PASS]` 8. Petición anónima rechazada con HTTP 403 Forbidden.
9. `[PASS]` 9. Mensaje explicativo claro de necesidad de login.
10. `[PASS]` 10a. Login exitoso de cliente demo María.
11. `[PASS]` 10b. Intento de cuenta distinta rechazado con HTTP 403 Forbidden.
12. `[PASS]` 11. Mensaje explicativo claro de exclusividad asignada a otra cuenta.
13. `[PASS]` 12. Cuenta propietaria validada con HTTP 200 OK.
14. `[PASS]` 13. Respuesta indica `valid: true`.
15. `[PASS]` 14. Porcentaje retornado coincide con 25%.
16. `[PASS]` 15. Monto descontado calculado exactamente: $12.500 COP.
17. `[PASS]` 16. Clave de carrito para usuario invitado es `amigurumis_mariai_cart_guest`.
18. `[PASS]` 17. Clave de carrito para usuario registrado incluye su identificador único.
19. `[PASS]` 18. Clave de cupón pendiente para usuario invitado es `amigurumis_mariai_coupon_guest`.
20. `[PASS]` 19. Clave de cupón pendiente para usuario registrado incluye su identificador único.
21. `[PASS]` 20. Las claves de administrador y cliente María son completamente disjuntas.
22. `[PASS]` 21. Administrador institucional autentica con credencial oficial.
23. `[PASS]` 22. Endpoint administrativo `/api/admin/overview` operativo.
24. `[PASS]` 23. Usuario con rol admin activo registrado en SQLite.

---

## 7. CONCLUSIÓN Y CIERRE DE LA FASE 2F.4

La **Fase 2F.4** concluye con éxito la estabilización del frontend responsive en el panel administrativo, aclara y valida en producción el modelo de seguridad de cupones exclusivos (incluyendo el código de auditoría `EXCL-USRA-19299`), y garantiza el aislamiento completo de las sesiones y carritos multiusuario en el navegador.

La plataforma **Amigurumis Mariai** se encuentra 100% operativa, estable, segura y lista para las fases posteriores de Data Analytics (Fase 3) y Machine Learning (Fase 4).
