# Fase 3.2 — Dashboard de Data Analytics

## Objetivo y alcance

Esta fase convierte la sección **Data Analytics** del panel administrativo en un tablero funcional. Lee agregados de SQLite mediante endpoints administrativos de solo lectura; no modifica pedidos, usuarios, telemetría ni autenticación.

## Arquitectura y fuentes

El navegador solicita cinco recursos autenticados al servidor Express. El servidor valida el periodo UTC (7, 30, 90 días o intervalo `YYYY-MM-DD` de máximo 366 días) y SQLite realiza las agregaciones. No se cargan filas completas para agregarlas en el cliente.

| Fuente | Uso |
| --- | --- |
| `orders`, `order_items` | Ventas simuladas, estados, productos, cupones y pedido registrado. |
| `users` | Registros; compradores solo con `user_id` verificable. |
| `analytics_events` | Comportamiento consentido: vistas, búsquedas, filtros, carrito y checkout. |
| `coupons` | Clasificación y uso de cupones, incluido BTL. |
| `game_sessions`, `btl_sessions` | Victorias y sesiones técnicas de Pompón. |

## Endpoints

- `GET /api/admin/analytics/sales`
- `GET /api/admin/analytics/customers`
- `GET /api/admin/analytics/behavior`
- `GET /api/admin/analytics/conversion`
- `GET /api/admin/analytics/game`

Todos requieren `requireAdmin`, aceptan `period=7|30|90` o `start` y `end`, y no devuelven nombres, emails, direcciones, tokens, hashes o identificadores de sesión.

## KPI y módulos

- **Ventas:** total de pedidos (incluye cancelados); pedidos, importe y ticket promedio simulados (excluyen cancelados); estados, evolución diaria y productos por unidades.
- **Clientes:** registrados, registros del periodo, compradores identificables, recurrentes (dos o más pedidos no cancelados) y promedio de pedidos. Los invitados se excluyen explícitamente para no deduplicar identidades sin evidencia.
- **Comportamiento:** eventos y sesiones únicas por tipo, actividad diaria y productos por interacción. La interfaz mantiene el aviso de consentimiento obligatorio y no expone términos de búsqueda.
- **Conversión observada:** presenta conteos por etapa, no tasas, porque no existe una relación secuencial verificable de todas las sesiones consentidas con todos los pedidos. No calcula abandono de carrito.
- **BTL:** sesiones técnicas, victorias, niveles, cupones BTL generados/usados e importe simulado de pedidos no cancelados con cupón BTL. No infiere causalidad ni una tasa de finalización.

Los importes proceden de pedidos simulados y siempre se etiquetan como tales. La moneda se muestra en COP.

## Seguridad y privacidad

Las rutas son exclusivamente `GET`, usan parámetros en todas las consultas dinámicas y acotan resultados de rankings. La telemetría incluye solo eventos registrados tras consentimiento; sus métricas no representan necesariamente a todos los visitantes.

## Pruebas y ejecución

Ejecutar:

```bash
npm run lint
npm run build
npm run test:phase-3-2
npm run dev
```

La prueba aislada crea una base SQLite temporal y comprueba autorización, fechas inválidas, exclusión de cancelados, privacidad de las respuestas, telemetría y BTL. Para abrir el tablero localmente: iniciar sesión como administrador, ir a `/admin` y elegir **Data Analytics**.

## Limitaciones conocidas

- No hay atribución fiable entre sesiones con consentimiento y cada pedido; por eso no hay tasa secuencial ni abandono.
- Compradores invitados no se incorporan a recurrencia ni promedio identificable.
- Los gráficos son barras CSS/SVG ligeras, responsivas y basadas únicamente en agregados disponibles.

## Evidencias visuales

Las capturas funcionales deben guardarse en `docs/evidencias/fase-3-2/` (directorio reservado, sin imágenes sintéticas). Se recomiendan: filtro de 30 días, rango personalizado, estado sin datos, módulo de ventas, comportamiento con aviso de consentimiento, conversión observada y BTL.

## Refinamiento 3.2.1: arquitectura modular y navegación

El tablero ya no apila todos los módulos. La vista inicial es **Resumen ejecutivo** y la navegación secundaria permite abrir de forma independiente **Ventas**, **Clientes**, **Comportamiento**, **Conversión y cupones** y **Videojuego BTL**. Es una navegación de botones HTML accesibles por teclado, con estado activo visible y desplazamiento horizontal contenido en pantallas pequeñas; no introduce rutas nuevas ni cambia el sidebar principal.

La implementación se organiza en `src/components/admin/analytics/`:

- `AnalyticsNavigation` y `AnalyticsFilters`: navegación y controles globales en UTC.
- `AnalyticsOverview`: KPIs de visión rápida y accesos a los dominios.
- `SalesAnalytics`, `CustomersAnalytics`, `BehaviorAnalytics`, `ConversionAnalytics` y `GameAnalytics`: una vista por dominio.
- `shared`: tarjetas KPI, barras, formato COP y etiquetas legibles de estados.

`AnalyticsDashboard` conserva el periodo seleccionado y almacena localmente las respuestas por periodo. Carga el módulo activo bajo demanda; el resumen solicita sus cinco fuentes porque sus KPI abarcan universos distintos. El botón Actualizar invalida funcionalmente la vista solicitando datos actuales sin alterar el módulo activo.

### Ajustes de presentación

- Los estados de pedido se traducen solo en la interfaz (`en_preparacion` → “En preparación”); SQLite mantiene sus valores originales.
- Los rankings siguen usando el `product_id` como identidad. Productos con el mismo nombre pero IDs distintos se muestran como registros distintos, y la tabla hace visible el ID para no ocultar esa diferencia.
- Barras sin filas muestran un estado explicativo, no un error ni valores ficticios.
- La cabecera administrativa conserva la versión `v2.4` y actualiza únicamente el rótulo de fase a 3.2.1.

### Capturas académicas adicionales

1. Resumen ejecutivo con sus accesos a módulos.
2. Navegación activa en Ventas y estados traducidos.
3. Clientes con la advertencia de invitados excluidos.
4. Comportamiento con la aclaración de consentimiento.
5. Conversión observada sin tasa calculada.
6. Videojuego BTL sin datos (cuando aplique) y con datos reales.
