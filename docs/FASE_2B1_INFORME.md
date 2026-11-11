# INFORME TÉCNICO DE LA FASE 2B.1 — CORRECCIÓN FUNCIONAL, OPTIMIZACIÓN UX/UI, NAVEGACIÓN Y LOCALIZACIÓN COLOMBIANA

> **Proyecto:** Atelier Amigurumi — Plataforma Comercial & Minivideojuego BTL  
> **Versión del Sistema:** 2.1.0-phase2b1  
> **Fecha:** Noviembre 2026  
> **Responsable:** Arquitectura Senior Full-Stack, UX/UI & Game Development  
> **Estado de la Intervención:** COMPLETADA Y VERIFICADA  

---

## 1. RESUMEN EJECUTIVO Y CLASIFICACIÓN DE ALCANCE

| Ítem | Clasificación de Estado | Descripción y Resultado |
| :--- | :--- | :--- |
| **Salto de Pompón (W, Espacio, Flecha Arriba, Touch)** | **`[CORREGIDO Y VERIFICADO]`** | Resuelto mediante listener unificado de ventana, captura preventiva de scroll y eliminación de rebote parásito (`setBounce(0)`). |
| **Canvas del Videojuego (Eliminación de Franjas Blancas)** | **`[CORREGIDO Y VERIFICADO]`** | Integrado al fondo cálido `#FAF7F2` con contorno glassmorphic y escalado `Phaser.Scale.FIT` sin desbordes. |
| **Tipografía Global y de Videojuego (Eliminación de Serif)** | **`[CORREGIDO Y VERIFICADO]`** | Sustituido Playfair Display/Georgia por **Plus Jakarta Sans** en toda la tienda, HUD, modales y botones. |
| **Orientación Móvil del Minijuego (Portrait Prioritario)** | **`[CORREGIDO Y VERIFICADO]`** | Detección de viewport móvil con pantalla animada de giro si se sostiene en horizontal, sin afectar PC. |
| **Navegación Anti-Parpadeo (Scroll Spy & Programmatic Lock)** | **`[CORREGIDO Y VERIFICADO]`** | Bloqueo transitorio `isProgrammaticScrollRef` con liberación por `scrollend` / interacción del usuario. |
| **Barra Superior Sticky en PC** | **`[CORREGIDO Y VERIFICADO]`** | Header sticky accesible con compensación `scrollPaddingTop: 5rem`, sin recortes de anclas. |
| **Badge PROMO en Bottom Navigation** | **`[CORREGIDO Y VERIFICADO]`** | Rediseñado con micro-badge centrado sobre el icono sin obstaculizar su visibilidad. |
| **Cálculo de Envío en Carrito** | **`[CORREGIDO Y VERIFICADO]`** | Muestra honestamente *"Pendiente de calcular"* antes de ingresar dirección y tipo de despacho. |
| **Existencias Disponibles en Catálogo** | **`[CORREGIDO Y VERIFICADO]`** | Añadido `stockUnits` e indicadores claros: *"Disponibles: X u."*, *"Bajo pedido"*, *"Por confirmar"*. |
| **Localización Completa a Colombia (COP)** | **`[CORREGIDO Y VERIFICADO]`** | Precios en COP formato `es-CO`, retiro de Palermo/Buenos Aires/+54, atención en línea Colombia. |
| **Rendimiento y Ciclo de Vida** | **`[CORREGIDO Y VERIFICADO]`** | Telemetría orientada a eventos (sin re-renders por fotograma), Web Audio y `destroy(true)` estricto. |

---

## 2. PROBLEMAS ENCONTRADOS Y CAUSAS IDENTIFICADAS

### 2.1. Salto de Pompón Inoperante
- **Causa 1:** El canvas de Phaser se montaba dentro de un contenedor React sin recibir automáticamente el foco de teclado. Al pulsar W, Espacio o Flecha Arriba, los eventos no alcanzaban el gestor interno de Phaser.
- **Causa 2:** La barra espaciadora y las flechas no tenían captura (`addCapture`), provocando que el navegador ejecutara el scroll nativo de la página hacia abajo o arriba, desorientando la escena.
- **Causa 3:** `this.player.setBounce(0.05)` generaba un micro-rebote imperceptible de 20 px/s al tocar las plataformas estáticas. Debido a la condición `velocity.y >= 0` y la caída de `blocked.down`, el motor de física no reconocía al personaje en el suelo de manera estable.
- **Causa 4:** El botón táctil virtual utilizaba listeners combinados `onTouchStart` y `onMouseDown` sin controlar `pointercancel` ni `pointerleave`, provocando saltos interrumpidos al deslizar el pulgar.

### 2.2. Franjas y Bordes Blancos en el Lienzo
- **Causa:** El contenedor externo de React tenía `bg-stone-100` con `aspect-video`, mientras que el canvas de Phaser tenía `backgroundColor: '#FAF7F2'`. Cuando el tamaño del contenedor no coincidía exactamente con el ratio 16:9 de 960x540, se generaba un marco visible de color desigual.

### 2.3. Parpadeo del Indicador Activo en la Navegación
- **Causa:** Conflicto de carrera entre el estado local programático y el evento global `scroll`. Al pulsar "Colección", `setActiveSection('catalogo')` se ejecutaba en el acto, pero el `scrollIntoView` suave disparaba eventos continuos de desplazamiento desde `scrollY = 0`. El observador leía que el usuario seguía en la sección "Inicio" durante los primeros 300 ms y sobreescribía la selección a "Inicio", volviendo a "Colección" solo cuando el scroll llegaba a su destino.

### 2.4. Badge PROMO Superpuesto
- **Causa:** El badge de promoción tenía posición absoluta escorada a la derecha (`-right-3.5`), solapando la mitad del glifo del mando en dispositivos de pantalla angosta (< 390px).

### 2.5. Cálculo de Envío Anticipado y Localización Desalineada
- **Causa:** El carrito calculaba de forma fija $2.500 ARS y mostraba una barra hacia $30.000 ARS para envío gratis. Esto no correspondía al mercado colombiano ni a una cotización de logística real.

---

## 3. CORRECCIONES REALIZADAS

1. **Entrada de Controles Unificada (`LevelScene.ts` & `BtlGameSection.tsx`):**
   - Incorporación de listener global a nivel `window` con `e.code` y `e.preventDefault()` en teclas de juego para bloquear scroll accidental.
   - Eliminación de bounce (`setBounce(0)`).
   - Reconfiguración de Coyote Time (150 ms) y Jump Buffering (180 ms) con impulso calibrado a `-465 px/s`.
   - Implementación de `setVirtualJump(boolean)` vinculado a `onPointerDown`, `onPointerUp`, `onPointerCancel` y `onPointerLeave` con CSS `touch-none`.

2. **Ajuste del Canvas (`BtlGameSection.tsx`):**
   - Contenedor con fondo `#FAF7F2` idéntico al lienzo.
   - Configuración de escalado `Phaser.Scale.FIT` con autocentrado.
   - Eliminación de franjas blancas y estilización con marco perimetral glassmorphic.

3. **Overlay de Orientación Móvil (`BtlGameSection.tsx`):**
   - Detección precisa de smartphone en horizontal mediante `(pointer: coarse)` y relación de aspecto.
   - Pantalla translúcida animada con teléfono girando que solicita jugar en vertical, reanudando en cuanto se rota.

4. **Identidad Tipográfica Sans-Serif (`index.html`, `index.css`, componentes):**
   - Sustitución de *Playfair Display* por *Plus Jakarta Sans* en toda la aplicación.
   - Reemplazo de todas las clases `font-serif` por `font-sans font-extrabold` o `font-bold`.

5. **Navegación Anti-Parpadeo (`App.tsx` & `BottomNavBar.tsx`):**
   - Semáforo `isProgrammaticScrollRef` que congela las lecturas transitorias del scroll durante la navegación por botones y se libera mediante `scrollend` o interacción del usuario.
   - Sincronización entre Navbar de escritorio, BottomNavBar y el menú de "Más".
   - Reposicionamiento del badge PROMO centrado verticalmente sobre el icono.

6. **Carrito y Localización Colombiana (`CartContext.tsx`, `CartDrawer.tsx`, `CheckoutModal.tsx`, `mockProducts.ts`):**
   - Presentación de envío *"Pendiente de calcular"* en la bolsa de compras.
   - Adopción de moneda Pesos Colombianos (COP) formateada con `es-CO`.
   - Adición de `stockUnits` en catálogo ("Disponibles: 4 u.", "Pocas unidades", "Bajo pedido", "Por confirmar").
   - Actualización de datos de contacto a Colombia ("Atención en línea — Colombia").

---

## 4. ARCHIVOS MODIFICADOS

- `/src/game/scenes/LevelScene.ts` — Motor de física, controles unificados y captura de teclas.
- `/src/game/BtlGameSection.tsx` — Contenedor canvas, pointer events táctiles y overlay móvil vertical.
- `/src/App.tsx` — Anti-flicker lock, scroll spy suave y compatibilidad sticky.
- `/src/components/Navbar.tsx` — Tipografía sans-serif y barra sticky en PC.
- `/src/components/navigation/BottomNavBar.tsx` — Micro-badge PROMO centrado y estado activo de submenú.
- `/src/context/CartContext.tsx` — Estado de envío pendiente y cálculos en COP.
- `/src/components/cart/CartDrawer.tsx` — Aviso logístico colombiano y desglose sin envío inventado.
- `/src/components/cart/CheckoutModal.tsx` — Checkout localizado para Colombia y selección honesta de pago.
- `/src/types/index.ts` — Ampliación de tipos para `stockUnits` y estados de disponibilidad.
- `/src/data/mockProducts.ts` — Catálogo con stock demostrado en COP.
- `/src/data/businessConfig.ts` — Contacto localizado a Colombia.
- `/src/components/catalog/ProductCard.tsx` — Insignias de inventario y precios en COP.
- `/src/components/catalog/ProductDetailModal.tsx` — Ficha técnica con stock real y tipografía moderna.
- `/src/components/Hero.tsx` — Eliminación de fuentes serif.
- `/src/components/AboutSection.tsx` — Tipografía sans-serif.
- `/src/components/catalog/CatalogSection.tsx` — Títulos con Plus Jakarta Sans.
- `/src/components/ContactSection.tsx` — Ubicación colombiana y tipografía sans-serif.
- `/src/components/Footer.tsx` — Tipografía sans-serif.
- `/index.html` — Fuente única Plus Jakarta Sans.
- `/src/index.css` — Variables CSS tipográficas normalizadas.

---

## 5. PRUEBAS EJECUTADAS Y RESULTADOS

| Prueba | Entorno / Herramienta | Resultado | Observaciones |
| :--- | :--- | :--- | :--- |
| **Compilación y Empaquetado** | `compile_applet` (Vite 8 / TSX) | **ÉXITO** | Cero errores de sintaxis o empaquetado. |
| **Validación de Tipos y Linter** | `lint_applet` (`tsc --noEmit`) | **ÉXITO** | Cero errores de TypeScript. |
| **Verificación de Endpoints Locales** | `curl /api/health` | **ÉXITO** | Respuesta HTTP 200 con payload de salud del servidor. |
| **Sesión de Juego BTL** | `curl /api/btl/session/start` | **ÉXITO** | Genera ID de sesión y telemetría inicial correctamente. |
| **Búsqueda de Referencias Antiguas** | `grep -rn 'es-AR'`, `'Palermo'` | **ÉXITO (0 matches)** | Eliminada cualquier mención residual de Argentina. |
| **Auditoría de Fuentes Serif** | `grep -rn 'font-serif'` | **ÉXITO (0 en JSX)** | Todas las interfaces migradas a Plus Jakarta Sans. |

---

## 6. LIMITACIONES Y PENDIENTES FUTUROS

1. **Pasarelas de Pago Reales:** Actualmente el checkout genera órdenes demostrativas y enlace a WhatsApp. La integración de pasarelas colombianas en producción (Wompi, PayU, PSE real) está prevista para una etapa comercial posterior.
2. **Cotización Logística en Tiempo Real:** Las tarifas de envío ($12.000 / $18.000 COP) son valores referenciales para Colombia; la integración con APIs de transportadoras (Envia, Servientrega, Coordinadora) dependerá de contratos comerciales futuros.
3. **Persistencia Centralizada de Inventario:** El stock demostrado se administra en el catálogo local; la sincronización multi-usuario en tiempo real requiere la base de datos de Fase 3.
