import Phaser from 'phaser';
import { generateGameTextures } from '../textures';
import { GameTelemetryPayload } from '../types';
import { LEVEL_SCISSORS, LEVEL_WOOL } from '../levelLayout';

export interface LevelSceneData {
  levelNumber: 1 | 2 | 3;
  onTelemetryUpdate?: (payload: GameTelemetryPayload) => void;
  onVictory?: (payload: GameTelemetryPayload) => void;
  onGameOver?: (payload: GameTelemetryPayload) => void;
  onPauseToggle?: () => void;
}

export class LevelScene extends Phaser.Scene {
  private levelNumber: 1 | 2 | 3 = 1;
  private player!: Phaser.Physics.Arcade.Sprite;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private movingPlatforms!: Phaser.Physics.Arcade.Group;
  private woolBalls!: Phaser.Physics.Arcade.Group;
  private buttonsBonus!: Phaser.Physics.Arcade.Group;
  private hazardPins!: Phaser.Physics.Arcade.StaticGroup;
  private hazardScissors!: Phaser.Physics.Arcade.Group;
  private dustBunnies!: Phaser.Physics.Arcade.Group;
  private goalBasket!: Phaser.Physics.Arcade.Sprite;

  // Unified Input System
  // Keyboard keys
  private keysWASD!: {
    up: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    space: Phaser.Input.Keyboard.Key;
  };
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  // Window-level fallback listener to guarantee capturing W, Space, Up even without canvas focus
  private windowKeyDownHandler?: (e: KeyboardEvent) => void;
  private windowKeyUpHandler?: (e: KeyboardEvent) => void;
  private keysHeldState = {
    left: false,
    right: false,
    jump: false,
  };

  // Virtual touch control state from React HUD
  public touchLeft = false;
  public touchRight = false;
  public touchJump = false;

  // Jump tracking
  private jumpBufferedTime = 0;
  private lastGroundedTime = 0;
  private isJumping = false;
  private canDoubleJump = true;
  private jumpWasPressedLastFrame = false;
  private isGamePaused = false;
  private isInvulnerable = false;
  private checkpointX = 100;
  private checkpointY = 400;

  // Scoring & Stats
  private score = 0;
  private woolCollected = 0;
  private targetWool = 15;
  private lives = 3;
  private startTime = 0;
  private levelComplete = false;

  // Callbacks
  private onTelemetryUpdate?: (payload: GameTelemetryPayload) => void;
  private onVictory?: (payload: GameTelemetryPayload) => void;
  private onGameOver?: (payload: GameTelemetryPayload) => void;
  private onPauseToggle?: () => void;

  // Web Audio synth for instant tactile SFX
  private audioCtx: AudioContext | null = null;

  constructor() {
    super({ key: 'LevelScene' });
  }

  init(data: LevelSceneData) {
    this.levelNumber = data.levelNumber || 1;
    this.onTelemetryUpdate = data.onTelemetryUpdate;
    this.onVictory = data.onVictory;
    this.onGameOver = data.onGameOver;
    this.onPauseToggle = data.onPauseToggle;
    this.score = 0;
    this.woolCollected = 0;
    this.lives = 3;
    this.levelComplete = false;
    this.isInvulnerable = false;
    this.isJumping = false;
    this.canDoubleJump = true;
    this.jumpWasPressedLastFrame = false;
    this.isGamePaused = false;
    this.lastGroundedTime = 0;
    this.jumpBufferedTime = 0;
    this.targetWool = this.levelNumber === 1 ? 12 : this.levelNumber === 2 ? 16 : 22;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    } catch {
      this.audioCtx = null;
    }
  }

  create() {
    generateGameTextures(this);

    const worldWidth = this.levelNumber === 1 ? 2000 : this.levelNumber === 2 ? 2600 : 3200;
    const worldHeight = 540;

    this.physics.world.setBounds(0, 0, worldWidth, worldHeight + 100);
    this.startTime = this.time.now;

    // Escenario decorativo cálido sin franjas blancas
    this.createBackground(worldWidth, worldHeight);

    // Grupos de colisión
    this.platforms = this.physics.add.staticGroup();
    this.movingPlatforms = this.physics.add.group({ allowGravity: false, immovable: true });
    this.woolBalls = this.physics.add.group({ allowGravity: false, immovable: true });
    this.buttonsBonus = this.physics.add.group({ allowGravity: false, immovable: true });
    this.hazardPins = this.physics.add.staticGroup();
    this.hazardScissors = this.physics.add.group({ allowGravity: false, immovable: true });
    this.dustBunnies = this.physics.add.group();

    // Construir nivel según dificultad
    this.buildLevel(this.levelNumber, worldWidth);

    // Crear a Pompón (protagonista)
    this.player = this.physics.add.sprite(this.checkpointX, this.checkpointY, 'pompon');
    this.player.setCollideWorldBounds(false);
    // CRÍTICO: Bounce en 0 para evitar que micro-rebotes anulen el estado en suelo
    this.player.setBounce(0);
    this.player.setGravityY(820);
    this.player.body!.setSize(34, 42);
    this.player.body!.setOffset(9, 12);

    // Colisiones
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.player, this.movingPlatforms);
    this.physics.add.collider(this.dustBunnies, this.platforms);

    // Overlaps de coleccionables
    this.physics.add.overlap(this.player, this.woolBalls, this.handleCollectWool as any, undefined, this);
    this.physics.add.overlap(this.player, this.buttonsBonus, this.handleCollectButton as any, undefined, this);

    // Overlaps de peligros
    this.physics.add.overlap(this.player, this.hazardPins, this.handleHitHazard as any, undefined, this);
    this.physics.add.overlap(this.player, this.hazardScissors, this.handleHitHazard as any, undefined, this);
    this.physics.add.overlap(this.player, this.dustBunnies, this.handleDustBunnyCollision as any, undefined, this);

    // Overlap de meta
    this.physics.add.overlap(this.player, this.goalBasket, this.handleReachGoal as any, undefined, this);

    // Cámara con seguimiento suave y lookahead
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1, -60, 20);
    this.cameras.main.setBackgroundColor('#FAF7F2');

    // Configurar teclado nativo de Phaser
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keysWASD = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      space: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
    };

    // Prevenir que las teclas de juego desplacen accidentalmente la página web
    this.input.keyboard?.addCapture([
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
    ]);

    // Listener global en ventana para garantizar captura sin depender de foco en canvas
    this.setupWindowKeyListeners();

    this.dispatchTelemetry();
  }

  private setupWindowKeyListeners() {
    this.windowKeyDownHandler = (e: KeyboardEvent) => {
      const code = e.code;
      const key = e.key?.toLowerCase();

      // Tecla de pausa/reanudar global
      if (code === 'KeyP' || key === 'p' || code === 'Escape') {
        if (!this.levelComplete && this.onPauseToggle) {
          e.preventDefault();
          this.onPauseToggle();
          return;
        }
      }

      // Si el juego está en pausa o terminado, no procesar movimiento
      if (this.levelComplete || this.isGamePaused) return;

      if (code === 'Space' || code === 'ArrowUp' || key === 'w' || key === 'arrowup') {
        // Prevenir scroll en la página al saltar
        e.preventDefault();
        this.keysHeldState.jump = true;
        // Registrar intento de salto para buffering
        this.jumpBufferedTime = this.time.now;
      }

      if (code === 'KeyA' || code === 'ArrowLeft' || key === 'a' || key === 'arrowleft') {
        this.keysHeldState.left = true;
      }

      if (code === 'KeyD' || code === 'ArrowRight' || key === 'd' || key === 'arrowright') {
        this.keysHeldState.right = true;
      }
    };

    this.windowKeyUpHandler = (e: KeyboardEvent) => {
      const code = e.code;
      const key = e.key?.toLowerCase();

      if (code === 'Space' || code === 'ArrowUp' || key === 'w' || key === 'arrowup') {
        this.keysHeldState.jump = false;
      }

      if (code === 'KeyA' || code === 'ArrowLeft' || key === 'a' || key === 'arrowleft') {
        this.keysHeldState.left = false;
      }

      if (code === 'KeyD' || code === 'ArrowRight' || key === 'd' || key === 'arrowright') {
        this.keysHeldState.right = false;
      }
    };

    window.addEventListener('keydown', this.windowKeyDownHandler);
    window.addEventListener('keyup', this.windowKeyUpHandler);

    this.events.once('shutdown', () => {
      if (this.windowKeyDownHandler) window.removeEventListener('keydown', this.windowKeyDownHandler);
      if (this.windowKeyUpHandler) window.removeEventListener('keyup', this.windowKeyUpHandler);
    });
  }

  // Método público invocado desde los botones táctiles de React para activar/desactivar salto
  public setVirtualJump(isDown: boolean) {
    this.touchJump = isDown;
    if (isDown) {
      this.jumpBufferedTime = this.time.now;
    }
  }

  update(time: number, delta: number) {
    if (this.isGamePaused || this.levelComplete || !this.player || !this.player.body) return;

    // Contacto sólido con el suelo (static bodies o moving platforms)
    const onFloor = this.player.body.blocked.down || this.player.body.touching.down;

    if (onFloor) {
      this.lastGroundedTime = time;
      this.isJumping = false;
      this.canDoubleJump = true;
    }

    // Input horizontal unificado (teclado Phaser + window listener + touch virtual)
    const leftPressed =
      this.cursors.left.isDown ||
      this.keysWASD.left.isDown ||
      this.keysHeldState.left ||
      this.touchLeft;

    const rightPressed =
      this.cursors.right.isDown ||
      this.keysWASD.right.isDown ||
      this.keysHeldState.right ||
      this.touchRight;

    // Input de salto continuo (para saber si se mantiene presionado)
    const jumpHeld =
      this.cursors.up.isDown ||
      this.keysWASD.up.isDown ||
      this.keysWASD.space.isDown ||
      this.keysHeldState.jump ||
      this.touchJump;

    // Detectar pulsación individual limpia (keydown inicial)
    const jumpJustPressed = jumpHeld && !this.jumpWasPressedLastFrame;
    this.jumpWasPressedLastFrame = jumpHeld;

    if (jumpJustPressed) {
      this.jumpBufferedTime = time;
    }

    // Movimiento horizontal
    const runSpeed = 230;
    if (leftPressed) {
      this.player.setVelocityX(-runSpeed);
      this.player.setFlipX(true);
    } else if (rightPressed) {
      this.player.setVelocityX(runSpeed);
      this.player.setFlipX(false);
    } else {
      this.player.setVelocityX(0);
    }

    // 1. Salto desde el suelo con Coyote Time (150ms) y Jump Buffering (180ms)
    const canJumpWithCoyote = time - this.lastGroundedTime < 150;
    const hasBufferedJump = time - this.jumpBufferedTime < 180;

    if (hasBufferedJump && canJumpWithCoyote && !this.isJumping) {
      // Salto inicial con impulso enérgico para alcanzar plataformas
      this.player.setVelocityY(-480);
      this.jumpBufferedTime = 0;
      this.lastGroundedTime = 0;
      this.isJumping = true;
      this.playSynthSound(440, 0.09, 'triangle');
    }
    // 2. DOBLE SALTO en el aire: Al presionar salto nuevamente sin tocar suelo
    else if (jumpJustPressed && !onFloor && this.canDoubleJump) {
      this.player.setVelocityY(-450);
      this.canDoubleJump = false;
      this.jumpBufferedTime = 0;
      this.createDoubleJumpPuff(this.player.x, this.player.y + 16);
      this.playDoubleJumpSound();
    }

    // 3. Salto largo y variable:
    // Si mantiene presionado y sigue subiendo, otorga un sostenido suave contra la gravedad
    if (jumpHeld && this.player.body.velocity.y < -80) {
      this.player.setVelocityY(this.player.body.velocity.y - 3.5);
    }
    // Si suelta el botón antes de la cúspide, reduce la inercia para salto corto
    if (!jumpHeld && this.player.body.velocity.y < -100) {
      this.player.setVelocityY(this.player.body.velocity.y * 0.65);
    }

    // Caída al vacío (respawn en checkpoint)
    if (this.player.y > 540) {
      this.handleFallOut();
    }

    // Patrulla de pelusas enemigas
    this.dustBunnies.getChildren().forEach((enemyObj) => {
      const enemy = enemyObj as Phaser.Physics.Arcade.Sprite;
      if (enemy.body) {
        if (enemy.body.blocked.left || enemy.x < enemy.getData('minX')) {
          enemy.setVelocityX(60);
        } else if (enemy.body.blocked.right || enemy.x > enemy.getData('maxX')) {
          enemy.setVelocityX(-60);
        }
      }
    });

    // Movimiento de plataformas de cinta métrica y arrastre físico de Pompón
    this.movingPlatforms.getChildren().forEach((platObj) => {
      const plat = platObj as Phaser.Physics.Arcade.Sprite;
      const startX = plat.getData('startX');
      const distance = plat.getData('distance') || 100;
      const speed = plat.getData('speed') || 60;
      let direction = plat.getData('direction') || 1;

      const prevPlatX = plat.x;
      plat.x += speed * (delta / 1000) * direction;

      if (plat.x >= startX + distance) {
        plat.x = startX + distance;
        direction = -1;
        plat.setData('direction', -1);
      } else if (plat.x <= startX) {
        plat.x = startX;
        direction = 1;
        plat.setData('direction', 1);
      }

      const deltaX = plat.x - prevPlatX;

      // Arrastre físico de Pompón cuando está montado en la plataforma móvil
      if (this.player && this.player.body && !this.levelComplete && !this.isGamePaused) {
        const playerBody = this.player.body;
        const platBody = plat.body as Phaser.Physics.Arcade.Body;

        // Verificar si los pies de Pompón descansan sobre la plataforma
        const playerBottom = playerBody.bottom;
        const platTop = platBody.top;
        const isFeetOnTop = Math.abs(playerBottom - platTop) <= 6 || (playerBody.touching.down && platBody.touching.up);
        const isHorizontallyOverlapping = playerBody.right >= platBody.left + 2 && playerBody.left <= platBody.right - 2;

        if (isFeetOnTop && isHorizontallyOverlapping) {
          // Transferir de manera suave y síncrona el desplazamiento horizontal a Pompón
          this.player.x += deltaX;
        }
      }
    });
  }

  // Creación del escenario decorativo de fondo temático por nivel
  private createBackground(width: number, height: number) {
    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const distantScroll = prefersReducedMotion ? 1 : 0.18;
    const midScroll = prefersReducedMotion ? 1 : 0.38;

    // Capa 1: Cielo y gradiente de ambiente base (fijo al viewport)
    const baseSky = this.add.graphics();
    baseSky.setScrollFactor(0);

    if (this.levelNumber === 1) {
      // NIVEL 1: El Bosque de los Ovillos (Verdes salvia suaves, colinas de vellón y flores de botón)
      baseSky.fillGradientStyle(0xEBF4EF, 0xEBF4EF, 0xDDECE3, 0xD4E6DC, 1);
      baseSky.fillRect(0, 0, 960, height);

      // Colinas de lana y vellón lejanas (Parallax distant)
      const distantHills = this.add.graphics();
      distantHills.setScrollFactor(distantScroll, 1);
      distantHills.fillStyle(0xCFE2D6, 0.7);
      for (let x = -100; x < width + 300; x += 360) {
        distantHills.beginPath();
        distantHills.arc(x + 180, 480, 240, Math.PI, 0);
        distantHills.fill();
      }

      // Nubes de algodón flotante (Parallax distant)
      distantHills.fillStyle(0xFFFFFF, 0.75);
      [180, 650, 1150, 1600, 2100].forEach((cx, idx) => {
        const cy = 60 + (idx % 3) * 25;
        distantHills.fillCircle(cx, cy, 26);
        distantHills.fillCircle(cx + 28, cy - 8, 34);
        distantHills.fillCircle(cx + 60, cy, 28);
        distantHills.fillCircle(cx + 30, cy + 10, 24);
      });

      // Capa media: Árboles de fieltro con bordado de hojas en cruz y flores de botón (Parallax mid)
      const midForest = this.add.graphics();
      midForest.setScrollFactor(midScroll, 1);

      for (let x = 80; x < width; x += 220) {
        const treeBaseY = 460;
        const trunkH = 110 + (x % 3) * 20;

        // Tronco bordado marrón cálido
        midForest.fillStyle(0x8D6E63, 0.85);
        midForest.fillRect(x - 5, treeBaseY - trunkH, 10, trunkH);

        // Corona de árbol de fieltro verde salvia
        const crownColor = x % 2 === 0 ? 0x7E9C77 : 0x6E8C67;
        midForest.fillStyle(crownColor, 0.9);
        midForest.fillCircle(x, treeBaseY - trunkH - 24, 34);
        midForest.fillCircle(x - 18, treeBaseY - trunkH - 12, 24);
        midForest.fillCircle(x + 18, treeBaseY - trunkH - 12, 24);

        // Bordado de puntadas de hoja en cruz en el follaje
        midForest.lineStyle(1.5, 0xE8F0E8, 0.6);
        midForest.strokeLineShape(new Phaser.Geom.Line(x - 8, treeBaseY - trunkH - 24, x + 8, treeBaseY - trunkH - 24));
        midForest.strokeLineShape(new Phaser.Geom.Line(x, treeBaseY - trunkH - 32, x, treeBaseY - trunkH - 16));

        // Flores de botón en la base
        midForest.fillStyle(0xE09F5E, 0.85);
        midForest.fillCircle(x + 28, treeBaseY - 10, 6);
        midForest.fillStyle(0x5C3810, 0.9);
        midForest.fillCircle(x + 28, treeBaseY - 10, 1.5);
      }

    } else if (this.levelNumber === 2) {
      // NIVEL 2: El Taller Encantado (Repisas de madera, madejas de colores y carretes gigantes)
      baseSky.fillGradientStyle(0xFAF5EE, 0xFAF5EE, 0xF5EBE1, 0xEDE0CE, 1);
      baseSky.fillRect(0, 0, 960, height);

      const distantWorkshop = this.add.graphics();
      distantWorkshop.setScrollFactor(distantScroll, 1);

      // Repisas de madera de fondo con madejas de colores
      distantWorkshop.fillStyle(0xC9A67D, 0.7);
      distantWorkshop.fillRect(0, 200, width, 10);
      distantWorkshop.fillRect(0, 360, width, 10);

      // Soportes triangulares de las repisas
      distantWorkshop.lineStyle(2, 0xA38057, 0.6);
      for (let x = 60; x < width; x += 180) {
        distantWorkshop.strokeLineShape(new Phaser.Geom.Line(x, 210, x + 15, 230));
        distantWorkshop.strokeLineShape(new Phaser.Geom.Line(x, 370, x + 15, 390));
      }

      // Madejas y ovillos alineados en las repisas
      const skeinColors = [0xE07A5F, 0xF4A261, 0x2A9D8F, 0xE76F51, 0x9B5DE5, 0xF15BB5];
      for (let x = 40; x < width; x += 70) {
        const color = skeinColors[Math.floor(x / 70) % skeinColors.length];
        distantWorkshop.fillStyle(color, 0.8);
        distantWorkshop.fillEllipse(x, 192, 14, 10);
        distantWorkshop.fillEllipse(x + 35, 352, 14, 10);
      }

      // Capa media: Carretes de costura gigantes y cintas métricas que cuelgan
      const midWorkshop = this.add.graphics();
      midWorkshop.setScrollFactor(midScroll, 1);

      for (let x = 120; x < width; x += 320) {
        // Carrete de madera
        midWorkshop.fillStyle(0x8D6E63, 0.85);
        midWorkshop.fillRect(x, 380, 36, 6);
        midWorkshop.fillRect(x, 430, 36, 6);
        midWorkshop.fillRect(x + 10, 386, 16, 44);

        // Hilo enrollado en el carrete
        const spoolColor = x % 2 === 0 ? 0x0284C7 : 0xDC2626;
        midWorkshop.fillStyle(spoolColor, 0.9);
        midWorkshop.fillRect(x + 6, 388, 24, 40);

        // Cinta métrica decorativa que cuelga del techo del taller
        midWorkshop.fillStyle(0xFACC15, 0.65);
        midWorkshop.fillRect(x + 140, 0, 8, 160 + (x % 3) * 30);
      }

    } else {
      // NIVEL 3: El Castillo de las Puntadas (Crepúsculo místico, agujas doradas y torres de encaje)
      baseSky.fillGradientStyle(0xF6EEF8, 0xF6EEF8, 0xEBD8EC, 0xDEC2E2, 1);
      baseSky.fillRect(0, 0, 960, height);

      // Patrón de rombos de capitoné acolchado en el cielo
      const skyPattern = this.add.graphics();
      skyPattern.setScrollFactor(0);
      skyPattern.lineStyle(1, 0xDEC2E2, 0.35);
      for (let x = -height; x < 960 + height; x += 48) {
        skyPattern.strokeLineShape(new Phaser.Geom.Line(x, 0, x + height, height));
        skyPattern.strokeLineShape(new Phaser.Geom.Line(x, height, x + height, 0));
      }

      // Siluetas lejanas del castillo textil (Torres y almenas de crochet)
      const distantCastle = this.add.graphics();
      distantCastle.setScrollFactor(distantScroll, 1);
      distantCastle.fillStyle(0xC9A4D0, 0.55);

      for (let x = 60; x < width; x += 340) {
        distantCastle.fillRect(x, 160, 90, 380);
        for (let b = 0; b < 90; b += 18) {
          distantCastle.fillRect(x + b, 145, 10, 15);
        }
        // Aguja cónica
        distantCastle.beginPath();
        distantCastle.moveTo(x + 10, 145);
        distantCastle.lineTo(x + 45, 60);
        distantCastle.lineTo(x + 80, 145);
        distantCastle.closePath();
        distantCastle.fill();

        // Ventana ojival
        distantCastle.fillStyle(0xF6EEF8, 0.7);
        distantCastle.fillRoundedRect(x + 35, 200, 20, 36, 10);
        distantCastle.fillStyle(0xC9A4D0, 0.55);
      }

      // Capa media: Columnas de agujas doradas de crochet
      const midCastle = this.add.graphics();
      midCastle.setScrollFactor(midScroll, 1);

      for (let x = 160; x < width; x += 260) {
        midCastle.fillStyle(0xD4AF37, 0.75);
        midCastle.fillRect(x, 180, 8, 360);
        midCastle.beginPath();
        midCastle.arc(x + 4, 180, 9, Math.PI, 0);
        midCastle.fill();

        midCastle.lineStyle(1.5, 0xA855F7, 0.4);
        const garlandCurve = new Phaser.Curves.QuadraticBezier(
          new Phaser.Math.Vector2(x + 4, 210),
          new Phaser.Math.Vector2(x + 130, 240),
          new Phaser.Math.Vector2(x + 260, 210)
        );
        garlandCurve.draw(midCastle);
      }
    }
  }

  // Constructor de niveles modulares
  private buildLevel(level: 1 | 2 | 3, worldWidth: number) {
    this.createGroundSegments(worldWidth);

    if (level === 1) {
      // NIVEL 1 — EL BOSQUE DE LOS OVILLOS (Tutorial & Destreza Básica)
      this.checkpointX = 100;
      this.checkpointY = 400;

      // Plataformas de fieltro alcanzables con salto de 465px
      this.createFeltPlatform(300, 390, 2);
      this.createFeltPlatform(530, 330, 2);
      this.createFeltPlatform(780, 280, 2);

      this.createFeltPlatform(1050, 370, 3);
      this.createFeltPlatform(1350, 320, 2);
      this.createFeltPlatform(1580, 260, 2);

      // Ovillos de lana accesibles
      LEVEL_WOOL[1].forEach(({ x, y }) => this.createWoolBall(x, y));

      // Botones de madera dorada (+50 pts)
      this.createButtonBonus(780, 230);
      this.createButtonBonus(1580, 210);

      // Peligros suaves
      this.createPin(680, 465);
      this.createPin(1260, 465);
      this.createDustBunny(1100, 330, 1050, 1220);

      // Meta al final
      this.createGoalBasket(1850, 440);

    } else if (level === 2) {
      // NIVEL 2 — EL TALLER ENCANTADO (Plataformas móviles & Tijeras)
      this.checkpointX = 100;
      this.checkpointY = 400;

      this.createFeltPlatform(240, 390, 2);
      this.createTapePlatform(440, 340, 120, 55);
      this.createFeltPlatform(700, 310, 2);

      this.createTapePlatform(920, 270, 150, 65);
      this.createFeltPlatform(1220, 350, 3);
      this.createTapePlatform(1540, 290, 140, 70);
      this.createFeltPlatform(1820, 230, 2);
      this.createFeltPlatform(2120, 330, 3);

      LEVEL_WOOL[2].forEach(({ x, y }) => this.createWoolBall(x, y));

      this.createButtonBonus(720, 250);
      this.createButtonBonus(1240, 290);
      this.createButtonBonus(1840, 170);

      LEVEL_SCISSORS[2].forEach((scissor) => this.createScissors(scissor.x, scissor.y, scissor.amplitude, scissor.duration));
      this.createPin(1220, 320);
      this.createDustBunny(1230, 310, 1200, 1380);

      this.createGoalBasket(2450, 440);

    } else {
      // NIVEL 3 — EL CASTILLO DE LAS PUNTADAS (Alta precisión & Plataformas deshilachadas)
      this.checkpointX = 100;
      this.checkpointY = 400;

      this.createFeltPlatform(220, 390, 2);
      this.createTapePlatform(380, 330, 100, 60);
      this.createFrayedPlatform(580, 260, 1);
      this.createTapePlatform(740, 220, 120, 70);
      this.createFeltPlatform(980, 180, 2);
      this.createTapePlatform(1240, 250, 140, 80);
      this.createFrayedPlatform(1520, 310, 2);
      this.createTapePlatform(1780, 250, 130, 90);
      this.createFrayedPlatform(2050, 190, 1);
      this.createTapePlatform(2240, 150, 120, 75);
      this.createFeltPlatform(2500, 230, 2);
      this.createFeltPlatform(2760, 330, 3);

      LEVEL_WOOL[3].forEach(({ x, y }) => this.createWoolBall(x, y));

      this.createButtonBonus(600, 200);
      this.createButtonBonus(1000, 120);
      this.createButtonBonus(2060, 130);

      LEVEL_SCISSORS[3].forEach((scissor) => this.createScissors(scissor.x, scissor.y, scissor.amplitude, scissor.duration));
      this.createPin(1530, 280);
      this.createPin(2770, 300);
      this.createDustBunny(2760, 290, 2740, 2950);

      this.createGoalBasket(3050, 440);
    }
  }

  private createGroundSegments(totalWidth: number) {
    const segmentWidth = 380;
    const gap = 120;
    let currentX = 0;

    while (currentX < totalWidth) {
      // Usa textura de suelo dedicada 380x80 sin estiramiento
      const ground = this.platforms.create(currentX + segmentWidth / 2, 500, 'platform-ground-380');
      ground.refreshBody();
      currentX += segmentWidth + gap;
    }
  }

  private createFeltPlatform(x: number, y: number, blocksCount = 2) {
    // Selecciona textura modular exacta (180px o 270px) para preservar bordados y puntadas
    const textureKey = blocksCount >= 3 ? 'platform-felt-270' : 'platform-felt-180';
    const plat = this.platforms.create(x, y, textureKey);
    plat.refreshBody();
  }

  private createFrayedPlatform(x: number, y: number, blocksCount = 2) {
    const textureKey = blocksCount === 1 ? 'platform-frayed-90' : 'platform-frayed-180';
    const plat = this.platforms.create(x, y, textureKey);
    plat.refreshBody();
  }

  private createTapePlatform(x: number, y: number, distance: number, speed: number) {
    const plat = this.movingPlatforms.create(x, y, 'platform-tape');
    plat.setData('startX', x);
    plat.setData('distance', distance);
    plat.setData('speed', speed);
    plat.setData('direction', 1);
    plat.body.setImmovable(true);
  }

  private createWoolBall(x: number, y: number) {
    const wool = this.woolBalls.create(x, y, 'wool-ball');
    this.tweens.add({
      targets: wool,
      y: y - 6,
      duration: 1200 + Math.random() * 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private createButtonBonus(x: number, y: number) {
    const btn = this.buttonsBonus.create(x, y, 'button-wood');
    this.tweens.add({
      targets: btn,
      angle: 360,
      duration: 4000,
      repeat: -1,
      ease: 'Linear',
    });
  }

  private createPin(x: number, y: number) {
    const pin = this.hazardPins.create(x, y, 'pin-hazard');
    pin.refreshBody();
  }

  private createScissors(x: number, y: number, amplitude = 24, duration = 1300) {
    const scissor = this.hazardScissors.create(x, y, 'scissor-hazard');
    scissor.body.setAllowGravity(false);
    scissor.body.setImmovable(true);
    scissor.setData('minY', y - amplitude);
    scissor.setData('maxY', y + amplitude);
    this.tweens.add({
      targets: scissor,
      y: { from: y - amplitude, to: y + amplitude },
      angle: { from: -15, to: 15 },
      duration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private createDustBunny(x: number, y: number, minX: number, maxX: number) {
    const bunny = this.dustBunnies.create(x, y, 'dust-bunny');
    bunny.setBounce(0.2);
    bunny.setCollideWorldBounds(true);
    bunny.setVelocityX(60);
    bunny.setData('minX', minX);
    bunny.setData('maxX', maxX);
  }

  private createGoalBasket(x: number, y: number) {
    this.goalBasket = this.physics.add.sprite(x, y, 'goal-basket');
    this.goalBasket.setImmovable(true);
    (this.goalBasket.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

    this.tweens.add({
      targets: this.goalBasket,
      scale: 1.08,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private handleCollectWool(_player: any, wool: any) {
    wool.destroy();
    this.woolCollected += 1;
    this.score += 15;
    this.playSynthSound(580, 0.06, 'sine');
    this.dispatchTelemetry();
  }

  private handleCollectButton(_player: any, btn: any) {
    btn.destroy();
    this.score += 50;
    this.playSynthSound(880, 0.12, 'sine');
    this.dispatchTelemetry();
  }

  private handleDustBunnyCollision(player: any, bunny: any) {
    if (this.isInvulnerable) return;

    if (player.body.velocity.y > 40 && player.y < bunny.y - 8) {
      bunny.destroy();
      player.setVelocityY(-320);
      this.score += 40;
      this.playSynthSound(620, 0.1, 'square');
      this.dispatchTelemetry();
    } else {
      this.takeDamage();
    }
  }

  private handleHitHazard(_player: any, _hazard: any) {
    if (this.isInvulnerable) return;
    this.takeDamage();
  }

  private takeDamage() {
    this.lives -= 1;
    this.playSynthSound(180, 0.2, 'sawtooth');

    if (this.lives <= 0) {
      this.handleGameOver();
      return;
    }

    this.isInvulnerable = true;
    this.player.setVelocity(-120, -220);

    this.tweens.add({
      targets: this.player,
      alpha: 0.3,
      duration: 100,
      yoyo: true,
      repeat: 6,
      onComplete: () => {
        this.player.setAlpha(1);
        this.isInvulnerable = false;
      },
    });

    this.dispatchTelemetry();
  }

  private handleFallOut() {
    this.lives -= 1;
    this.playSynthSound(140, 0.25, 'sawtooth');

    if (this.lives <= 0) {
      this.handleGameOver();
    } else {
      this.player.setVelocity(0, 0);
      this.player.setPosition(this.checkpointX, this.checkpointY);
      this.dispatchTelemetry();
    }
  }

  private handleReachGoal() {
    if (this.levelComplete) return;
    this.levelComplete = true;

    this.playVictoryFanfare();

    const timeSeconds = Math.round((this.time.now - this.startTime) / 1000);
    const bonusTime = Math.max(0, 100 - timeSeconds) * 2;
    this.score += bonusTime + this.lives * 50;

    let stars: 1 | 2 | 3 = 1;
    if (this.woolCollected >= this.targetWool) stars = 2;
    if (this.woolCollected >= this.targetWool && this.lives === 3) stars = 3;

    const payload: GameTelemetryPayload = {
      level: this.levelNumber,
      score: this.score,
      woolCollected: this.woolCollected,
      targetWool: this.targetWool,
      livesRemaining: this.lives,
      timeElapsedSeconds: timeSeconds,
      starsEarned: stars,
      victory: true,
    };

    if (this.onVictory) {
      this.onVictory(payload);
    }
  }

  private handleGameOver() {
    this.levelComplete = true;
    const timeSeconds = Math.round((this.time.now - this.startTime) / 1000);

    const payload: GameTelemetryPayload = {
      level: this.levelNumber,
      score: this.score,
      woolCollected: this.woolCollected,
      targetWool: this.targetWool,
      livesRemaining: 0,
      timeElapsedSeconds: timeSeconds,
      starsEarned: 1,
      victory: false,
    };

    if (this.onGameOver) {
      this.onGameOver(payload);
    }
  }

  private dispatchTelemetry() {
    if (this.onTelemetryUpdate) {
      const timeSeconds = Math.round((this.time.now - this.startTime) / 1000);
      this.onTelemetryUpdate({
        level: this.levelNumber,
        score: this.score,
        woolCollected: this.woolCollected,
        targetWool: this.targetWool,
        livesRemaining: this.lives,
        timeElapsedSeconds: timeSeconds,
        starsEarned: 1,
        victory: false,
      });
    }
  }

  private playSynthSound(freq: number, duration: number, type: OscillatorType = 'sine') {
    if (!this.audioCtx) return;
    try {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.12, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch {
      // Silencioso si el navegador bloquea audio
    }
  }

  public pauseGame() {
    this.isGamePaused = true;
    this.physics.pause();
    this.tweens.pauseAll();
    this.keysHeldState = { left: false, right: false, jump: false };
    this.touchLeft = false;
    this.touchRight = false;
    this.touchJump = false;
    if (this.player && this.player.body) {
      this.player.setVelocityX(0);
    }
  }

  public resumeGame() {
    this.isGamePaused = false;
    this.physics.resume();
    this.tweens.resumeAll();
  }

  private playDoubleJumpSound() {
    this.playSynthSound(784, 0.08, 'triangle');
    setTimeout(() => {
      this.playSynthSound(988, 0.12, 'triangle');
    }, 60);
  }

  private createDoubleJumpPuff(x: number, y: number) {
    // Generar un pequeño ramillete de motas de algodón/lana que se disipan suavemente
    for (let i = 0; i < 5; i++) {
      const offsetX = (Math.random() - 0.5) * 18;
      const offsetY = (Math.random() - 0.5) * 6;
      const circle = this.add.circle(x + offsetX, y + offsetY, 3.5 + Math.random() * 2.5, 0xffffff, 0.85);
      this.tweens.add({
        targets: circle,
        y: circle.y + 12 + Math.random() * 8,
        alpha: 0,
        scale: 0.2,
        duration: 260,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          circle.destroy();
        },
      });
    }
  }

  private playVictoryFanfare() {
    [523, 659, 784, 1046].forEach((f, idx) => {
      setTimeout(() => this.playSynthSound(f, 0.18, 'triangle'), idx * 120);
    });
  }
}

