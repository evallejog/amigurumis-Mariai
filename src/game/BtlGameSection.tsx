import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Phaser from 'phaser';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { LevelScene } from './scenes/LevelScene';
import { LevelConfig, GameTelemetryPayload, GameState } from './types';
import {
  Gamepad2,
  Trophy,
  Heart,
  RotateCcw,
  Sparkles,
  ArrowRight,
  X,
  ShoppingBag,
  Play,
  HelpCircle,
  Award,
  Smartphone,
  Keyboard,
  Target,
  CircleDot,
  ArrowLeft,
  ArrowUp,
  Copy,
  Check
} from 'lucide-react';

interface BtlGameSectionProps {
  onNavigateToCatalog?: () => void;
  onGameActiveChange?: (isActive: boolean) => void;
}

const LEVELS: LevelConfig[] = [
  {
    levelNumber: 1,
    title: 'El Bosque de los Ovillos',
    subtitle: 'Tutorial & Destreza Básica',
    difficulty: 'Fácil',
    targetWool: 12,
    timeLimitSeconds: 90,
    rewardProposed: '5% de Descuento (Juego Pompón)',
    themeColor: 'from-emerald-500/20 to-teal-500/10',
    description: 'Aprende los movimientos de Pompón, recolecta ovillos sobre plataformas de fieltro y esquiva los primeros alfileres.',
  },
  {
    levelNumber: 2,
    title: 'El Taller Encantado',
    subtitle: 'Plataformas Móviles & Tijeras',
    difficulty: 'Intermedia',
    targetWool: 16,
    timeLimitSeconds: 120,
    rewardProposed: '10% de Descuento (Juego Pompón)',
    themeColor: 'from-amber-500/20 to-orange-500/10',
    description: 'Sube a cintas métricas en movimiento y calcula el ritmo de las tijeras de costura para no deshilacharte.',
  },
  {
    levelNumber: 3,
    title: 'El Castillo de las Puntadas',
    subtitle: 'Ascenso Vertical & Canasta Dorada',
    difficulty: 'Alta',
    targetWool: 22,
    timeLimitSeconds: 160,
    rewardProposed: '15% de Descuento (Juego Pompón)',
    themeColor: 'from-purple-500/20 to-rose-500/10',
    description: 'Plataformas deshilachadas y saltos de máxima precisión con coyote time para alcanzar el canasto maestro.',
  },
];

export const BtlGameSection: React.FC<BtlGameSectionProps> = ({
  onNavigateToCatalog,
  onGameActiveChange,
}) => {
  const navigate = useNavigate();
  const { setIsCartOpen, setPendingCouponCode } = useCart();
  const { token } = useAuth();

  const [selectedLevel, setSelectedLevel] = useState<1 | 2 | 3>(1);
  const [gameState, setGameState] = useState<GameState>('menu');
  const [rewardCoupon, setRewardCoupon] = useState<{ code: string; percent: number } | null>(null);
  const [telemetry, setTelemetry] = useState<GameTelemetryPayload>({
    level: 1,
    score: 0,
    woolCollected: 0,
    targetWool: 12,
    livesRemaining: 3,
    timeElapsedSeconds: 0,
    starsEarned: 1,
    victory: false,
  });

  const [victoryModalData, setVictoryModalData] = useState<GameTelemetryPayload | null>(null);
  const [gameOverModalData, setGameOverModalData] = useState<GameTelemetryPayload | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  // Mobile orientation detection
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const gameInstanceRef = useRef<Phaser.Game | null>(null);
  const levelSceneRef = useRef<LevelScene | null>(null);

  // Detect mobile landscape orientation
  useEffect(() => {
    const checkOrientation = () => {
      const isCoarse = window.matchMedia('(pointer: coarse)').matches;
      const isNarrow = window.innerWidth <= 900;
      const isLandscape = window.innerWidth > window.innerHeight;

      // Only prompt mobile devices in landscape, never desktop PCs with wide screens
      if (isCoarse && isNarrow && isLandscape) {
        setIsMobileLandscape(true);
      } else {
        setIsMobileLandscape(false);
      }
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Notify parent of game active state to adapt mobile bottom bar
  useEffect(() => {
    if (onGameActiveChange) {
      onGameActiveChange(gameState === 'playing');
    }
  }, [gameState, onGameActiveChange]);

  // Launch game in container
  const startGame = (levelNum: 1 | 2 | 3) => {
    setSelectedLevel(levelNum);
    setGameState('playing');
    setVictoryModalData(null);
    setGameOverModalData(null);

    // Try requesting portrait orientation if available on mobile
    try {
      if ('orientation' in screen && (screen.orientation as any).lock) {
        (screen.orientation as any).lock('portrait').catch(() => {});
      }
    } catch {}

    // Enviar evento de inicio a la API local de telemetría si está disponible
    try {
      fetch('/api/btl/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: levelNum }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.game_session_id) {
            sessionStorage.setItem('amigurumis_mariai_btl_sess', data.game_session_id);
          }
        })
        .catch(() => {});
    } catch {}

    // Limpiar instancia previa si existiera
    if (gameInstanceRef.current) {
      gameInstanceRef.current.destroy(true);
      gameInstanceRef.current = null;
    }

    setTimeout(() => {
      if (!containerRef.current) return;

      const sceneInstance = new LevelScene();
      levelSceneRef.current = sceneInstance;

      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: 960,
        height: 540,
        backgroundColor: '#FAF7F2',
        physics: {
          default: 'arcade',
          arcade: {
            gravity: { x: 0, y: 820 },
            debug: false,
          },
        },
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: 960,
          height: 540,
        },
        scene: sceneInstance,
      };

      const game = new Phaser.Game(config);
      gameInstanceRef.current = game;

      // Iniciar escena con datos y callbacks
      sceneInstance.scene.start('LevelScene', {
        levelNumber: levelNum,
        onTelemetryUpdate: (data: GameTelemetryPayload) => {
          setTelemetry(data);
        },
        onVictory: async (data: GameTelemetryPayload) => {
          setVictoryModalData(data);
          setGameState('victory');

          let sessId = sessionStorage.getItem('amigurumis_mariai_btl_sess');
          if (!sessId) {
            sessId = `btl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            sessionStorage.setItem('amigurumis_mariai_btl_sess', sessId);
          }

          // Solicitud de cupón aleatorio único (MARIAI-XXXXXX) al backend
          try {
            const res = await fetch('/api/btl/reward', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({ level: data.level, sessionId: sessId }),
            });

            if (res.ok) {
              const rewardData = await res.json();
              if (rewardData.success && rewardData.code) {
                setRewardCoupon({ code: rewardData.code, percent: rewardData.discountPercent });
                setPendingCouponCode(rewardData.code);
              }
            }
          } catch (err) {
            console.warn('Error fetching BTL coupon reward:', err);
          }

          // Reportar a endpoint de telemetría
          try {
            fetch('/api/btl/level/complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                game_session_id: sessId,
                level: data.level,
                score: data.score,
                time_seconds: data.timeElapsedSeconds,
                wool_collected: data.woolCollected,
              }),
            }).catch(() => {});
          } catch {}
        },
        onGameOver: (data: GameTelemetryPayload) => {
          setGameOverModalData(data);
          setGameState('game_over');
        },
      });
    }, 60);
  };

  const stopGame = () => {
    if (gameInstanceRef.current) {
      gameInstanceRef.current.destroy(true);
      gameInstanceRef.current = null;
      levelSceneRef.current = null;
    }
    setGameState('menu');
  };

  const restartCurrentLevel = () => {
    startGame(selectedLevel);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (gameInstanceRef.current) {
        gameInstanceRef.current.destroy(true);
        gameInstanceRef.current = null;
      }
    };
  }, []);

  // Unified Pointer Handlers for Mobile Virtual Buttons (pointerdown, pointerup, pointercancel, pointerleave)
  const handlePointerLeftDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (levelSceneRef.current) levelSceneRef.current.touchLeft = true;
  };
  const handlePointerLeftUp = (e: React.PointerEvent) => {
    e.preventDefault();
    if (levelSceneRef.current) levelSceneRef.current.touchLeft = false;
  };

  const handlePointerRightDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (levelSceneRef.current) levelSceneRef.current.touchRight = true;
  };
  const handlePointerRightUp = (e: React.PointerEvent) => {
    e.preventDefault();
    if (levelSceneRef.current) levelSceneRef.current.touchRight = false;
  };

  const handlePointerJumpDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (levelSceneRef.current) {
      levelSceneRef.current.setVirtualJump(true);
    }
  };
  const handlePointerJumpUp = (e: React.PointerEvent) => {
    e.preventDefault();
    if (levelSceneRef.current) {
      levelSceneRef.current.setVirtualJump(false);
    }
  };

  const currentLevelConfig = LEVELS.find((l) => l.levelNumber === selectedLevel) || LEVELS[0];

  return (
    <section id="juego" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-24">
      {/* Header del videojuego BTL con tipografía sans-serif moderna */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full liquid-glass text-xs font-semibold text-amber-900 mb-4 shadow-xs border border-white/80">
          <Gamepad2 className="w-4 h-4 text-amber-600" />
          <span>Aventura Lúdica & Gamificación Artesanal</span>
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-sans font-extrabold text-stone-900 tracking-tight">
          Las Aventuras de Pompón
        </h2>
        <p className="mt-4 text-sm sm:text-base text-stone-600 leading-relaxed font-normal">
          Acompaña a nuestro conejo amigurumi en un minivideojuego de plataformas 2D. Rescata los ovillos de lana
          y materiales perdidos en el taller artesanal para desbloquear logros y beneficios comerciales exclusivos.
        </p>
      </div>

      {/* ZONA PRINCIPAL DE JUEGO */}
      {gameState === 'menu' ? (
        /* VISTA PREVIA / SELECTOR DE NIVELES */
        <div className="space-y-8">
          {/* Tarjetas de Selección de los 3 Niveles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {LEVELS.map((lvl) => {
              const isSelected = selectedLevel === lvl.levelNumber;
              return (
                <div
                  key={lvl.levelNumber}
                  onClick={() => setSelectedLevel(lvl.levelNumber)}
                  className={`rounded-3xl p-6 sm:p-7 border transition-all duration-300 cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'liquid-glass-elevated border-amber-400/80 ring-2 ring-amber-400/30 shadow-xl transform -translate-y-1'
                      : 'liquid-glass border-white/70 hover:border-amber-300/40 shadow-xs'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 rounded-full text-xs font-bold font-sans bg-stone-900 text-white tracking-wider">
                        NIVEL 0{lvl.levelNumber}
                      </span>
                      <span className="text-xs font-semibold text-stone-500">
                        {lvl.difficulty}
                      </span>
                    </div>

                    <h3 className="text-xl font-sans font-bold text-stone-900">
                      {lvl.title}
                    </h3>
                    <p className="text-xs text-amber-900 font-semibold">
                      {lvl.subtitle}
                    </p>
                    <p className="text-xs text-stone-600 leading-relaxed font-normal">
                      {lvl.description}
                    </p>
                  </div>

                  <div className="pt-5 mt-5 border-t border-stone-200/50 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-500 flex items-center gap-1.5">
                        <CircleDot className="w-3.5 h-3.5 text-amber-600" />
                        <span>Meta del taller:</span>
                      </span>
                      <span className="font-bold text-stone-800">
                        {lvl.targetWool} ovillos
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/60 text-[11px] font-semibold text-amber-900 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Award className="w-3.5 h-3.5 text-amber-700" />
                        <span>Premio de Recompensa:</span>
                      </span>
                      <span className="font-bold">{lvl.rewardProposed}</span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/jugar?nivel=${lvl.levelNumber}&auto=true`);
                      }}
                      className="w-full py-3 px-4 rounded-xl liquid-btn-primary text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs group"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Jugar Nivel 0{lvl.levelNumber}</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Banner central de Instrucciones y Controles */}
          <div className="liquid-glass rounded-3xl p-6 sm:p-8 border border-white/80 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100/80 text-amber-800 flex items-center justify-center">
                  <Gamepad2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-sans font-bold text-stone-900">Guía de Controles & Reglas</h4>
                  <p className="text-xs text-stone-500 font-normal">
                    Controles universales para teclado de computadora y pantallas táctiles móviles
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowHowToPlay(!showHowToPlay)}
                  className="px-3.5 py-2 rounded-xl liquid-btn-secondary text-stone-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>{showHowToPlay ? 'Ocultar Guía' : 'Ver Detalles'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-5 text-xs text-stone-700">
              <div className="p-4 rounded-2xl bg-white/70 border border-stone-200/50 space-y-2.5">
                <div className="flex items-center gap-2 font-sans font-bold text-stone-900 text-sm">
                  <Keyboard className="w-4 h-4 text-amber-700" />
                  <span>Teclado (Computadora)</span>
                </div>
                <div className="space-y-1.5 pt-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-stone-900">• Correr:</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-stone-100 border border-stone-300 font-mono text-[10px] shadow-2xs">A</kbd>
                    <kbd className="px-1.5 py-0.5 rounded bg-stone-100 border border-stone-300 font-mono text-[10px] shadow-2xs">D</kbd>
                    <span className="text-stone-400">o</span>
                    <kbd className="p-1 rounded bg-stone-100 border border-stone-300 shadow-2xs inline-flex"><ArrowLeft className="w-2.5 h-2.5" /></kbd>
                    <kbd className="p-1 rounded bg-stone-100 border border-stone-300 shadow-2xs inline-flex"><ArrowRight className="w-2.5 h-2.5" /></kbd>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-stone-900">• Salto ágil:</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-stone-100 border border-stone-300 font-mono text-[10px] shadow-2xs">Espacio</kbd>
                    <kbd className="px-1.5 py-0.5 rounded bg-stone-100 border border-stone-300 font-mono text-[10px] shadow-2xs">W</kbd>
                    <kbd className="p-1 rounded bg-stone-100 border border-stone-300 shadow-2xs inline-flex"><ArrowUp className="w-2.5 h-2.5" /></kbd>
                  </div>
                  <p className="text-[11px] text-stone-500">• <strong>Doble Salto:</strong> Presiona salto en el aire para un segundo impulso.</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/70 border border-stone-200/50 space-y-2.5">
                <div className="flex items-center gap-2 font-sans font-bold text-stone-900 text-sm">
                  <Smartphone className="w-4 h-4 text-amber-700" />
                  <span>Pantallas Táctiles (Móvil)</span>
                </div>
                <div className="space-y-1.5 pt-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-stone-900">• Desplazamiento:</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-stone-100 border border-stone-200 text-stone-800 font-semibold text-[11px]">
                      <ArrowLeft className="w-3 h-3 text-stone-700" />
                      <ArrowRight className="w-3 h-3 text-stone-700" />
                      <span>Botones táctiles</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-stone-900">• Salto:</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 border border-amber-300 text-amber-950 font-semibold text-[11px]">
                      <ArrowUp className="w-3 h-3 text-amber-800" />
                      <span>Botón de Salto</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500">• Toca 2 veces el botón de salto para realizar doble salto en el aire.</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/70 border border-stone-200/50 space-y-2">
                <div className="flex items-center gap-2 font-sans font-bold text-stone-900 text-sm">
                  <Target className="w-4 h-4 text-amber-700" />
                  <span>Objetivo y Coleccionables</span>
                </div>
                <p>• <strong>Ovillos (+15 pts):</strong> Alcanza la meta del nivel</p>
                <p>• <strong>Botones (+50 pts):</strong> Puntos adicionales</p>
                <p>• <strong>Pelusas:</strong> Salta sobre ellas para disolverlas</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* VISTA ACTIVA DEL LIENZO DE PHASER */
        <div className="space-y-4">
          {/* Top Bar HUD del juego con tipografía sans-serif moderna */}
          <div className="liquid-glass-elevated rounded-2xl p-3.5 sm:p-4 border border-white/80 shadow-md flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <span className="px-2.5 py-1 rounded-lg bg-stone-900 text-white text-xs font-sans font-bold tracking-wider">
                NIVEL 0{selectedLevel}
              </span>
              <div>
                <h4 className="text-sm font-sans font-bold text-stone-900 leading-tight">
                  {currentLevelConfig.title}
                </h4>
                <p className="text-[11px] text-stone-500 hidden sm:block">
                  Rescata los ovillos y llega a la canasta dorada
                </p>
              </div>
            </div>

            {/* Marcadores reactivos */}
            <div className="flex items-center gap-2.5 sm:gap-4 text-xs font-semibold">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/80 border border-stone-200 shadow-xs">
                <CircleDot className="w-3.5 h-3.5 text-amber-600" />
                <span className="tabular-nums font-bold text-stone-900">
                  {telemetry.woolCollected} / {currentLevelConfig.targetWool}
                </span>
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/80 border border-stone-200 shadow-xs">
                <span className="hidden sm:inline">Puntos:</span>
                <span className="tabular-nums font-bold text-stone-900">
                  {telemetry.score}
                </span>
              </div>

              {/* Vidas */}
              <div className="flex items-center gap-1 text-rose-500">
                {[1, 2, 3].map((i) => (
                  <Heart
                    key={i}
                    className={`w-4 h-4 ${
                      i <= telemetry.livesRemaining ? 'fill-current text-rose-500' : 'text-stone-300'
                    }`}
                  />
                ))}
              </div>

              {/* Botón Salir */}
              <button
                onClick={stopGame}
                className="p-1.5 sm:p-2 rounded-xl text-stone-500 hover:text-stone-900 bg-white/70 hover:bg-white border border-stone-200 transition-colors cursor-pointer"
                title="Salir del juego y volver al menú"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Contenedor del Canvas de Phaser: Sin franjas blancas, integrado al fondo cálido #FAF7F2 */}
          <div className="relative rounded-3xl overflow-hidden liquid-glass-elevated border-2 border-stone-300/80 shadow-2xl bg-[#FAF7F2] flex items-center justify-center w-full min-h-[340px] sm:min-h-[460px] max-h-[560px]">
            {/* Contenedor de Phaser que llena el canvas sin gaps */}
            <div
              ref={containerRef}
              className="w-full h-full flex items-center justify-center bg-[#FAF7F2] [&>canvas]:max-w-full [&>canvas]:max-h-full [&>canvas]:object-contain [&>canvas]:rounded-2xl"
            />

            {/* OVERLAY DE ORIENTACIÓN VERTICAL EN MÓVILES (Si se gira a horizontal en smartphone) */}
            {isMobileLandscape && (
              <div className="absolute inset-0 z-40 bg-stone-900/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center text-white">
                <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center mb-4 animate-bounce">
                  <Smartphone className="w-8 h-8 text-amber-300 transform rotate-90" />
                </div>
                <h3 className="text-lg font-sans font-bold text-white mb-1">
                  Gira tu dispositivo para jugar
                </h3>
                <p className="text-xs text-stone-300 max-w-xs leading-relaxed">
                  Las Aventuras de Pompón están diseñadas para disfrutarse en posición <strong>vertical (portrait)</strong> en tu teléfono móvil.
                </p>
                <button
                  onClick={() => setIsMobileLandscape(false)}
                  className="mt-4 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-semibold cursor-pointer"
                >
                  Continuar de todos modos
                </button>
              </div>
            )}

            {/* Controles táctiles virtuales en pantalla para móviles (superpuestos al canvas con pointer events robustos) */}
            <div className="md:hidden absolute inset-0 pointer-events-none flex flex-col justify-between p-3 sm:p-4 z-20">
              <div className="flex justify-end pointer-events-auto">
                <button
                  onClick={restartCurrentLevel}
                  className="p-2.5 rounded-2xl bg-white/85 backdrop-blur-md shadow-md text-stone-800 border border-white cursor-pointer active:scale-95"
                  aria-label="Reiniciar nivel desde el inicio"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Botonera de juego inferior para pulgares */}
              <div className="flex items-end justify-between w-full pointer-events-auto pb-1">
                {/* D-Pad horizontal */}
                <div className="flex gap-2.5 touch-none select-none">
                  <button
                    onPointerDown={handlePointerLeftDown}
                    onPointerUp={handlePointerLeftUp}
                    onPointerCancel={handlePointerLeftUp}
                    onPointerLeave={handlePointerLeftUp}
                    className="w-14 h-14 rounded-2xl bg-white/95 backdrop-blur-md border border-white/90 shadow-lg flex items-center justify-center text-stone-800 active:scale-90 active:bg-amber-100 select-none touch-none cursor-pointer transition-transform"
                    aria-label="Mover a la izquierda"
                  >
                    <ArrowLeft className="w-6 h-6 stroke-[2.5]" />
                  </button>
                  <button
                    onPointerDown={handlePointerRightDown}
                    onPointerUp={handlePointerRightUp}
                    onPointerCancel={handlePointerRightUp}
                    onPointerLeave={handlePointerRightUp}
                    className="w-14 h-14 rounded-2xl bg-white/95 backdrop-blur-md border border-white/90 shadow-lg flex items-center justify-center text-stone-800 active:scale-90 active:bg-amber-100 select-none touch-none cursor-pointer transition-transform"
                    aria-label="Mover a la derecha"
                  >
                    <ArrowRight className="w-6 h-6 stroke-[2.5]" />
                  </button>
                </div>

                {/* Botón de Salto grande y ergonómico */}
                <button
                  onPointerDown={handlePointerJumpDown}
                  onPointerUp={handlePointerJumpUp}
                  onPointerCancel={handlePointerJumpUp}
                  onPointerLeave={handlePointerJumpUp}
                  className="w-20 h-20 rounded-3xl bg-amber-500 text-stone-950 backdrop-blur-md border-2 border-white shadow-xl flex flex-col items-center justify-center font-sans font-extrabold text-xs active:scale-90 active:bg-amber-400 select-none touch-none cursor-pointer transition-transform"
                  aria-label="Saltar con Pompón"
                >
                  <ArrowUp className="w-6 h-6 stroke-[2.5] mb-0.5" />
                  <span className="text-[11px] font-extrabold tracking-wider">SALTAR</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE VICTORIA (LIQUID GLASS) */}
      {victoryModalData && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-md" onClick={() => setVictoryModalData(null)} />
          <div className="relative w-full max-w-md liquid-glass-elevated rounded-3xl border border-white/90 shadow-2xl p-6 sm:p-8 text-center space-y-5 z-10 animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-md">
              <Trophy className="w-8 h-8" />
            </div>

            <div>
              <span className="text-xs font-sans font-bold uppercase text-amber-800 tracking-wider">
                ¡Nivel 0{victoryModalData.level} Superado!
              </span>
              <h3 className="text-2xl font-sans font-bold text-stone-900 mt-1">
                ¡Pompón rescató los ovillos!
              </h3>
              <p className="text-xs text-stone-600 mt-1 font-normal">
                Alcanzaste la canasta dorada completando el desafío artesanal del taller.
              </p>
            </div>

            {/* Estrellas ganadas */}
            <div className="flex justify-center gap-1.5 text-2xl text-amber-400">
              {[1, 2, 3].map((star) => (
                <span key={star}>
                  {star <= victoryModalData.starsEarned ? '★' : '☆'}
                </span>
              ))}
            </div>

            {/* Métricas del nivel */}
            <div className="grid grid-cols-3 gap-2 text-xs p-3.5 rounded-2xl bg-white/70 border border-stone-200">
              <div>
                <span className="text-stone-400 block text-[10px]">Puntuación</span>
                <span className="font-bold text-stone-900 tabular-nums">{victoryModalData.score}</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px]">Ovillos</span>
                <span className="font-bold text-stone-900 tabular-nums">
                  {victoryModalData.woolCollected} / {victoryModalData.targetWool}
                </span>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px]">Tiempo</span>
                <span className="font-bold text-stone-900 tabular-nums">{victoryModalData.timeElapsedSeconds}s</span>
              </div>
            </div>

            {/* CUPÓN PROMOCIONAL BTL DESBLOQUEADO */}
            <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-300 text-left space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Beneficio del Juego Desbloqueado</span>
                </span>
                <span className="px-2 py-0.5 rounded-md bg-amber-200 text-amber-950 font-mono text-[11px]">
                  {rewardCoupon ? `${rewardCoupon.percent}% OFF` : (victoryModalData.level === 1 ? '5%' : victoryModalData.level === 2 ? '10%' : '15%') + ' OFF'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white border border-amber-200 shadow-2xs">
                <span className="font-mono font-extrabold text-stone-900 text-sm tracking-wider">
                  {rewardCoupon?.code || 'Generando cupón único...'}
                </span>
                <button
                  onClick={() => {
                    if (rewardCoupon?.code) {
                      handleCopyCode(rewardCoupon.code);
                    }
                  }}
                  disabled={!rewardCoupon}
                  className="px-3 py-1 rounded-lg bg-amber-800 text-white text-xs font-bold hover:bg-amber-900 disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-stone-600 leading-relaxed font-normal">
                Cupón exclusivo generado para ti. Puedes hacer clic en "Ir al Carrito y Tienda" para cargarlo automáticamente en tu compra.
              </p>
            </div>

            {/* Botones de acción */}
            <div className="space-y-2 pt-2">
              {victoryModalData.level < 3 ? (
                <button
                  onClick={() => startGame((victoryModalData.level + 1) as 1 | 2 | 3)}
                  className="w-full py-3 px-4 rounded-xl liquid-btn-primary text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <span>Jugar Siguiente Nivel (Nivel 0{victoryModalData.level + 1})</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={stopGame}
                  className="w-full py-3 px-4 rounded-xl liquid-btn-primary text-white text-xs font-bold cursor-pointer shadow-md"
                >
                  ¡Juego Completado! Volver al Menú
                </button>
              )}

              <button
                onClick={() => {
                  if (rewardCoupon?.code) {
                    setPendingCouponCode(rewardCoupon.code);
                  }
                  setVictoryModalData(null);
                  stopGame();
                  setIsCartOpen(true);
                  if (onNavigateToCatalog) onNavigateToCatalog();
                }}
                className="w-full py-2.5 px-4 rounded-xl liquid-btn-secondary text-stone-700 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Ir al Carrito y Tienda con mi Descuento</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE GAME OVER (DERROTA / REINTENTO) */}
      {gameOverModalData && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-md" onClick={() => setGameOverModalData(null)} />
          <div className="relative w-full max-w-sm liquid-glass-elevated rounded-3xl border border-white/90 shadow-2xl p-6 sm:p-8 text-center space-y-5 z-10 animate-fadeIn">
            <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-md">
              <RotateCcw className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-xl font-sans font-bold text-stone-900">
                ¡Pompón se deshilachó!
              </h3>
              <p className="text-xs text-stone-600 mt-1 font-normal">
                Te quedaste sin vidas en el Nivel 0{gameOverModalData.level}. Los alfileres y tijeras requieren cálculo de salto.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white/70 border border-stone-200 text-xs font-semibold text-stone-700">
              Puntuación lograda: <strong className="tabular-nums font-bold">{gameOverModalData.score} pts</strong>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={restartCurrentLevel}
                className="w-full py-3 px-4 rounded-xl liquid-btn-primary text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reintentar Nivel 0{selectedLevel}</span>
              </button>

              <button
                onClick={stopGame}
                className="w-full py-2.5 px-4 rounded-xl liquid-btn-secondary text-stone-700 text-xs font-semibold cursor-pointer"
              >
                Volver a Selección de Niveles
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
