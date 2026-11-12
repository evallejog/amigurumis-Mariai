# Amigurumis Mariai

Plataforma académica de comercio electrónico para productos artesanales. Integra catálogo, carrito y pedidos simulados, autenticación, comprobantes PDF académicos, videojuego promocional BTL, Data Analytics y un pipeline experimental de Machine Learning.

## Objetivo académico

Demostrar la integración de una tienda web full stack con análisis descriptivo y un proceso reproducible de preparación y evaluación exploratoria de series de unidades vendidas. El sistema no procesa pagos reales, no emite factura electrónica tributaria y no ofrece predicciones como decisiones de inventario.

## Funcionalidades

- Catálogo de productos con disponibilidad y carrito.
- Registro e inicio de sesión mediante sesiones almacenadas en SQLite.
- Checkout con validación del servidor, inventario y cupones.
- Historial de pedidos y descarga de comprobantes PDF.
- Videojuego Phaser “Las Aventuras de Pompón” con recompensas BTL. La finalización se informa desde el cliente y no constituye protección antitrampas completa.
- Panel administrativo para productos, pedidos, clientes, cupones y estadísticas.
- Data Analytics descriptivo y comparativo, segmentación y exportación CSV.
- Pipeline Python separado para auditoría de calidad y experimentos académicos con datos sintéticos. Los datos reales se leen en modo SQLite de solo lectura y el entrenamiento se omite cuando son insuficientes.

## Tecnologías y arquitectura

- Frontend: React, TypeScript, Vite y Tailwind CSS.
- Backend: Node.js y Express.
- Persistencia local: SQLite con `better-sqlite3`.
- Juego: Phaser.
- Machine Learning: Python, pandas, NumPy y scikit-learn.

Express sirve la API y la aplicación web. El pipeline ML se ejecuta localmente como proceso independiente; las rutas administrativas solo leen artefactos JSON pre-generados. Los experimentos académicos se identifican como `synthetic_academic` y no se insertan en SQLite comercial.

## Requisitos

- Node.js compatible con las dependencias instaladas (se recomienda una versión LTS reciente).
- Python 3.11 o compatible para ML.
- En Windows, herramientas de compilación compatibles si `better-sqlite3` requiere compilarse durante la instalación.

## Instalación y ejecución local

```powershell
npm install
npm run dev
```

El servidor inicia la aplicación y la API local. Los scripts disponibles se consultan con `npm run`. No se requiere clave de Gemini para las funcionalidades descritas aquí.

## Variables de entorno

El archivo `.env.example` enumera variables opcionales:

- `ADMIN_PASSWORD`: contraseña inicial/configurada para la cuenta administrativa según la inicialización de la base.
- `DATABASE_PATH`: ubicación alternativa de SQLite; si se usa, verificar la ruta antes de iniciar para no crear datos en una ubicación equivocada.
- `SEED_DEMO_DATA`: habilita carga de datos demo cuando vale `true`.
- `PORT`: puerto HTTP.
- `NODE_ENV`: distingue desarrollo y producción (incluye configuración de cookies seguras en producción).
- `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`: configuración opcional de integración Turso, si se habilita.
- `DISABLE_HMR`: controla el watcher de desarrollo de Vite.

No almacenar secretos reales en el repositorio. La tienda utiliza SQLite local por defecto; la configuración de Turso es opcional y no implica que un entorno esté conectado.

## Base de datos, compras y autenticación

SQLite conserva productos, usuarios, sesiones, pedidos, líneas de pedido, cupones, registros del videojuego y telemetría. El backend valida los precios de productos persistidos, cantidades, inventario y cupones. El flujo de pago es académico: no existe confirmación financiera de una pasarela. Los PDF son comprobantes de demostración y no facturas electrónicas con validez tributaria.

Las sesiones web se transportan mediante cookie `HttpOnly`; las autorizaciones administrativas se aplican en el servidor. Los pedidos de invitados y los enlaces con token se manejan según los endpoints del proyecto.

## Data Analytics

El panel administrativo contiene métricas agregadas de ventas simuladas, clientes identificables, eventos con consentimiento, conversión observada, cupones y videojuego. Las métricas de eventos no representan necesariamente todos los visitantes. Los importes analíticos son simulados, y los conteos observados no son automáticamente tasas de conversión.

Documentación: `docs/FASE_3_2_DASHBOARD_DATA_ANALYTICS.md` y `docs/FASE_3_3_ANALITICA_AVANZADA.md`.

## Machine Learning experimental

Desde PowerShell:

```powershell
cd ml
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m src.pipeline --source synthetic
```

Para auditar datos reales, indique explícitamente una base existente y confirme que es la correcta antes de ejecutar:

```powershell
python -m src.pipeline --source real --db ..\data\amigurumis_mariai.db
```

La extracción real abre SQLite en modo de solo lectura. El pipeline puede omitir entrenamiento si no alcanza suficiencia; no se deben interpretar datos sintéticos como ventas comerciales. Los resultados son exploratorios, no un modelo validado para producción.

Más detalles: `docs/FASE_4_MACHINE_LEARNING.md`.

## Pruebas

Desde la raíz:

```powershell
npm run lint
npm run test:phase-3-2
npm run test:phase-3-3
```

Las pruebas aisladas de analítica usan una base temporal. Para ML, activar el entorno virtual dentro de `ml` y ejecutar `python -m pytest`.

## Estructura principal

```text
src/                 Aplicación React y componentes
server.ts            API Express
server/              SQLite, autenticación y PDF
ml/                  Pipeline Python y artefactos locales
docs/                Documentación por fase
scripts/             Pruebas de integración aisladas
```

## Privacidad, seguridad y limitaciones

La telemetría aplica consentimiento y una lista permitida de propiedades. Los datos comerciales y sintéticos se mantienen separados. El proyecto es académico y requiere revisión adicional antes de producción, incluyendo pruebas de seguridad y operación. El juego informa finalizaciones desde el navegador; no tiene verificación antifraude completa. La disponibilidad de productos no equivale a historial de inventario ni permite observar demanda perdida por falta de stock.

## Estado

Proyecto académico en desarrollo y revisión. No se afirma despliegue público, pagos reales, cumplimiento de facturación electrónica ni preparación de Machine Learning para producción.
