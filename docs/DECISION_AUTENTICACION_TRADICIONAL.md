# Decisión Arquitectural: Adopción de Autenticación Tradicional y Retiro de Autenticación Federada

**Proyecto:** Amigurumis Mariai — Plataforma Académica de Comercio Electrónico y Videojuego Promocional BTL  
**Fecha:** Noviembre de 2026  
**Fase:** 2E.1 — Eliminación de Google OAuth y Estabilización del Sistema  
**Estado:** Aprobado / Implementado  

---

## 1. Contexto del Proyecto

*Amigurumis Mariai* es una plataforma integral de comercio electrónico para la comercialización de muñecos y figuras artesanales tejidas a mano en Colombia mediante técnica de crochet. Integra un catálogo de productos con filtros por categoría y dificultad, un carrito de compras reactivo, pasarela de checkout con cálculo de envíos nacionales, generación de comprobantes PDF y un videojuego publicitario BTL (*Below The Line*) interactivo desarrollado en Phaser 3 ("Las Aventuras de Pompón").

En el marco de la arquitectura del sistema, el módulo de usuarios y sesiones tiene como finalidad autenticar a los clientes para permitir la consulta persistente de sus órdenes de compra, la descarga segura de comprobantes fiscales/comerciales y el canje controlado de códigos de descuento obtenidos en el videojuego.

---

## 2. Propuesta Inicial: Autenticación Federada con Google Identity Services

Inicialmente, se proyectó e integró un esquema híbrido de autenticación que permitía:
1. Registro e inicio de sesión local basado en credenciales estándar (correo electrónico y contraseña).
2. Autenticación federada mediante el protocolo Google Identity Services (GIS) / OpenID Connect (OIDC), utilizando verificación criptográfica en backend con la biblioteca `google-auth-library`.

El objetivo original de la integración federada era reducir la fricción en el registro y delegar la verificación del correo electrónico a un proveedor de identidad de amplia difusión.

---

## 3. Dificultades de Integración y Análisis de Riesgos

Durante las iteraciones de desarrollo, pruebas de integración y evaluación de entornos de ejecución distribuidos (incluyendo previsualizaciones dinámicas en contenedores efímeros y proxies inversos), se observaron las siguientes complejidades operativas y arquitectónicas:

1. **Dependencia de configuración de orígenes autorizados externos:**  
   Google Identity Services exige que cada URI y origen JavaScript esté previamente registrado en Google Cloud Console. En fases académicas con múltiples URLs de previsualización dinámica, dominios de prueba y puertos de depuración locales/remotos, esta restricción generaba fallos frecuentes de inicialización de cliente (`origin_mismatch`, bloqueos por CORS o bloqueo de popups/iframes).
2. **Complejidad innecesaria en la superficie de dependencias:**  
   El uso de SDKs cliente cargados desde CDN externos (`accounts.google.com/gsi/client`) y de dependencias adicionales en backend (`google-auth-library`) introducía acoplamiento temporal y vectores de incompatibilidad durante el empaquetado y linting TypeScript en modo estricto.
3. **Riesgos de conservar una implementación incompleta o intermitente:**  
   Mantener un botón de inicio de sesión de terceros que dependa de variables externas no garantizadas en todos los entornos de evaluación académica (como `GOOGLE_CLIENT_ID`) generaba una experiencia de usuario inconsistente (mensajes de advertencia, botones inoperativos o fallos de token).

> **Aclaración Técnica:**  
> La eliminación de Google OAuth no obedece a deficiencias intrínsecas de seguridad en el protocolo de Google ni a costos comerciales, sino a una decisión estratégica de ingeniería de software orientada a la **autonomía, verificabilidad reproducible, estabilidad del código base y reducción del acoplamiento externo**.

---

## 4. Justificación de la Simplificación Arquitectural

Se adoptó la simplificación del subsistema de autenticación en favor del modelo tradicional bajo los siguientes criterios académicos y de ingeniería:

* **Principio de Mínimo Acoplamiento (Loose Coupling):** La aplicación no depende de servicios de terceros para el ciclo de vida completo de sus usuarios ni para las pruebas de evaluación funcional.
* **Reproducibilidad y Verificabilidad Académica:** Cualquier evaluador o docente puede clonar el repositorio, ejecutar `npm run dev` y probar de inmediato el flujo de registro, inicio de sesión y gestión de órdenes sin necesidad de crear proyectos en GCP ni tramitar credenciales OAuth.
* **Control Integral del Flujo Criptográfico:** La gestión de hashes de contraseñas, tokens de sesión y revocación se gestiona de manera centralizada y transparente en la base de datos de la plataforma.

---

## 5. Arquitectura de Autenticación Adoptada

El sistema se consolida en una arquitectura de autenticación tradicional robusta compuesta por:

1. **Gestión Criptográfica de Credenciales:**
   - Derivación segura de claves mediante la función estándar `crypto.scryptSync` de Node.js, empleando sal (*salt*) criptográfica aleatoria de 16 bytes generada por usuario.
   - Verificación de contraseñas con comparación en tiempo constante (`crypto.timingSafeEqual`) para mitigar ataques de canal lateral por análisis de tiempos (*timing attacks*).

2. **Gestión Segura de Sesiones:**
   - Generación de identificadores de sesión opacos con entropía criptográfica (256 bits mediante `crypto.randomBytes(32)`).
   - Almacenamiento de sesiones en tabla relacional `sessions` con marca temporal de caducidad estricta (30 días).
   - Doble vector de transporte:
     - **Cookie HttpOnly:** Configurada con banderas `HttpOnly`, `SameSite=Lax` y `Secure` en producción, imposibilitando el robo de sesiones mediante ataques XSS.
     - **Bearer Token:** Soporte para cabecera HTTP `Authorization: Bearer <token>` para compatibilidad con clientes de API y persistencia en almacenamiento local.

3. **Control de Acceso y Autorización (RBAC):**
   - Middleware de autenticación `getAuthUser` para resolver la identidad antes de atender rutas protegidas (`/api/auth/me`, `/api/orders/user`, `/api/orders/:id/pdf`).
   - Mitigación IDOR (*Insecure Direct Object Reference*): Validación obligatoria de propiedad de pedidos (un usuario solo puede consultar y descargar recibos de sus propias compras o mediante un token criptográfico de orden efímero).

4. **Defensa en Profundidad:**
   - Limitación de tasa de solicitudes (*rate limiting*) sobre `/api/auth/login` y `/api/auth/register` (máximo 25 intentos cada 15 minutos por IP) para mitigar ataques de fuerza bruta y denegación de servicio.
   - Cabeceras de seguridad HTTP gestionadas mediante `helmet`.
   - Sanitización y validación estricta de entradas (validación de correo, longitud mínima de contraseña de 6 caracteres).

---

## 6. Manejo de Campos de Base de Datos Preexistentes (No Destructivo)

En cumplimiento de las buenas prácticas de migración de datos y evitando acciones destructivas:
- La columna `google_sub` preexistente en la tabla `users` de SQLite se declara **formalmente obsoleta (*deprecated*)**.
- No se ejecutan instrucciones destructivas como `DROP COLUMN` o recreación traumática de tablas para garantizar que los registros y las claves foráneas de pedidos existentes permanezcan intactos.

---

## 7. Limitaciones Actuales y Trabajo Futuro

### Limitaciones Identificadas:
- El usuario debe recordar sus credenciales específicas para la tienda o utilizar gestores de contraseñas.
- No se cuenta con recuperación de contraseña por correo electrónico vía SMTP saliente (se mantiene restablecimiento administrativo o regeneración).

### Posible Incorporación Futura:
- Una vez finalizada la etapa de evaluación y estabilizada la infraestructura de producción bajo un dominio FQDN definitivo con certificado SSL propio, la autenticación federada (OAuth 2.0 / OpenID Connect) podrá reincorporarse como un módulo complementario no bloqueante, manteniendo siempre la autenticación tradicional como ruta primaria y fallback garantizado.

---

## 8. Conclusión

La eliminación controlada de Google Identity Services restituye la estabilidad funcional completa del aplicativo *Amigurumis Mariai*, reduce a cero las fallas de inicialización externa y ofrece una base técnica sólida, mantenible y académicamente demostrable.
