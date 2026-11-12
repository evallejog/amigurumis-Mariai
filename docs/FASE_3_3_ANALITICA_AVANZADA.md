# Fase 3.3 — Analítica avanzada y preparación para ML

## Objetivo y arquitectura

La fase añade Analítica avanzada al dashboard modular sin cambiar la telemetría, los pedidos ni la autenticación. Express agrega SQLite mediante consultas parametrizadas y entrega respuestas sin datos personales. El cliente conserva el periodo UTC global y ofrece cuatro vistas internas: comparativas, segmentación, productos y exportación.

## Fuentes y granularidad

| Fuente | Granularidad | Uso |
| --- | --- | --- |
| `orders`, `order_items` | pedido / línea | ventas, unidades y rendimiento de producto |
| `users` | usuario registrado | segmentos agregados |
| `analytics_events` | evento consentido agregado | actividad por día y tipo |
| `coupons` | cupón/pedido | uso de cupones |

Los invitados no se deduplican ni se incluyen en segmentos identificables. Administradores y pedidos cancelados se excluyen de métricas de compra válida.

## Endpoints y contratos

- `GET /api/admin/analytics/advanced/comparison`
- `GET /api/admin/analytics/advanced/segments`
- `GET /api/admin/analytics/advanced/products`
- `GET /api/admin/analytics/advanced/export?type=timeline|products|segments|events`

Todos requieren `requireAdmin`, usan el filtro UTC existente y son solo de lectura. Los contratos están en `src/types/analytics.ts`.

## Definiciones

La comparación enfrenta el periodo activo con el intervalo anterior de la misma duración. La variación absoluta es `actual - anterior`; la porcentual solo existe si el valor anterior no es cero; en otro caso se devuelve **Sin base comparable**. El endpoint actual conserva la convención inclusiva heredada de Fase 3.2 (`00:00:00.000Z` a `23:59:59.999Z`); el periodo anterior termina un milisegundo antes del inicio actual para no duplicar límites.

Los segmentos son dimensiones superpuestas: nuevos registrados, primera compra identificable, recurrentes (dos o más pedidos válidos), activos, sin actividad reciente y registrados sin compras. RFM es exploratorio y solo cuenta compradores identificables: reciente ≤30 días, frecuente ≥2 pedidos y mayor importe acumulado ≥100.000 COP. No es un modelo predictivo.

El importe de producto es el subtotal de líneas (`precio × cantidad`) anterior a descuentos; descuentos de pedido no se distribuyen. El agrupamiento usa `product_id`, por lo que nombres coincidentes no se fusionan.

## CSV seguro

Los CSV usan UTF-8 con BOM, coma como delimitador, comillas escapadas, fechas ISO UTC y valores monetarios numéricos sin símbolo. Celdas que empiezan por `=`, `+`, `-` o `@` se neutralizan para evitar inyección de fórmulas. No contienen emails, teléfonos, direcciones, sesiones, IDs anónimos, tokens ni metadatos. La exportación de eventos se limita a 10.000 filas agregadas.

## Preparación para Fase 4

El dataset futuro de demanda tiene una fila por `fecha_utc` y `product_id`, con unidades válidas y subtotal de línea simulado. Limpieza: excluir cancelados, conservar faltantes como ausencia de actividad y no mezclar invitados con usuarios. Un objetivo futuro posible es demanda agregada de unidades por producto. Se requiere separación temporal de entrenamiento/evaluación, y no deben usarse datos posteriores al punto de predicción (fuga temporal). El volumen actual puede ser insuficiente para un modelo de producción; esta fase no entrena ni simula predicciones.

## Seguridad, límites y evidencias

No se infiere causalidad, atributos sensibles ni cobertura de telemetría. Las comparativas no declaran significancia estadística. Productos sin actividad muestran estado vacío; la exportación de segmentos es agregada.

Capturas recomendadas en `docs/evidencias/fase-3-3/`: comparativa con y sin base, segmentos/RFM, tabla de productos con IDs duplicados por nombre, estado vacío, exportación disponible y error de rango inválido.

## Pruebas

Ejecutar `npm run lint`, `npm run build`, `npm run test:phase-3-2` y `npm run test:phase-3-3`. La suite 3.3 usa una SQLite temporal y cubre autorización, comparación, segmentos, productos con nombre duplicado y CSV.
