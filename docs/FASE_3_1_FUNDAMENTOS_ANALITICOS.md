# Fase 3.1 — Fundamentos analíticos

## Objetivo y alcance

Esta fase incorpora captura académica y simulada de eventos a la aplicación existente. SQLite y las tablas transaccionales siguen siendo la fuente operativa. La tabla `analytics_events` es un registro inmutable de hechos derivados y de interacciones opcionales. No se implementan pagos reales, facturación fiscal, Turso, dashboard ni modelos ML.

## Semántica de negocio

- **Pedido creado:** una fila de `orders` y sus líneas se confirmaron en una transacción SQLite. No representa pago.
- **Pedido cancelado:** transición administrativa al estado terminal `cancelado`; se conserva el pedido y se emite `order_cancelled`.
- **Pedido entregado:** estado administrativo `entregado`; representa una entrega simulada registrada, no prueba logística externa.
- **Venta simulada:** pedido no cancelado registrado en el entorno académico. No implica pago real.
- **Ingreso simulado:** importe `total` de pedidos simulados no cancelados. Siempre debe presentarse con la etiqueta “simulado”; no es ingreso contable.
- **Descuento aplicado:** `orders.discount`, distinto de `subtotal`; el total incluye envío y descuento conforme al checkout actual.
- **Cupón emitido/reclamado:** emisión se registra en `coupons`; asignación a usuario representa reclamo vinculado. No hay un timestamp de reclamo heredado.
- **Cupón redimido:** uso confirmado dentro de la misma transacción de creación del pedido; evento `coupon_redeemed`.
- **Producto visualizado, agregado, búsqueda/filtro:** señales opcionales de comportamiento, sólo con consentimiento.
- **Checkout iniciado:** evento opcional al abrir checkout. No existe señal fiable de abandono todavía; inferir abandono por ausencia de pedido requiere una ventana temporal y deduplicación posteriores.

Cancelar un pedido no borra el registro ni genera ventas válidas. Los eventos analíticos no sustituyen pedidos, líneas, cupones ni auditoría administrativa.

## Arquitectura y esquema

`server/db.ts` crea idempotentemente `analytics_events` en la conexión SQLite existente y agrega índices por nombre/fecha, fecha y sesión. La tabla guarda identificador único, nombre, versión, IDs seudónimos, usuario opcional resuelto por servidor, fuente, entidad, JSON de propiedades, fecha del evento, recepción y marca simulada. No contiene PII esperada. La identidad de usuario no se acepta del navegador.

La variable opcional `DATABASE_PATH` permite pruebas aisladas; sin ella se usa el archivo local existente. Ningún dato previo se borra. `SEED_DEMO_DATA=true` opta por las semillas de demostración; el arranque normal no crea usuarios/pedidos/cupones demo. La inicialización de catálogo también es opt-in.

## Eventos y endpoint

`POST /api/analytics/events` acepta lotes de 1 a 20 eventos con versión `1.0.0`, IDs con formato validado, fechas UTC, nombres permitidos, propiedades con allowlist por evento y límite de 2 KB por propiedades. El middleware de ruta limita el cuerpo a 32 KB y aplica rate limiting. Los eventos de orden y cupón se generan dentro de la transacción del backend; la deduplicación usa ID de evento y `INSERT OR IGNORE`.

Eventos opcionales implementados: `page_viewed`, `product_viewed`, `product_searched`, `product_filtered`, `cart_item_added`, `cart_item_removed`, `checkout_started`. Eventos autoritativos: `order_placed`, `coupon_redeemed`, `order_cancelled`. Un pedido sólo emite evento tras quedar confirmado por SQLite; los eventos se incluyen en su transacción.

## Consentimiento y privacidad

El diálogo ofrece aceptar o rechazar analítica. La opción inicial es sin consentimiento y `track()` no envía datos. La sesión e identificador anónimo viven en `sessionStorage`, se crean sólo después de aceptar y no usan el token de autenticación. La revocación elimina ambos IDs de sesión. No se envían textos de búsqueda, datos del formulario, correos, teléfonos, direcciones, contraseñas ni tokens. El backend asigna el usuario sólo desde la sesión autenticada.

## Pedidos y videojuego

Todos los pedidos nuevos siguen marcados `is_simulated=1`. La atribución de `order_placed` usa el ID de sesión analítica cuando el consentimiento está vigente; de lo contrario un ID técnico de pedido. El dashboard BTL previo suma registros de `btl_sessions` y `game_sessions`, por lo que puede contar dos veces una misma partida. Esta fase no cambia la física ni las recompensas y no genera eventos de juego duplicados; sólo mantiene la persistencia heredada. No se debe usar esa suma como conteo único.

## Exportación y semillas

La descarga `/api/system/export-dump` requiere administrador en todos los entornos y excluye sesiones, eventos analíticos, hashes, `google_sub` y tokens de acceso de pedidos. Las semillas de pedido/usuario/cupón/catálogo son opt-in para prevenir contaminación al reiniciar; no se eliminan filas existentes.

## Pruebas y limitaciones

La suite `npm run test:phase-3-1` inicia un proceso con `DATABASE_PATH` en una carpeta temporal del sistema. Verifica esquema e índices, ingestión y deduplicación, rechazo de nombres/eventos/propiedades/identidad/fechas no permitidos, límite de solicitudes, catálogo y pedido rechazado sin evento de éxito, creación de pedido simulado con redención de cupón, no duplicación comercial, cancelación y su evento, acceso de exportación, ausencia de semillas operativas, consentimiento por defecto y compatibilidad de inicio/finalización/recompensa heredados del juego. Al terminar espera la salida del servidor y elimina sólo la carpeta temporal.

**Ejecución final observada:** `npm run lint` terminó sin errores. `npm run build` terminó correctamente con Vite 8.3.8 y 1.694 módulos; Vite emitió una advertencia no bloqueante por un chunk JS >500 kB. `npm run test:phase-3-1` terminó con código 0 e imprimió `Fase 3.1 isolated integration checks passed.`. Las verificaciones se ejecutaron con SQLite temporal, no con `data/amigurumis_mariai.db`.

Los eventos anteriores a la instrumentación no se reconstruyen. No se registran todavía fallos de checkout, abandono medido, emisión/reclamo del juego como eventos, cambios de cantidad, retirada masiva ni entrega. La prueba confirma el rechazo de pedido incompleto y que no aparece `order_placed`; el endpoint de pedido maneja también validación de inventario/cupón, pero esta suite no cubre cada rama de rechazo. El rate limit usa el almacén por proceso predeterminado de Express, suficiente para esta aplicación académica de instancia única. La prueba confirma cupón redimido y duplicación del intento rechazado, pero no ensaya concurrencia de compras.

## Preparación para Fase 3.2

Definir agregaciones con estados excluidos y etiqueta simulada, reconciliar cupones contra pedidos, evitar doble conteo de sesiones de juego y probar indicadores sobre cohortes futuras reales/simuladas claramente diferenciadas. Añadir ventana operacional para abandono sólo con definición explícita.
