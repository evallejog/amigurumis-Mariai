# Fase 4 — Machine Learning

## Arquitectura

`ml/src/pipeline.py` es un proceso local independiente y reproducible. Extrae SQLite en modo `ro`, prepara series por producto y ejecuta validación cronológica. Express solo lee cuatro artefactos JSON predefinidos; nunca inicia Python desde HTTP.

## Datos y suficiencia

La fuente real usa `orders`, `order_items` y `products`, excluye cancelaciones y no extrae PII. Las ventas observadas no equivalen a demanda total ni conocen roturas de stock. Calidad clasifica el dataset como `insufficient`, `exploratory` o `evaluable` con umbrales configurables en `ml/config/experiment.json`.

## Pipeline académico

La fuente `synthetic_academic` crea cuatro productos ficticios y 52 semanas con semilla 42, estacionalidad simple y ruido controlado. No se inserta en SQLite. La ejecución local realizada generó 208 observaciones semanales; sus artefactos están etiquetados explícitamente como académicos.

## Modelos y evaluación

Se comparan `naive_last`, `historical_mean` y `ridge_lag1`. La división es cronológica por producto; `lag1` procede solo de periodos anteriores. Se informan MAE, RMSE, WAPE cuando su denominador es válido y sesgo. No hay MAPE con ceros, ni afirmaciones de significancia o preparación de producción.

## Endpoints

- `/api/admin/ml/status`
- `/api/admin/ml/data-quality`
- `/api/admin/ml/evaluation`
- `/api/admin/ml/predictions`
- `/api/admin/ml/experiments`

Todos requieren administrador, no aceptan rutas de archivos y validan el origen del JSON. Artefactos malformados o inexistentes producen estado disponible/no disponible sin trazas.

## Reproducibilidad Windows

```powershell
cd ml
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m src.pipeline --source synthetic
python -m src.pipeline --source real --db ..\data\amigurumis_mariai.db
```

## Limitaciones y evidencias

No hay entrenamiento automático, recomendaciones de inventario ni modelos ejecutables serializados. Los artefactos JSON se ignoran en Git. Capturas recomendadas: estado académico, calidad, tabla de evaluación, predicciones vacías con advertencia y estado sin experimento. Guardarlas en `docs/evidencias/fase-4/`.

## Refinamiento 4.1: dashboard y trazabilidad

Las cinco pestañas ahora presentan tarjetas, estados vacíos y tablas administrativas; no muestran JSON sin procesar. Resumen, calidad, ejecuciones, evaluación y predicciones se cargan desde endpoints independientes. El origen se representa según `data_source` del manifiesto. La disponibilidad de SQLite comercial se presenta como un estado separado.

Cada corrida se conserva en `ml/artifacts/runs/<run_id>/`. Los snapshots en la raíz apuntan a la corrida más reciente para compatibilidad local, y Express valida el `run_id`, el origen y la correspondencia de artefactos antes de devolverlos. Una corrida real no elimina la académica. No se ofrece historial más allá de las ejecuciones conservadas en disco.

El manifiesto incluye `training_status`, `reason` y `sufficiency`. Para los datos comerciales auditados (5 observaciones, 4 productos, 2 faltantes), el entrenamiento se marca `skipped` por `insufficient_data`; el dashboard comunica cero modelos evaluados y ninguna predicción disponible.

Validación refinamiento 4.1: `npm run lint`, `npm run build`, `npm run test:phase-3-2` y `npm run test:phase-3-3` deben ejecutarse desde la raíz. `python -m pytest` se ejecuta desde `ml`; si pytest no está instalado en el intérprete seleccionado, instalar dependencias desde `ml/requirements.txt` dentro del entorno virtual documentado.
