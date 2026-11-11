# PREPARACIÓN ARQUITECTÓNICA INTEGRAL — TIENDA VIRTUAL DE AMIGURUMIS

> **Documento:** Marco de Evolución Tecnológica y Arquitectura de Sistemas  
> **Versión:** 2.0.0-phase2b  
> **Fecha de Elaboración:** Noviembre 2026  
> **Rol:** Arquitectura de Software Senior, Data Engineering & Machine Learning  
> **Estado de la Intervención:** Fase 2B Completada: Eliminación Total de IA, Videojuego BTL con Phaser 3 Operativo y BottomNavBar Responsive

---

## CONVENCIONES DE ESTADO EN EL DOCUMENTO

Para garantizar máxima transparencia técnica, cada módulo, componente y capacidad se clasifica explícitamente bajo una de las siguientes etiquetas:

- **`[EXISTENTE]`**: Funcionalidad, código o dependencia ya implementada y operativa en el repositorio.
- **`[PREPARADO]`**: Contrato tipado, interfaz, punto de extensión o abstracción introducida para viabilizar el futuro acoplamiento sin modificar la base funcional.
- **`[PROPUESTO]`**: Diseño arquitectónico y especificación técnica aprobada para su implementación progresiva.
- **`[PENDIENTE]`**: Módulo o funcionalidad futura que no forma parte del alcance actual.

---

## 1. DIAGNÓSTICO DE LA ARQUITECTURA ACTUAL

### 1.1. Visión Holística del Repositorio
El repositorio alberga una solución de comercio electrónico artesanal especializada en muñecos tejidos a crochet (*amigurumis*). Su arquitectura corresponde a un **monolito modular full-stack en Node.js/TypeScript**, orquestado con Express en el backend y React 19 en el cliente web, integrado a través del servidor de desarrollo de Vite.

```
                              ┌──────────────────────────────────────────────┐
                              │           CLIENTE WEB (REACT 19 SPA)         │
                              │  - UI: Apple Liquid Glass (Tailwind v4)      │
                              │  - Navegación: TopBar (Desktop) + BottomBar  │
                              │  - Minijuego BTL: Phaser 3 Canvas Arcade     │
                              │  - Estado Local: CartContext (LocalStorage)  │
                              └──────────────────────┬───────────────────────┘
                                                     │ HTTP / REST
                                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   SERVIDOR EXPRESS (Node.js/TSX)                                │
│                                                                                                 │
│  ┌───────────────────────┐   ┌───────────────────────────┐   ┌──────────────────────────────┐  │
│  │  Vite Middlewares     │   │  /api/btl/session/*       │   │  /api/orders                 │  │
│  │  (HMR / Assets SPA)   │   │  (Telemetría de Juego)    │   │  (Almacén Volátil In-Memory) │  │
│  └───────────────────────┘   └─────────────┬─────────────┘   └──────────────────────────────┘  │
│                                            │                                                    │
└────────────────────────────────────────────┼────────────────────────────────────────────────────┘
```

### 1.2. Inventario de Componentes y Funcionalidades
| Dominio | Componente / Archivo | Estado | Descripción Funcional |
| :--- | :--- | :--- | :--- |
| **Shell & Layout** | `/src/App.tsx`, `Navbar.tsx`, `Footer.tsx` | `[EXISTENTE]` | Barra superior translúcida con contador de carrito reactivo, navegación suave entre anclas y pie de página institucional. |
| **Navegación Móvil** | `/src/components/navigation/BottomNavBar.tsx` | `[EXISTENTE - FASE 2B]` | Barra inferior fija (< 1024px) tipo app nativa con Inicio, Colección, Jugar BTL y Menú 'Más' en bottom sheet. |
| **Diseño Visual** | `/src/index.css`, `/index.html` | `[EXISTENTE]` | Sistema de diseño inspirado en *Apple Liquid Glass*: fondos `#FAF7F2`, desenfoques gaussianos (`backdrop-filter: blur(24px)`), bordes especulares y tipografías *Playfair Display* y *Plus Jakarta Sans*. |
| **Catálogo** | `/src/components/catalog/*`, `mockProducts.ts` | `[EXISTENTE]` | Listado con 6 modelos de amigurumi, filtros por categoría (Animales, Marinos, Fantasía, Botánica, Personalizados), ordenamiento y modal de detalle técnico. |
| **Carrito & Checkout**| `/src/context/CartContext.tsx`, `CartDrawer.tsx`, `CheckoutModal.tsx` | `[EXISTENTE]` | Bolsa de compras desplegable, barra de progreso para envío gratis ($30.000 ARS), y checkout multi-pasarela (Apple Pay, Tarjetas, Transferencia Bancaria, Pago contra entrega). |
| **Minijuego BTL** | `/src/game/*`, `BtlGameSection.tsx`, `LevelScene.ts`, `textures.ts` | `[EXISTENTE - FASE 2B]` | Videojuego 2D con Phaser 3 "Las Aventuras de Pompón": 3 niveles jugables, física arcade, controles táctiles y de teclado, estrellas, telemetría y cupones BTL. |
| **Backend & APIs** | `/server.ts` | `[EXISTENTE]` | Express 4.21 montando Vite, endpoints `/api/btl/session/start`, `/api/btl/level/complete`, `/api/orders` y `/api/health`. |
| **Persistencia** | `localStorage` (Cliente), Array en memoria (Servidor) | `[EXISTENTE]` | El carrito persiste en el navegador bajo la clave `atelier_amigurumi_cart_v1`. Las órdenes registradas en backend residen temporalmente en memoria volátil. |
| **Contratos Analíticos** | `/src/types/analytics.ts` | `[PREPARADO]` | Definiciones TypeScript para eventos, gamificación BTL, cupones seguros y modelos predictivos. |
| **Minivideojuego BTL** | N/A | `[PENDIENTE]` | Mecánica interactiva lúdica para sustituir la generación de imágenes. |
| **Machine Learning** | N/A | `[PENDIENTE]` | Modelos de predicción de demanda, pronóstico de ventas y clustering RFM. |
| **Big Data Engine** | N/A | `[PENDIENTE]` | Pipeline analítico distribuido o basado en Data Warehouse. |
| **Panel Admin** | N/A | `[PENDIENTE]` | Dashboard con métricas comerciales, de juego y ML. |

---

## 2. STACK TECNOLÓGICO IDENTIFICADO

### 2.1. Capa de Presentación (Frontend)
- **Framework:** React 19.0.1 (`react`, `react-dom`).
- **Lenguaje:** TypeScript 7.0.2 con resolución de módulos `bundler` y compatibilidad ES2022.
- **Herramienta de Construcción:** Vite 8.3.0.
- **Estilos & Motor CSS:** Tailwind CSS 4.3.3 vía `@tailwindcss/vite`.
- **Iconografía:** `lucide-react` (0.546.0).
- **Animaciones:** `motion` (12.23.24) e interpolaciones CSS directas.

### 2.2. Capa de Servicio y Servidor (Backend)
- **Servidor Web:** Express 4.21.2 ejecutado con `tsx` (TypeScript Execute en caliente).
- **Entorno de Ejecución:** Node.js v22 (LTS).
- **Integración GenAI:** `@google/genai` (v3.0.0) utilizando el modelo `gemini-3.8-flash` con esquema de salida JSON estructurado.
- **Variables de Entorno:** `dotenv` (17.2.3) leyendo variables `GEMINI_API_KEY` y `PORT`.

### 2.3. Diagnóstico de Persistencia y Base de Datos
- **Base de Datos Operativa (OLTP):** Actualmente ausente. Las órdenes residen en la variable en memoria `orders: any[]` en `server.ts`.
- **Oportunidad de Evolución:** Se identificó la conveniencia de adoptar PostgreSQL para persistir catálogo, pedidos, perfiles de clientes y el registro de eventos analíticos.

---

## 3. AUDITORÍA TÉCNICA DE LOS MÓDULOS COMERCIALES

1. **Gestión de Catálogo `[EXISTENTE]`:**  
   Implementada mediante la estructura inmutable `mockProducts.ts`. Incluye identificadores (`id`), categorías fijadas, atributos dimensionales (`dimensions`), tiempos estimados de confección (`approxCraftTimeHours`), dificultad de tejido y rutas a fotografías locales en `/src/assets/images/`.
2. **Bolsa de Compras (`CartContext`) `[EXISTENTE]`:**  
   Posee capacidad para alojar productos estándar del catálogo e ítems personalizados creados mediante la herramienta de IA (almacenando el prompt y las especificaciones como metadatos del ítem).
3. **Flujo de Checkout (`CheckoutModal`) `[EXISTENTE]`:**  
   Formulario de tres etapas: validación de datos de envío del cliente, selección de pasarela (con simulación interactiva de Apple Pay, tarjeta, transferencia bancaria y contra-entrega) y pantalla de confirmación con generación descargable de recibo TXT y vinculación directa a WhatsApp.
4. **Seguridad y Validación Comercial `[PREPARADO]`:**  
   Actualmente los precios se recalculan en el cliente antes de ser enviados en la carga útil al endpoint `/api/orders`. Para producción, el backend deberá recalcular los precios contra la base de datos para evitar alteraciones en el payload del navegador.

---

## 4. DIAGNÓSTICO DE LA EXPERIENCIA ACTUAL DE IA (BTL V1)

### 4.1. Arquitectura de la Solución Existente
La experiencia BTL actual es un **Atelier Virtual de Generación de Patrones con IA**:
- **Componente:** `/src/components/ai/AiGeneratorSection.tsx`.
- **Ruta Backend:** `POST /api/ai/generate-amigurumi`.
- **Dependencias:** `@google/genai` v3.0.0.
- **Flujo:** El usuario redacta una idea (o elige presets como "Osito Astronauta"), se parametriza estilo, tamaño y dificultad, y el servidor invoca a Gemini 3.8 Flash con un esquema JSON estricto (`Type.OBJECT`) que describe nombre, paleta de colores HEX, materiales, abreviaturas y vueltas detalladas de tejido (`V1`, `V2`...).
- **Tolerancia a Fallos:** En caso de no contar con `GEMINI_API_KEY` o agotar cuotas, el servidor ejecuta la función de respaldo determinista `createArtisanalPatternFallback(...)`, garantizando que la experiencia de usuario nunca quede rota.

---

## 5. ESTRATEGIA DE TRANSICIÓN HACIA EL MINIVIDEOJUEGO BTL (FASE 2)

### 5.1. Justificación de la Sustitución
La generación de patrones con IA cumplió la primera etapa de interacción personalizada. Sin embargo, para maximizar el enganche promocional BTL (*Below The Line*), fidelización e incentivo a la compra, se transicionará hacia un **minivideojuego de amigurumis** donde la habilidad del usuario desbloquee beneficios comerciales tangibles (cupones de descuento, envíos bonificados o accesorios exclusivos).

### 5.2. Mapeo de Desacoplamiento y Feature Flagging
Para garantizar **cero tiempo de inactividad** y no retirar la experiencia de IA antes de que el videojuego esté validado, se propone un patrón de **Intercambiador de Experiencia BTL**:

```
                                  ┌─────────────────────────────┐
                                  │      FEATURE FLAG BTL       │
                                  │  (VITE_BTL_EXPERIENCE_MODE) │
                                  └──────────────┬──────────────┘
                                                 │
                        ┌────────────────────────┴────────────────────────┐
                        │                                                 │
             ['ai_generator'] (Actual)                            ['minigame'] (Futuro)
                        │                                                 │
                        ▼                                                 ▼
          ┌───────────────────────────┐                     ┌───────────────────────────┐
          │    AiGeneratorSection     │                     │     BtlMinigameSection    │
          │  (Conservado en Fase 1)   │                     │  (Desarrollo en Fase 2)   │
          └───────────────────────────┘                     └───────────────────────────┘
```

### 5.3. Estrategia de Retirada Progresiva (Checklist de Desmantelamiento Seguro)
1. **Paso 1 (Fase 1 - Actual):** Mantener `/src/components/ai/AiGeneratorSection.tsx` y su ruta `/api/ai/generate-amigurumi` operativas.
2. **Paso 2 (Fase 2):** Construir `/src/components/btl/` con el motor del juego.
3. **Paso 3 (Validación):** Someter el minivideojuego a pruebas de usabilidad móvil y verificación de recompensas.
4. **Paso 4 (Switch):** Activar el videojuego como vista principal de la sección `#personalizar`.
5. **Paso 5 (Depuración):** Desactivar rutas de IA obsoletas y desinstalar dependencias no reutilizadas únicamente cuando el videojuego haya completado su período de garantía.

---

## 6. ARQUITECTURA DE GAMIFICACIÓN BTL Y SEGURIDAD DE RECOMPENSAS

### 6.1. Separación de Responsabilidades en el Videojuego
Para evitar vulnerabilidades de trampas en el navegador, el sistema de juego se estructura bajo el patrón **Server-Authoritative Validation**:

```
┌───────────────────────────────────────┐             ┌──────────────────────────────────────────────┐
│           FRONTEND (CLIENTE)          │             │            BACKEND CONFIABLE (API)           │
│                                       │             │                                              │
│  ┌─────────────────────────────────┐  │             │  ┌────────────────────────────────────────┐  │
│  │ Motor Gráfico / Game Loop       │  │             │  │ Gestor de Sesiones de Juego            │  │
│  │ (Canvas 2D / PixiJS / React UI) │  │  Handshake  │  │ - Genera game_session_id               │  │
│  └────────────────┬────────────────┘  ├────────────►│  │ - Emite seed criptográfico de partida  │  │
│                   │                   │             │  └───────────────────┬────────────────────┘  │
│  ┌────────────────▼────────────────┐  │             │                      │                       │
│  │ Telemetría de Eventos de Nivel  │  │             │  ┌───────────────────▼────────────────────┐  │
│  │ (Inicio, tiempo, movimientos)   │  │  Telemetry  │  │ Validador de Rendimiento               │  │
│  └────────────────┬────────────────┘  ├────────────►│  │ - Comprueba física / tiempos mínimos   │  │
│                   │                   │             │  │ - Verifica puntuación alcanzable       │  │
│  ┌────────────────▼────────────────┐  │             │  └───────────────────┬────────────────────┘  │
│  │ Solicitud de Recompensa         │  │  Claim      │                      │                       │
│  │ (POST /api/btl/claim-reward)    │  ├────────────►│  ┌───────────────────▼────────────────────┐  │
│  └─────────────────────────────────┘  │             │  │ Bóveda de Cupones Firmados (HMAC)      │  │
│                                       │◄────────────┤  │ - Genera código único no rejugable     │  │
│                                       │  Signed     │  │ - Registra expiración y topes de uso   │  │
│                                       │  Coupon     │  └────────────────────────────────────────┘  │
└───────────────────────────────────────┘             └──────────────────────────────────────────────┘
```

### 6.2. Protocolo Anti-Manipulación de Puntuaciones
1. **Imposibilidad de inyección directa:** El cliente **no** puede invocar un endpoint con `{ "score": 99999, "grantCoupon": true }`.
2. **Verificación de plausibilidad:** El backend calcula si el tiempo transcurrido entre `level_started` y `level_completed` es consistente con la física del nivel (prevención de bots).
3. **Firma criptográfica de cupones:** Cada cupón emitido lleva una firma HMAC-SHA256 generada con un secreto del servidor (`COUPON_SIGNING_SECRET`).
4. **Restricción de unicidad:** Un `game_session_id` solo puede redimir una recompensa una única vez.
5. **Reglas comerciales en Checkout:** Al aplicar el cupón en la bolsa de compras, el servidor valida:
   - Que no esté expirado (vigencia estándar: 72 horas).
   - Que el subtotal del carrito cumpla con el monto mínimo (`min_subtotal_required`).
   - Que el cupón no figure como `is_redeemed: true` en la base de datos.

---

## 7. ARQUITECTURA DE ANALÍTICA COMERCIAL Y DE COMPORTAMIENTO

### 7.1. Analítica Comercial (Business Intelligence)
Orientada a responder preguntas estratégicas de los artesanos fundadores:
- **Métricas Clave:** Ingresos brutos, volumen de pedidos, ticket medio (AOV), margen por categoría, rotación de modelos más demandados (ej. Osito vs. Dragón).
- **Control de Rentabilidad BTL:** Comparativa del ticket promedio orgánico vs. ticket promedio de pedidos con cupones gamificados.

### 7.2. Analítica de Comportamiento (Funnel de Navegación)
Permite identificar fricciones en el embudo comercial:
$$\text{Funnel: } \text{Vistas de Catálogo} \longrightarrow \text{Apertura de Ficha} \longrightarrow \text{Añadido al Carrito} \longrightarrow \text{Inicio de Checkout} \longrightarrow \text{Pedido Confirmado}$$
- **Indicadores de Abandono:** Medición de carritos creados sin completar checkout, distinguiendo causas (costo de envío, dudas de personalización, abandono en pasarela).

---

## 8. DISEÑO DEL MODELO DE EVENTOS Y TELEMETRÍA

### 8.1. Especificación del Contrato de Eventos (JSON Schema v1.0.0)
Definido e implementado formalmente en `/src/types/analytics.ts`:

```typescript
export interface AnalyticsEvent<TMetadata = Record<string, unknown>> {
  event_id: string;              // UUID v4 único
  event_type: AnalyticsEventType;// 'product_viewed', 'game_started', etc.
  timestamp: string;             // ISO 8601 UTC
  schema_version: '1.0.0';       // Versionado del esquema
  session_id: string;            // UUID de sesión de navegación
  user_id?: string;              // Seudonimizado
  product_id?: string;           // Opcional
  order_id?: string;             // Opcional
  campaign_id?: string;          // Opcional
  game_session_id?: string;      // Opcional
  metadata: TMetadata;           // Carga útil contextual
}
```

### 8.2. Catálogo de Eventos BTL del Minivideojuego
- `game_initialized`: Carga del entorno de juego en el cliente.
- `game_started`: El usuario pulsa iniciar partida.
- `level_started`: Inicio de un nivel específico.
- `level_completed`: Nivel superado con éxito (incluye puntaje y tiempo).
- `level_failed`: Nivel no superado o pérdida de vidas.
- `reward_earned`: Criterio de recompensa alcanzado.
- `coupon_issued`: Servidor entrega código de cupón verificado.
- `coupon_redeemed`: Cupón aplicado con éxito en una compra finalizada.

### 8.3. Principios de Privacidad y Gobernanza de Datos
- **Minimización de Datos:** No se recopilan nombres, direcciones IP completas ni correos en los eventos analíticos crudos.
- **Exclusión Crítica:** Queda estrictamente prohibido registrar números de tarjeta, CVV, contraseñas o datos de pago en `metadata`.
- **Seudonimización:** Los identificadores de usuario (`user_id`) se anonimizan mediante hashing salteado antes de su almacenamiento analítico.

---

## 9. ARQUITECTURA DE MACHINE LEARNING Y CIENCIA DE DATOS

### 9.1. Casos de Uso Identificados y Metodología

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CASOS DE USO MACHINE LEARNING                                │
│                                                                                                │
│  1. PREDICCIÓN DE DEMANDA            2. FORECASTING DE INGRESOS          3. SEGMENTACIÓN RFM   │
│  - Modelo: Regresión / Gradient      - Modelo: Prophet / ARIMA           - Algoritmo: K-Means  │
│    Boosting (LightGBM)               - Variables: Histórico temporal,      sobre Recencia,     │
│  - Entrada: SKUs, festividades         estacionalidad artesanal            Frecuencia y Valor  │
│    (Navidad, Pascua, Día del Niño)   - Salida: Proyección de flujo de    - Salida: Clústeres   │
│  - Salida: Unidades estimadas para     caja a 30 y 90 días                 de compradores y    │
│    planificar compras de hilado                                            jugadores BTL       │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 9.2. Análisis de Comportamiento BTL (Aclaración de Causalidad vs. Correlación)
> **Principio Metodológico Obligatorio:** Un incremento en las compras de jugadores del minivideojuego no prueba por sí mismo que el juego causó la compra (sesgo de autoselección).  
> La arquitectura contempla modelos de **Uplift Modeling** y pruebas A/B futuras para contrastar grupos expuestos al juego frente a grupos de control que reciben incentivos sin gamificación.

### 9.3. Ciclo de Vida MLOps (Machine Learning Operations)
1. **Ingesta:** Extracción de datos curados desde la capa analítica de PostgreSQL.
2. **Preparación de Features:** Construcción de vectores de variables (tiempo de tejido, precio, temporada, tasa de clics).
3. **Entrenamiento & Validación:** División temporal de datasets (Train / Test split respetando el orden cronológico para evitar *data leakage*).
4. **Registro de Modelos:** Versionado semántico de pesos y artefactos (`model_v1.0.joblib`).
5. **Inferencia:** Servicio desacoplado que expone endpoints REST (`/api/ml/forecast-demand`).
6. **Monitoreo:** Detección de degradación de métricas (*data drift* y *concept drift*).

---

## 10. ARQUITECTURA DE INGENIERÍA DE DATOS Y BIG DATA

### 10.1. Arquitectura Medallón (Capas de Curación de Datos)

```
┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐
│     BRONZE (RAW)       │      │    SILVER (CURADA)     │      │      GOLD (MARTS)      │
│                        │      │                        │      │                        │
│ - Ingesta cruda de     │ ───► │ - Limpieza y dedupli-  │ ───► │ - Tablas agregadas     │
│   eventos HTTP JSON    │      │   cación               │      │   diarias y mensuales  │
│ - Inmutable (Append-   │      │ - Parseo de timestamps │      │ - Métricas para el     │
│   only)                │      │ - Validación de esquema│      │   Dashboard Admin      │
│ - Particionado diario  │      │ - Tablas relacionales  │      │ - Datasets de entrena- │
│                        │      │   limpias              │      │   miento para ML       │
└────────────────────────┘      └────────────────────────┘      └────────────────────────┘
```

### 10.2. Evaluación Tecnológica Comparativa
| Tecnología | Idoneidad en Fase Actual | Idoneidad a Escala | Recomendación Arquitectónica |
| :--- | :--- | :--- | :--- |
| **PostgreSQL + Particionado** | **Alta (Óptima)** | **Media-Alta** | Recomendado como almacén transaccional y analítico unificado inicial. Reduce costos operativos y simplifica la infraestructura. |
| **DuckDB / Pandas** | **Alta** | **Media** | Excelente para procesamiento analítico embebido en micro-servicios de Python sin requerir clústeres. |
| **PySpark / Apache Spark** | **Baja (Sobreingeniería actual)** | **Muy Alta** | Reservado para Fases 5/6 o para demostración académica controlada con datos masivos sintéticos. |
| **Google BigQuery** | **Media** | **Muy Alta** | Alternativa Serverless ideal si se requiere analítica federada sobre gigabytes de telemetría sin gestionar servidores. |

### 10.3. Estrategia para Demostraciones Académicas de Big Data
Dado que la tienda artesanal comenzará con un volumen de transacciones propio de un emprendimiento boutique, **se prohíbe simular que la tienda tiene millones de ventas reales**.  
En su lugar, la arquitectura define un módulo generador de **Datasets Sintéticos Reproducibles** (etiquetados con `SyntheticDatasetMetadata` en `/src/types/analytics.ts`) que permitirá someter pipelines de PySpark o DuckDB a pruebas de estrés con 100.000 a 1.000.000 de registros simulados con propósitos exclusivamente de benchmarking y validación académica.

---

## 11. DISEÑO MODULAR DEL PANEL ADMINISTRATIVO (DASHBOARD)

El panel administrativo se integrará bajo la misma estética *Liquid Glass* de la tienda, preservando accesibilidad (WCAG 2.2 AA) y alta legibilidad de datos numéricos.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                           PANEL DE CONTROL ADMINISTRATIVO (ATELIER)                            │
├──────────────────────────────┬───────────────────────────────┬─────────────────────────────────┤
│ MÓDULO A: RESUMEN COMERCIAL  │ MÓDULO B: GAMIFICACIÓN BTL    │ MÓDULO C: MACHINE LEARNING      │
│ - Ingresos del Período ($)   │ - Tasa de Jugadores Activos   │ - Pronóstico Demanda de Hilado  │
│ - Ticket Promedio (AOV)      │ - Tasa de Finalización Niveles│ - Estimación Ventas Mes Próximo │
│ - Top 5 Amigurumis Vendidos  │ - Cupones Emitidos vs Redimidos│- Clústeres de Compradores (RFM) │
├──────────────────────────────┴───────────────────────────────┴─────────────────────────────────┤
│ MÓDULO D: SALUD DE INGENIERÍA DE DATOS & PIPELINES                                             │
│ - Estado de Ingesta (Eventos/seg) | Tasa de Error (0.02%) | Última Sincronización Exitosa     │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Requisitos de Seguridad para el Panel
1. **Autenticación Robusta:** Acceso protegido mediante credenciales cifradas y sesiones con cookies `HttpOnly` y `SameSite: Strict`.
2. **Autorización basada en Roles (RBAC):** Restricción estricta en el backend verificando el rol `admin` antes de despachar información analítica sensible.
3. **Prevención de Exposición:** Ningún componente visual del dashboard administrativo se cargará para usuarios compradores normales.

---

## 12. SEGURIDAD, INTEGRIDAD Y PROTECCIÓN DE DATOS

1. **Defensa en Profundidad para Descuentos:** El cliente web jamás calcula unilateralmente la reducción del total de una orden. El servidor recalcula el subtotal a partir de los precios oficiales en base de datos y descuenta únicamente los montos de cupones válidos verificados criptográficamente.
2. **Aislamiento de Entornos:** Las variables sensibles (`GEMINI_API_KEY`, firmas secretas de cupones, credenciales de base de datos) residen exclusivamente en el entorno del servidor y nunca se exponen al paquete estático del cliente.
3. **Políticas CORS y Sanitización:** Control riguroso de orígenes en Express y sanitización de entradas con esquemas tipados para neutralizar ataques XSS e inyecciones de código.

---

## 13. DEPENDENCIAS FUTURAS RECOMENDADAS

Para las siguientes fases, se evaluará la incorporación controlada de:
- **Fase 2 (Videojuego):** `canvas-confetti` (efectos visuales ligeros) o motor 2D interactivo (`pixi.js` si la complejidad del juego lo demanda).
- **Fase 3 (Analítica):** PostgreSQL driver (`pg` o cliente Prisma/Drizzle) para persistencia real.
- **Fase 4 (Machine Learning):** Servicio Python externo con `FastAPI`, `scikit-learn` y `pandas` desacoplado del monolito Node.js.

---

## 14. MATRIZ DE RIESGOS TÉCNICOS Y ESTRATEGIAS DE MITIGACIÓN

| Riesgo Técnico Identificado | Nivel de Impacto | Estrategia de Mitigación Diseñada |
| :--- | :--- | :--- |
| **Manipulación de puntuaciones en el navegador** | **Alto** | Validación server-authoritative con firmas HMAC y verificación de tiempos mínimos por nivel. |
| **Generación excesiva de cupones de descuento** | **Medio-Alto** | Límite por sesión y dirección, tope de redenciones totales por campaña y vencimiento a 72 horas. |
| **Sobrecarga de almacenamiento por telemetría masiva** | **Medio** | Agregación diaria en capas Medallón y depuración periódica de eventos crudos antiguos (*data retention policy*). |
| **Sesgos en predicciones de Machine Learning por datos escasos** | **Medio** | Utilizar modelos bayesianos simples con priors artesanales y advertencias explícitas de intervalos de confianza. |
| **Pérdida de identidad visual Liquid Glass al añadir métricas** | **Bajo** | Creación de componentes UI de dashboard modulares construidos sobre el mismo sistema de diseño de la tienda. |

---

## 15. PLAN DE IMPLEMENTACIÓN INCREMENTAL (HOJA DE RUTA EN 6 FASES)

```
   FASE 1              FASE 2              FASE 3              FASE 4              FASE 5              FASE 6
┌───────────┐       ┌───────────┐       ┌───────────┐       ┌───────────┐       ┌───────────┐       ┌───────────┐
│Diagnóstico│       │Videojuego │       │Persistencia│      │Machine    │       │Pipelines  │       │Validación │
│y Marco    ├──────►│BTL y      ├──────►│y Analítica├──────►│Learning & ├──────►│Big Data y ├──────►│Integral y │
│Tipado     │       │Recompensas│       │Comercial  │       │Forecasting│       │Data Marts │       │Auditoría  │
│(ACTUAL)   │       │           │       │           │       │           │       │           │       │           │
└───────────┘       └───────────┘       └───────────┘       └───────────┘       └───────────┘       └───────────┘
```

### Detalle por Fase:

#### **Fase 1 — Preparación Arquitectónica (Completada en esta intervención)**
- **Entregables:** Diagnóstico de dependencias, definición de contratos formales de eventos (`/src/types/analytics.ts`), especificación de arquitectura Medallón y documentación técnica integral.
- **Criterio de Aceptación:** Estabilidad al 100% del proyecto existente, compilación sin errores (`tsc --noEmit`), preservación de la generación de IA y diseño Liquid Glass intacto.

#### **Fase 2 — Sustitución de la Experiencia BTL (Minivideojuego)**
- **Subfase 2A (Completada):** Diseño técnico y jugable del minivideojuego "Las Aventuras de Pompón: El Gran Rescate de los Ovillos". Documento maestro disponible en [`/docs/DISENO_VIDEOJUEGO_BTL.md`](./DISENO_VIDEOJUEGO_BTL.md).
- **Subfase 2B (Futura):** Implementación técnica con Phaser 3, construcción de escenas (`Level1Forest`, `Level2Workshop`, `Level3Castle`), animaciones de Pompón y controles touch.
- **Subfase 2C (Futura):** Conmutación progresiva mediante `VITE_BTL_EXPERIENCE_MODE`, enlace con `CartContext` y retiro seguro de la IA.
- **Criterio de Aceptación:** Juego fluido a 60 FPS en móviles y computadores; emisión de cupones válidos aplicables en el carrito existente.

#### **Fase 3 — Instrumentación, Persistencia y Analítica Comercial**
- **Dependencias:** Base de datos PostgreSQL provisionada.
- **Entregables:** Migración del almacén en memoria a tablas de pedidos y clientes; middleware de ingesta de eventos analíticos; panel inicial con KPIs de venta.
- **Criterio de Aceptación:** Pedidos persistidos entre reinicios de servidor; eventos capturados con latencia inferior a 50 ms.

#### **Fase 4 — Ciencia de Datos y Machine Learning**
- **Dependencias:** Base histórica de pedidos acumulada en Fase 3.
- **Entregables:** Microservicio de inferencia de demanda (SKUs) y segmentación RFM integrado al dashboard administrativo.
- **Criterio de Aceptación:** Modelos con métricas de error documentadas (MAE / RMSE) y advertencias explícitas de certeza.

#### **Fase 5 — Ingeniería de Datos y Capacidades Big Data**
- **Dependencias:** Fase 3 y 4.
- **Entregables:** Pipeline de capas Bronze-Silver-Gold automatizado; generador de datasets sintéticos para validación académica de procesamiento masivo.
- **Criterio de Aceptación:** Procesamiento de 500.000 eventos sintéticos demostrable sin degradación de la tienda operativa.

#### **Fase 6 — Validación Integral y Certificación**
- **Dependencias:** Fases 1 a 5.
- **Entregables:** Auditoría de seguridad (validación de cupones, mitigación de trampas), pruebas de carga y verificación de accesibilidad WCAG 2.2 AA.
- **Criterio de Aceptación:** Plataforma estable, segura, con todas las capacidades comerciales y analíticas operativas y documentadas.
