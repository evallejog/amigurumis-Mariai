# FASE 2A — DISEÑO TÉCNICO Y JUGABLE DEL MINIVIDEOJUEGO BTL DE AMIGURUMIS
## "Las Aventuras de Pompón: El Gran Rescate de los Ovillos"

> **Documento:** Especificación Formal de Diseño Jugable (GDD), Arquitectura Técnica e Integración BTL  
> **Versión:** 2.0.0-implemented  
> **Fecha:** Noviembre 2026  
> **Rol:** Game Designer Senior, HTML5 Game Architect & BTL Gamification Specialist  
> **Estado:** `[FASE 2B: IMPLEMENTADO Y OPERATIVO]` (Juego ejecutable con Phaser 3, 3 niveles, física Arcade, telemetría y controles táctiles/teclado)

---

## 1. VISIÓN GENERAL

### 1.1. Resumen Ejecutivo
El presente documento define la arquitectura técnica, las mecánicas de juego (*gameplay*), la dirección de arte y el modelo de gamificación para **"Las Aventuras de Pompón: El Gran Rescate de los Ovillos"**, un minivideojuego de plataformas en 2D de desplazamiento lateral (*side-scroller*).

Este minivideojuego se convertirá en la principal estrategia de **marketing BTL (*Below The Line*)** de la tienda virtual, reemplazando progresivamente el actual generador de patrones con inteligencia artificial. A través de desafíos de habilidad accesibles, temáticamente integrados con el universo del tejido y el crochet, los usuarios explorarán tres niveles progresivos, obteniendo cupones de descuento y beneficios comerciales aplicables de inmediato en la bolsa de compras.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                            ECOSISTEMA BTL INTEGRADO A LA TIENDA                                  │
│                                                                                                  │
│   ┌─────────────────────┐       ┌───────────────────────┐       ┌────────────────────────────┐   │
│   │   MINIVIDEOJUEGO    │       │    MOTOR BTL SERVER   │       │     CARRITO Y CHECKOUT     │   │
│   │   "Pompón's Wool"   │ ────► │ - Valida niveles      │ ────► │ - Aplica cupón verificado  │   │
│   │ (3 niveles, lana,   │       │ - Emite cupones HMAC  │       │ - Descuentos 5%, 10%, 15%  │   │
│   │  botones, agujas)   │       │ - Registra telemetría │       │ - Cierre de compra real    │   │
│   └─────────────────────┘       └───────────────────────┘       └────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. OBJETIVOS COMERCIALES Y ESTRATEGIA BTL

### 2.1. Objetivos de Negocio
1. **Incremento del Engagement y Tiempo en Sitio:** Aumentar el tiempo promedio de sesión de 1.5 minutos a más de 4 minutos mediante una experiencia lúdica cautivante.
2. **Conversión y Reducción del Costo de Adquisición (CAC):** Convertir visitas casuales en compradores efectivos mediante la recompensa por mérito lúdico ("*Gané este descuento jugando*"), la cual tiene un valor percibido psicológico hasta 3 veces superior a un banner de descuento genérico.
3. **Fidelización y Viralidad Orgánica:** Incentivar que los compradores compartan su récord o su amigurumi desbloqueado en redes sociales (WhatsApp, Instagram).
4. **Alimentación del Pipeline Analítico:** Cada salto, intento, derrota y victoria nutrirá el modelo de eventos diseñado en `/src/types/analytics.ts`, permitiendo segmentar jugadores y predecir propensión a compra.

---

## 3. CONCEPTO NARRATIVO Y UNIVERSO DEL JUEGO

### 3.1. Premisa y Lore Artesanal
En el rincón más acogedor del atelier artesanal, cuando las luces del taller se apagan por la noche, los amigurumis cobran vida. Durante una tormenta de viento que abrió las ventanas del taller, las madejas de hilo premium, los botones tallados y los patrones maestros salieron volando, esparciéndose por tres mundos mágicos conectados por hilados invisibles.

**Pompón**, un pequeño conejito-osito de amigurumi tejido en suave algodón alabastro con bufanda color mostaza, decide emprender el viaje para recuperar los ovillos y materiales perdidos. En su camino deberá sortear alfileres traviesos, tijeras rítmicas y madejas rodantes para restaurar el orden del taller y tejer el *Gran Amigurumi Dorado*.

### 3.2. Originalidad y Propiedad Intelectual
El universo, personajes, banda sonora y assets del juego son **100% originales**:
- **Cero uso de propiedad intelectual de terceros:** No se utilizan elementos, personajes ni sprites inspirados o copiados de franquicias de Nintendo (Mario, Yoshi, Kirby, etc.).
- Toda la imaginería deriva directamente de la artesanía textil real: crochet en espiral, punto bajo, vellón siliconado, arandelas de seguridad, botones de madera y agujas ergonómicas de aluminio.

---

## 4. DIRECCIÓN ARTÍSTICA Y LENGUAJE VISUAL

### 4.1. Estética Textil Hecha a Mano (*Tactile Craft*)
- **Texturas:** Todo elemento visual simula materiales táctiles reales: fieltro cortado a mano, tela de lino, botones de madera con vetas, madejas de lana esponjosa y puntadas en zigzag.
- **Paleta Cromática (Armonizada con la Tienda):**
  - Fondo de lienzo: Crema cálido (`#FAF7F2`) y arena tostada (`#F3ECE1`).
  - Acentos de hilado: Terracota artesanal (`#C87D55`), mostaza cálido (`#D89F68`), salvia nórdico (`#8BA888`) y ciruela pastel (`#8C6A88`).
  - Acentos de alerta: Rojo cereza tejido (`#D9534F`).
- **Capas de Profundidad (Paralaje 2.5D):**
  - *Capa 0 (Fondo lejano):* Papel kraft con bosquejo de patrones y reglas de modista con desenfoque suave.
  - *Capa 1 (Fondo intermedio):* Carretes gigantes de hilo y montañas de vellón blanco.
  - *Capa 2 (Plano de juego):* Plataformas de tela acolchada con costuras de borde reforzadas.
  - *Capa 3 (Primer plano sutil):* Madejas desenrollándose fuera de foco para brindar tridimensionalidad.

### 4.2. Interfaz de Usuario (*HUD Glassmorphism*)
Siguiendo los lineamientos de `/src/index.css` de la tienda:
- Vidas, contador de ovillos y tiempo se presentan en contenedores `liquid-glass` translúcidos flotantes en las esquinas superiores.
- Pantallas de victoria y pausa utilizan la clase `.liquid-glass-elevated` con desenfoque de 32px y sombras cálidas.

---

## 5. DISEÑO DEL PROTAGONISTA: "POMPÓN"

### 5.1. Anatomía Visual
Pompón es un amigurumi estilizado con proporciones tiernas (*chibi*):
- Cuerpo redondeado con textura visible de punto bajo (*single crochet*).
- Orejitas acolchadas que reaccionan a la física del movimiento.
- Bufanda mostaza tejida al viento que acentúa la sensación de velocidad.
- Ojos de arandela de seguridad con brillo plástico sutil y mejillas bordadas en hilo rosa pastel.

```
                 (\__/)
                 (•ㅅ•)  <- Pompón (Textura crochet, ojos de botón)
                 / █ \~  <- Bufanda fluida reactiva a velocidad
                (_____)  <- Patitas cortas acolchadas con squash & stretch
```

### 5.2. Estados y Máquina de Animación (FSM)
| Estado | Duración / Frames | Comportamiento Visual | Trigger |
| :--- | :--- | :--- | :--- |
| **`IDLE`** | 6 frames @ 8 fps | Respiración sutil; el cuerpo se comprime 3% y las orejas oscilan suavemente. | Velocidad horizontal = 0, en suelo. |
| **`RUN`** | 8 frames @ 12 fps | Carrera ágil; las patitas giran en ciclo elíptico, la bufanda ondea horizontalmente. | Input izquierda/derecha $\neq 0$, en suelo. |
| **`JUMP_RISE`** | 3 frames | Estiramiento vertical (*stretch*), orejas hacia abajo por inercia, patitas encogidas. | Impulso de salto activo ($v_y < 0$). |
| **`JUMP_FALL`** | 3 frames | Las orejas se elevan (*air drag*), cuerpo anticipa el impacto de caída. | Caída libre ($v_y > 0$). |
| **`LAND`** | 2 frames | Compresión horizontal momentánea (*squash*) al tocar superficie y nube de pelusa. | Impacto contra suelo desde caída. |
| **`HURT`** | 4 frames + parpadeo | Retroceso hacia atrás (*knockback*), suelta un ovillo pequeño, 1.2s de invulnerabilidad. | Colisión con obstáculo o enemigo. |
| **`VICTORY`** | 8 frames loop | Salto con voltereta en el aire, manos arriba y confeti de hilos de colores. | Cruce de la meta final del nivel. |

---

## 6. MECÁNICAS PRINCIPALES DE PLATAFORMAS

### 6.1. Modelo Físico y Parámetros de Precisión
Para lograr el tacto (*game feel*) característico de los clásicos del género, se ajustan los siguientes parámetros físicos:

- **Gravedad ($g$):** $950\text{ px/s}^2$ (sensación ágil, evita flotabilidad artificial).
- **Velocidad Máxima de Carrera ($v_{x,\text{max}}$):** $240\text{ px/s}$.
- **Aceleración en Suelo ($a_{\text{ground}}$):** $1200\text{ px/s}^2$.
- **Fricción / Desaceleración:** $1400\text{ px/s}^2$ (parada firme sin derrape excesivo).
- **Fuerza de Salto Base ($v_{y,\text{jump}}$):** $-440\text{ px/s}$ (alcanza hasta 3.2 bloques de altura).

### 6.2. Mecánicas Avanzadas de Control (*Platformer Ergonomics*)
1. **Salto Variable por Duración de Pulsación:**  
   Si el jugador suelta el botón de salto mientras asciende, la velocidad vertical se multiplica por $0.45$, permitiendo saltos cortos de precisión (*tap*) o saltos altos (*hold*).
2. **Coyote Time (Tiempo Coyote):**  
   Margen de gracia de **120 ms** tras salir de una plataforma en el que todavía se permite saltar, eliminando la frustración al saltar al borde de cornisas.
3. **Jump Buffering (Almacén de Salto):**  
   Si el usuario presiona saltar hasta **140 ms antes** de tocar el suelo, el salto se ejecutará automáticamente en el frame exacto de aterrizaje.
4. **Cámara de Seguimiento con Deadzone y Lookahead:**  
   La cámara sigue a Pompón con suavizado elástico (`lerp: 0.12`), adelantando la visión 60px en la dirección hacia donde corre el personaje para visibilizar obstáculos anticipadamente.

### 6.3. Coleccionables Textiles
| Ítem | Sprite / Aspecto | Puntos | Efecto Adicional |
| :--- | :--- | :--- | :--- |
| **Ovillo de Algodón** | Pequeña bola de lana colorida con hebra suelta | $+10\text{ pts}$ | Coleccionable base del nivel. |
| **Botón de Madera** | Botón de 4 agujeros con costura en cruz | $+50\text{ pts}$ | Ubicado en rutas secundarias de destreza. |
| **Dedal Dorado** | Dedal brillante de bronce repujado (1 por nivel) | $+200\text{ pts}$ | Obligatorio para obtener las 3 estrellas del nivel. |
| **Arandela de Seguridad** | Corazón tejido de fieltro rojo | $+1\text{ vida}$ | Restaura un punto de vida perdido (máx. 3). |

### 6.4. Obstáculos y Peligros Temáticos
1. **Alfileres con Cabeza de Perla:** Clavados en el suelo o paredes. Estáticos. Quitan 1 corazón y provocan *knockback*.
2. **Tijeras de Costura Mecánicas:** Se abren y cierran con ritmo predecible de 2.0 segundos. Requieren calcular el *timing*.
3. **Pelusas Traviesas (*Dust Bunnies*):** Criaturas hechas de hilo suelto que patrullan plataformas horizontalmente. Pompón puede rebotar sobre ellas para disolverlas en una nube de estambre.
4. **Cintas Métricas Elásticas:** Plataformas que se estiran y balancean verticalmente al subirse en ellas.
5. **Puntadas Deshilachadas:** Bloques de tejido que parpadean y se deshacen 0.8s después de pisarlos, reapareciendo a los 3s.

---

## 7. DISEÑO INICIAL DE NIVELES (LEVEL DESIGN)

```
NIVEL 1: El Bosque de los Ovillos    NIVEL 2: El Taller Encantado       NIVEL 3: El Castillo de las Puntadas
  (Dificultad: Baja | 5% OFF)          (Dificultad: Media | 10% OFF)        (Dificultad: Alta | 15% OFF)
┌──────────────────────────────┐     ┌──────────────────────────────┐     ┌──────────────────────────────┐
│  Tutorial, césped de hilo,   │ ──► │  Cintas métricas móviles,    │ ──► │  Puntadas verticales, viento │
│  alfileres bajos, 15 ovillos │     │  tijeras rítmicas, 25 ovillos│     │  deshilachado, 40 ovillos    │
└──────────────────────────────┘     └──────────────────────────────┘     └──────────────────────────────┘
```

### 7.1. Nivel 1 — "El Bosque de los Ovillos"
- **Entorno:** Sendero soleado entre ramas de agujas de bambú y follaje de crochet verde pastel.
- **Objetivo:** Alcanzar el canasto de costura del final y recolectar al menos 15 ovillos.
- **Curva de Aprendizaje:**
  - Sección A: Espacio plano sin peligros para asimilar movimiento y salto.
  - Sección B: Plataformas elevadas escalonadas para probar el salto variable.
  - Sección C: Primer alfiler visible y una Pelusa Traviesa patrullando.
- **Duración Estimada:** 60 - 90 segundos.
- **Peligros:** 3 alfileres estáticos, 2 pelusas lentas. Sin caídas al vacío (red de lana protectora).
- **Recompensa Propuesta:** Cupón **5% de Descuento** en la tienda.

### 7.2. Nivel 2 — "El Taller Encantado"
- **Entorno:** Mesa de confección iluminada por lámparas cálidas, carretes gigantescos de hilo y tizas de sastre.
- **Objetivo:** Atravesar la zona de corte sorteando obstáculos móviles hasta la Caja Musical.
- **Mecánicas Introducidas:** Cintas métricas móviles y plataformas de puntadas que se deshilachan.
- **Duración Estimada:** 90 - 140 segundos.
- **Peligros:** Tijeras mecánicas de ritmo alternado, pozos vacíos con respawn en checkpoint intermedio.
- **Recompensa Propuesta:** Cupón **10% de Descuento** en la tienda.

### 7.3. Nivel 3 — "El Castillo de las Puntadas"
- **Entorno:** Gran fortaleza vertical construida con cajas de mimbre, torres de ovillos dorados y estandartes tejidos.
- **Objetivo:** Ascender hasta la torre del reloj y desenrollar el Gran Nudo Dorado.
- **Mecánicas Combinadas:** Plataformas deshilachadas, viento suave que modifica el arrastre aéreo, y secuencias de salto preciso con Coyote Time.
- **Duración Estimada:** 140 - 200 segundos.
- **Desafío Final:** "El Gran Alfiletero": patrón de plataformas en movimiento circular donde Pompón debe saltar sobre 3 interruptores de botón para desbloquear el trofeo.
- **Recompensa Propuesta:** Cupón **15% de Descuento** (con monto mínimo de compra configurable).

---

## 8. SISTEMA DE PUNTUACIÓN Y CALIFICACIÓN DE 3 ESTRELLAS

### 8.1. Fórmula de Puntuación
$$\text{Score} = (\text{Ovillos} \times 10) + (\text{Botones} \times 50) + (\text{Dedal Dorado} \times 200) + (\text{Vidas Restantes} \times 100) + \max(0, [T_{\text{max}} - T_{\text{real}}] \times 2)$$

### 8.2. Calificación por Estrellas
- ★☆☆ (1 Estrella): Superar el nivel alcanzando la meta.
- ★★☆ (2 Estrellas): Superar el nivel recolectando al menos el 80% de los ovillos sin agotar vidas.
- ★★★ (3 Estrellas): 100% de ovillos + Dedal Dorado encontrado + tiempo óptimo. Desbloquea la insignia de *"Maestro Tejedor"*.

---

## 9. SISTEMA DE RECOMPENSAS BTL Y SEGURIDAD CRIPTOGRÁFICA

### 9.1. Matriz Preliminar de Recompensas
| Nivel Superado | Recompensa BTL | Cupón de Ejemplo | Restricciones / Reglas |
| :--- | :--- | :--- | :--- |
| **Nivel 1** | **5% OFF** en cualquier amigurumi | `BOSQUE-LANA-5` | 1 uso por cliente. Válido por 72 horas. |
| **Nivel 2** | **10% OFF** en catálogo completo | `TALLER-MAGICO-10` | 1 uso por cliente. Válido por 72 horas. Subtotal mín. $15.000 ARS. |
| **Nivel 3** | **15% OFF** o **Envío Bonificado** | `CASTILLO-MAESTRO-15`| 1 uso por cliente. Válido por 5 días. Subtotal mín. $25.000 ARS. |

### 9.2. Arquitectura de Emisión Segura y Prevención de Trampas
> **Aclaración de Seguridad Realista:**  
> Ningún juego HTML5 ejecutado en el navegador puede considerarse 100% inmune a manipulaciones si el cliente es manipulado con herramientas de depuración (*DevTools/Memory tampering*). Sin embargo, la seguridad no reside en hacer el cliente infalible, sino en **retirar la autoridad comercial del cliente** mediante verificación server-authoritative y limitación económica de riesgo.

```
┌───────────────────────────────────────┐             ┌──────────────────────────────────────────────┐
│           CLIENTE PHASER 2D           │             │            SERVIDOR CONFIABLE EXPRESS        │
│                                       │  1. Inicia  │                                              │
│  - Inicia nivel                       ├────────────►│  - Genera game_session_id con timestamp      │
│  - Captura inputs, checkpoints y ticks│             │  - Asigna nonce criptográfico                │
│                                       │  2. Envía   │                                              │
│  - Finaliza nivel                     ├────────────►│  - Audita plausibilidad (tiempo mín, saltos) │
│  - Muestra animación victoria         │   Reporte   │  - Valida que session_id no haya sido usada  │
│                                       │             │  - Firma cupón con HMAC(secret, payload)     │
│  - Recibe cupón verificado            │◄────────────┤  - Registra evento 'coupon_issued'           │
│  - Botón: "Aplicar a mi Bolsa"        │  3. Cupón   │                                              │
└───────────────────────────────────────┘             └──────────────────────────────────────────────┘
```

1. **Protocolo de Validación:**
   - Al iniciar nivel, el cliente invoca `POST /api/btl/session/start` y recibe un token firmado con timestamp.
   - Al completar el nivel, envía `POST /api/btl/level/complete` con el tiempo transcurrido, número de saltos, coleccionables y hash de ruta.
   - Si el tiempo de superación es inferior al mínimo físicamente posible ($T_{\text{mín}} = 45\text{s}$ para Nivel 1), la solicitud es rechazada por heurística anti-speedhack.
2. **Emisión de Cupones No Rejugables:** Cada código generado es único, vinculado a una sesión y marcado como no reutilizable en la base de datos al momento del checkout.
3. **Límites de Emisión por IP/Dispositivo:** Máximo 3 cupones emitidos por dirección o fingerprint por semana para frenar scripts automatizados.

---

## 10. CONTROLES Y ADAPTABILIDAD RESPONSIVE

### 10.1. Mapeo en Computadoras de Escritorio (Desktop)
- **Mover Izquierda:** Flecha Izquierda `[←]` o Tecla `[A]`.
- **Mover Derecha:** Flecha Derecha `[→]` o Tecla `[D]`.
- **Saltar:** Barra Espaciadora `[Space]`, Flecha Arriba `[↑]` o Tecla `[W]`.
- **Pausa:** Tecla `[Escape]` o `[P]`.
- **Silenciar Audio:** Tecla `[M]`.

### 10.2. Mapeo en Dispositivos Móviles y Tablets (Touch HUD)
El HUD táctil se monta en una capa superior transparente adaptada al ancho de pantalla:
- **Zona Inferior Izquierda:** Botones virtuales gemelos `[ ◄ ]` y `[ ► ]` o joystick virtual flotante con feedback háptico sutil (Vibration API).
- **Zona Inferior Derecha:** Botón grande y redondeado `[ SALTO ]` con diseño de botón de madera.
- **Zona Superior Derecha:** Botón `[ ❚❚ Pausa ]` estilo Liquid Glass.
- **Escalado Responsivo:** Configuración `Phaser.Scale.FIT` con resolución base de $960 \times 540\text{ px}$ (relación 16:9), adaptándose automáticamente sin deformación en teléfonos verticales u horizontales (modo *landscape* sugerido).

---

## 11. ACCESIBILIDAD UNIVERSAL (WCAG 2.2 AA)

Para asegurar que todos los usuarios disfruten de la experiencia y accedan a los beneficios comerciales:
1. **Modo Asistido ("Paseo en el Taller"):** Opción en el menú de pausa que otorga vidas infinitas y elimina el daño de caídas, permitiendo a personas con dificultades motrices completar los niveles a su propio ritmo y obtener las recompensas.
2. **Alternativa Inclusiva no Motriz (Trivia Artesanal):** Para usuarios con ceguera o severa limitación motriz que utilicen lectores de pantalla, se habilita una alternativa accesible basada en preguntas sobre el cuidado de amigurumis para desbloquear el cupón equivalente.
3. **Modo Alto Contraste:** Delineado negro grueso alrededor de plataformas y coleccionables para personas con baja agudeza visual.
4. **Reducción de Movimiento (*prefers-reduced-motion*):** Desactiva el paralaje multicapa de fondo, temblores de cámara (*screen shake*) y partículas de confeti.
5. **Control de Sonido Independiente:** Deslizadores separados para música ambiental y efectos sonoros de salto/recolección.

---

## 12. EVALUACIÓN TECNOLÓGICA: PHASER 3 VS. CANVAS 2D NATIVO

| Criterio de Selección | Phaser 3.87+ (Arcade Physics) | Implementación Canvas 2D Nativa | Dictamen de Arquitectura |
| :--- | :--- | :--- | :--- |
| **Integración con React 19** | Mediante wrapper `useRef` y hook de ciclo de vida. Requiere destruir explícitamente la instancia `game.destroy(true)`. | Control total directo con `requestAnimationFrame` en `useEffect`. | **Empate técnico.** Ambas son viables; Phaser requiere mayor disciplina en el desmontaje. |
| **Compatibilidad TypeScript** | Definiciones oficiales completas (`@types/phaser` o bundle TS nativo). | Totalmente tipado a medida. | **Phaser gana en robustez de tipos.** |
| **Física de Plataformas** | Motor *Arcade Physics* maduro con colisiones AABB, gravedad, rebotes y pendientes resueltos. | Requiere codificar a mano cálculo de gravedad, colisiones SAT/AABB y resolución de penetración. | **Phaser gana rotundamente.** Desarrollar física de plataformas confiable desde cero consume cientos de horas. |
| **Gestión de Escenas y Assets**| Sistema nativo de Preload, Boot, MainMenu, GameScene y GameOver. Manejo automático de caché WebGL. | Requiere construir un gestor de imágenes, spritesheets y audio artesanal. | **Phaser gana por productividad y estándares de industria.** |
| **Impacto en Bundle Size** | ~900 KB minificado (se reduce a ~280 KB con Gzip/Brotli). | < 50 KB de código propio. | **Canvas nativo es más liviano.** |
| **Rendimiento Móvil (FPS)** | Aceleración por hardware WebGL con fallback automático a Canvas 2D. 60 FPS estables. | Renderizado por software Canvas 2D; puede tener tirones de frame (*jank*) en dispositivos modestos. | **Phaser gana en fluidez visual sostenida.** |

### Recomendación Técnica Definitiva
**Se recomienda adoptar Phaser 3 (con Arcade Physics) en la Fase 2B.**  
La solidez de su motor de física, la gestión integrada de animaciones por spritesheet, el soporte de audio multicanal y el escalado responsive ahorran riesgos severos de bugs y permiten concentrar el esfuerzo de desarrollo en el arte, los niveles y la integración con la tienda. El tamaño del bundle se gestiona eficientemente cargando Phaser mediante **Dynamic Import (`React.lazy`)** solo cuando el usuario accede a la sección de juego.

---

## 13. ARQUITECTURA MODULAR DEL MINIVIDEOJUEGO

Estructura modular propuesta para el código en la futura Fase 2B (sin crear carpetas vacías en esta fase):

```
/src/game/
├── config/
│   ├── gameConfig.ts           # Configuración Phaser (resolución, física, scale mode)
│   └── levelRegistry.ts        # Metadatos, objetivos y recompensas de cada nivel
├── scenes/
│   ├── BootScene.ts            # Carga inicial ultra liviana de barra de progreso
│   ├── PreloadScene.ts         # Carga de spritesheets, texturas y audios
│   ├── MainMenuScene.ts        # Menú principal con estética Liquid Glass
│   ├── LevelScene.ts           # Escena base jugable heredable
│   ├── levels/
│   │   ├── Level1Forest.ts     # Construcción Nivel 1: El Bosque de los Ovillos
│   │   ├── Level2Workshop.ts   # Construcción Nivel 2: El Taller Encantado
│   │   └── Level3Castle.ts     # Construcción Nivel 3: El Castillo de las Puntadas
│   ├── PauseScene.ts           # Menú modal de pausa y opciones de accesibilidad
│   └── VictoryModalScene.ts    # Despliegue del cupón obtenido y puente a tienda
├── entities/
│   ├── PomponPlayer.ts         # Sprite con FSM de animaciones y física de Pompón
│   ├── collectibles/           # YarnBall, ButtonItem, GoldenThimble
│   └── obstacles/              # PinHazard, ScissorHazard, DustBunnyEnemy
├── systems/
│   ├── InputManager.ts         # Unificación teclado + controles touch virtuales
│   ├── AudioManager.ts         # Orquestación de efectos de lana y música lofi textil
│   └── RewardBridge.ts         # Comunicación cifrada con API Express y CartContext
└── ReactGameContainer.tsx      # Componente React que monta y desmonta Phaser limpiamente
```

---

## 14. INTEGRACIÓN CON REACT Y LA TIENDA VIRTUAL

### 14.1. Ciclo de Vida y Limpieza de Recursos (Prevención de Memory Leaks)
Uno de los riesgos clásicos al integrar Phaser en React es la fuga de memoria al cambiar de ruta. El contenedor React se vinculará siguiendo este patrón en la Fase 2B:

```tsx
// Esquema del patrón de montaje propuesto para Fase 2B:
useEffect(() => {
  const game = new Phaser.Game(gameConfig);
  // Al desmontar el componente React:
  return () => {
    game.destroy(true); // Destruye el canvas WebGL, limpia texturas y eventos de ventana
  };
}, []);
```

### 14.2. Puente React-Juego (*Bridge Event Emitter*)
Un bus de eventos desacoplado (`EventBus`) permitirá:
- Al juego: Notificar a React cuando se desbloquea un cupón para que la bolsa de compras (`CartDrawer`) lo aplique automáticamente.
- A React: Enviar al juego los datos del usuario o pausar el juego si se abre el carrito de compras.

---

## 15. PERSISTENCIA Y REQUISITOS DE BASE DE DATOS

Para evitar que los récords y cupones se pierdan al reiniciar el servidor, la arquitectura requerirá en la Fase 3 la persistencia mínima en base de datos (PostgreSQL):
1. **Tabla `game_sessions`:** Registro de `id`, `user_id_hash`, `level_reached`, `score`, `duration_seconds`.
2. **Tabla `issued_coupons`:** Código, porcentaje, fecha de expiración, sesión de juego asociada y estado (`is_redeemed`, `order_id`).
3. **Tabla `player_checkpoints`:** Permite al jugador retomar desde el Nivel 2 o 3 en futuras visitas sin repetir todo desde cero.

---

## 16. CONTRATOS DE EVENTOS Y TELEMETRÍA (MAPEO CON ANALYTICS.TS)

Las acciones del jugador se mapearán punto a punto con `/src/types/analytics.ts`:
- `game_started` $\rightarrow$ Registra `game_session_id`, hora de inicio y dispositivo.
- `level_started` $\rightarrow$ Nivel seleccionado (1, 2 o 3) y vidas iniciales.
- `level_completed` $\rightarrow$ Tiempo de completado, score, ovillos recolectados.
- `level_failed` $\rightarrow$ Causa de derrota (caída, alfiler, tiempo), para detectar picos de frustración en el diseño del nivel.
- `reward_earned` $\rightarrow$ Recompensa desbloqueada.
- `coupon_issued` $\rightarrow$ Código emitido por el servidor.
- `coupon_redeemed` $\rightarrow$ Compra completada en checkout utilizando el cupón del juego.

---

## 17. ESTRATEGIA DE TRANSICIÓN Y CONMUTACIÓN DE LA IA

### 17.1. Conmutador por Variable de Entorno (`Feature Flag`)
En `/src/App.tsx`, la sección `#personalizar` se gobernará mediante:

```typescript
const btlMode = import.meta.env.VITE_BTL_EXPERIENCE_MODE || 'ai_generator';

// Opciones contempladas:
// 'ai_generator': Muestra el actual generador de patrones con IA (ACTIVO HOY)
// 'both_tabbed': Muestra pestañas "Juego Amigurumi" y "Generador IA" (FASE DE PRUEBAS)
// 'minigame': Muestra exclusivamente el minivideojuego BTL (PRODUCCIÓN DEFINITIVA)
```

### 17.2. Garantía de Invarianza
Durante la presente Fase 2A, `VITE_BTL_EXPERIENCE_MODE` se mantiene por defecto en la experiencia de IA. Ni un solo archivo del flujo comercial (catálogo, carrito, checkout, órdenes) ha sido alterado.

---

## 18. MATRIZ DE RIESGOS TÉCNICOS Y MEDIDAS PREVENTIVAS

| Riesgo Identificado | Severidad | Probabilidad | Medida Preventiva Diseñada |
| :--- | :--- | :--- | :--- |
| **Fuga de memoria WebGL al desmontar Phaser en React** | Alta | Media | Invocar estrictamente `game.destroy(true)` y desvincular listeners de resize en el cleanup de `useEffect`. |
| **Tiempo de carga inicial del juego en redes móviles lentas** | Media | Alta | Cargar Phaser dinámicamente (`React.lazy`) y comprimir spritesheets en formato WebP con resolución balanceada. |
| **Trampas en el cliente para reclamar cupones sin jugar** | Alta | Alta | Validación server-authoritative con verificación de tiempos mínimos, firmas HMAC y límite de redención por IP. |
| **Frustración en jugadores no experimentados** | Media | Media | Implementar el "Modo Asistido" (vidas infinitas) y checkpoints generosos en todos los niveles. |

---

## 19. PLAN DE IMPLEMENTACIÓN SECUENCIAL (HOJA DE RUTA FASE 2)

```
┌─────────────────────────────────┐
│   FASE 2A: DISEÑO TÉCNICO       │ ◄── [COMPLETADA EN ESTA ENTREGA]
│   - GDD completo y arquitectura │
└────────────────┬────────────────┘
                 ▼
┌─────────────────────────────────┐
│   FASE 2B: IMPLEMENTACIÓN JUEGO │
│   - Instalación de Phaser 3     │
│   - Creación de escenas y Pompón│
│   - 3 niveles y controles touch │
└────────────────┬────────────────┘
                 ▼
┌─────────────────────────────────┐
│   FASE 2C: TRANSICIÓN BTL       │
│   - Conmutación con Feature Flag│
│   - Enlace directo a CartDrawer │
│   - Desmantelamiento de IA      │
└─────────────────────────────────┘
```

---

## 20. CRITERIOS DE ACEPTACIÓN FORMALES PARA LA FASE 2B

Para dar por aprobada la futura implementación de la Fase 2B, deberán cumplirse los siguientes criterios verificables:
1. **Rendimiento:** 60 FPS estables en navegadores de escritorio (Chrome, Safari, Firefox) y al menos 50 FPS en dispositivos móviles gama media.
2. **Jugabilidad Completa:** Pompón responde fluidamente a movimientos, salto variable y coyote time en los 3 niveles proyectados.
3. **Flujo de Recompensas:** Al completar el Nivel 1, el servidor genera un cupón del 5% que puede aplicarse automáticamente a la bolsa de compras existente, recalculando el total en el checkout.
4. **Cero Regresiones:** El catálogo de amigurumis, los filtros, las fotos en alta resolución, el checkout y la persistencia del carrito continúan funcionando al 100%.
5. **Aislamiento de Memoria:** Montar y desmontar 10 veces seguidas el componente del juego navegando entre secciones no provoca acumulación de memoria en el navegador ni cuelga el dev server.
