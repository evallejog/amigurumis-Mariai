import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Phaser from 'phaser';
import { useCart } from '../context/CartContext';
import { LevelScene } from '../game/scenes/LevelScene';
import { LevelConfig, GameTelemetryPayload } from '../game/types';
import { BrandLogo } from '../components/common/BrandLogo';
import {
  Gamepad2,
  Trophy,
  Heart,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  Play,
  Pause,
  Award,
  Smartphone,
  Keyboard,
  Target,
  CircleDot,
  ShoppingBag,
  Info,
  CheckCircle2,
  Volume2,
  VolumeX,
  ChevronRight,
  ArrowUp,
  Copy,
  Check
} from 'lucide-react';

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
    description: 'Plataformas deshilachadas y saltos de máxima precisión con doble salto para alcanzar el canasto maestro.',
  },
];

type GameScreenState = 'menu' | 'playing' | 'paused' | 'victory' | 'game_over';

export const GamePage: React.FC = () => {
  const navigate = useNavigate();
  const { setIsCartOpen, setPendingCouponCode } = useCart();

  const [selectedLevel, setSelectedLevel] = useState<1 | 2 | 3>(1);
  const [screenState, setScreenState] = useState<GameScreenState>('menu');
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
  const [showGuide, setShowGuide] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const gameInstanceRef = useRef<Phaser.Game | null>(null);
  const levelSceneRef = useRef<LevelScene | null>(null);

  // Clean teardown helper that destroys Phaser safely
  const destroyCurrentGame = () => {
    if (levelSceneRef.current) {
      try {
        levelSceneRef.current.events.emit('shutdown');
      } catch {}
      levelSceneRef.current = null;
    }
    if (gameInstanceRef.current) {
      try {
        gameInstanceRef.current.destroy(true);
      } catch {}
      gameInstanceRef.current = null;
    }
    // Clean any remaining canvas nodes in container
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
    document.body.style.overflow = '';
  };

  // Ensure teardown on unmount & check query param
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const nivelParam = params.get('nivel');
      if (nivelParam === '1' || nivelParam === '2' || nivelParam === '3') {
        const lvl = parseInt(nivelParam, 10) as 1 | 2 | 3;
        setSelectedLevel(lvl);
        if (params.get('auto') === 'true') {
          startGame(lvl);
        }
      }
    } catch {}

    return () => {
      destroyCurrentGame();
    };
  }, []);

  const handleReturnToStore = () => {
    destroyCurrentGame();
    navigate('/');
  };

  const handleGoToShopWithCoupon = () => {
    if (rewardCoupon?.code) {
      setPendingCouponCode(rewardCoupon.code);
    }
    destroyCurrentGame();
    navigate('/');
    setIsCartOpen(true);
  };

  const handleReturnToMenu = () => {
    destroyCurrentGame();
    setScreenState('menu');
  };

  const startGame = (levelNum: 1 | 2 | 3) => {
    destroyCurrentGame();
    setSelectedLevel(levelNum);
    setScreenState('playing');
    setVictoryModalData(null);
    setGameOverModalData(null);

    // Notify backend session
    try {
      fetch('/api/btl/session/start', {
        method: 'POST',
        credentials: 'same-origin',
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
            gravity: { x: 0, y: 0 },
            debug: false,
          },
        },
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        scene: [sceneInstance],
      };

      const game = new Phaser.Game(config);
      gameInstanceRef.current = game;

      // Start the level once ready
      game.events.once('ready', () => {
        sceneInstance.scene.start('LevelScene', {
          levelNumber: levelNum,
          onPauseToggle: handlePauseToggle,
          onTelemetryUpdate: (data: GameTelemetryPayload) => {
            setTelemetry(data);
          },
          onVictory: async (data: GameTelemetryPayload) => {
            setTelemetry(data);
            setVictoryModalData(data);
            setScreenState('victory');

            let sessId = sessionStorage.getItem('amigurumis_mariai_btl_sess');
            if (!sessId) {
              sessId = `btl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
              sessionStorage.setItem('amigurumis_mariai_btl_sess', sessId);
            }

            // Persist completion before requesting the one-time reward.
            try {
              const completion = await fetch('/api/btl/level/complete', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ game_session_id: sessId, level: data.level, score: data.score, time_seconds: data.timeElapsedSeconds, wool_collected: data.woolCollected }),
              });
              if (!completion.ok) throw new Error('No se pudo registrar la finalización del nivel.');
              const res = await fetch('/api/btl/reward', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: data.level, sessionId: sessId }) });
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

          },
          onGameOver: (data: GameTelemetryPayload) => {
            setTelemetry(data);
            setGameOverModalData(data);
            setScreenState('game_over');
          },
        });
      });
    }, 60);
  };

  const handlePauseToggle = () => {
    if (screenState === 'playing') {
      if (levelSceneRef.current) {
        levelSceneRef.current.pauseGame();
      }
      setScreenState('paused');
    } else if (screenState === 'paused') {
      if (levelSceneRef.current) {
        levelSceneRef.current.resumeGame();
      }
      setScreenState('playing');
    }
  };

  const handleRestartLevel = () => {
    startGame(selectedLevel);
  };

  // Virtual touch controls for mobile
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

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#2E2823] flex flex-col font-sans select-none">
      {/* Top Arcade Bar */}
      <header className="sticky top-0 z-30 w-full bg-white/90 backdrop-blur-xl border-b border-stone-200 shadow-xs px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleReturnToStore}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold transition-all cursor-pointer border border-stone-300/70"
            title="Volver a la tienda de Amigurumis Mariai"
          >
            <ArrowLeft className="w-4 h-4 text-stone-700" />
            <span className="hidden sm:inline">Volver a la Tienda</span>
            <span className="sm:hidden">Tienda</span>
          </button>
          <div className="h-5 w-px bg-stone-200" />
          <BrandLogo size="sm" />
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {screenState === 'playing' && (
            <button
              onClick={handlePauseToggle}
              className="px-3 py-1.5 rounded-xl liquid-glass text-stone-800 hover:text-stone-950 text-xs font-bold flex items-center gap-1.5 border border-stone-300 shadow-xs cursor-pointer"
            >
              <Pause className="w-4 h-4 text-amber-700 fill-amber-700" />
              <span>Pausar</span>
            </button>
          )}

          {screenState !== 'menu' && (
            <button
              onClick={handleReturnToMenu}
              className="px-3 py-1.5 rounded-xl bg-stone-200/80 hover:bg-stone-300 text-stone-800 text-xs font-bold transition-colors cursor-pointer"
            >
              Menú de Niveles
            </button>
          )}
        </div>
      </header>

      {/* Main Arcade Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 max-w-6xl w-full mx-auto">
        {screenState === 'menu' ? (
          /* MENU STATE: Level Selection and Instructions */
          <div className="w-full space-y-8 animate-fadeIn py-4">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full liquid-glass text-xs font-semibold text-amber-900 border border-amber-300/60 shadow-xs">
                <Gamepad2 className="w-4 h-4 text-amber-700" />
                <span>Videojuego Oficial de Pompón</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-sans font-extrabold text-stone-900 tracking-tight">
                Las Aventuras de Pompón
              </h1>
              <p className="text-sm text-stone-600 leading-relaxed font-normal">
                El Gran Rescate de los Ovillos. Acompaña a nuestro conejo amigurumi, recolecta hilazas y materiales
                perdidos por el taller y desbloquea bonos reales de descuento para tus compras en Colombia.
              </p>
            </div>

            {/* Level Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {LEVELS.map((lvl) => {
                const isSelected = selectedLevel === lvl.levelNumber;
                return (
                  <div
                    key={lvl.levelNumber}
                    onClick={() => setSelectedLevel(lvl.levelNumber)}
                    className={`rounded-3xl p-6 sm:p-7 border transition-all duration-300 cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'liquid-glass-elevated border-amber-400 ring-2 ring-amber-400/40 shadow-xl scale-[1.02]'
                        : 'liquid-glass border-white/80 hover:border-amber-300/60 shadow-xs'
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

                    <div className="pt-5 mt-5 border-t border-stone-200/60 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-stone-500 flex items-center gap-1.5">
                          <CircleDot className="w-3.5 h-3.5 text-amber-600" />
                          <span>Meta del taller:</span>
                        </span>
                        <span className="font-bold text-stone-800">
                          {lvl.targetWool} ovillos
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-200/70 text-[11px] font-semibold text-amber-900 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Award className="w-3.5 h-3.5 text-amber-700" />
                          <span>Premio de Recompensa:</span>
                        </span>
                        <span className="font-bold">{lvl.rewardProposed}</span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startGame(lvl.levelNumber);
                        }}
                        className="w-full py-3 px-4 rounded-xl liquid-btn-primary text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md group"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Comenzar Nivel 0{lvl.levelNumber}</span>
                        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Controls Guide Banner (No emojis!) */}
            <div className="liquid-glass rounded-3xl p-6 sm:p-7 border border-white/80 shadow-md">
              <div className="flex items-center justify-between pb-4 border-b border-stone-200/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center">
                    <Gamepad2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-sans font-bold text-stone-900">
                      Instrucciones & Controles Profesionales
                    </h4>
                    <p className="text-xs text-stone-500 font-normal">
                      Incluye salto sostenido y doble salto para alcanzar plataformas elevadas
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-5 text-xs text-stone-700">
                <div className="p-4 rounded-2xl bg-white/80 border border-stone-200/70 space-y-2.5">
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
                    <p className="text-[11px] text-stone-500">• <strong>Doble Salto:</strong> Presiona salto de nuevo en el aire para un segundo impulso.</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/80 border border-stone-200/70 space-y-2.5">
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
                        <span>Botones laterales</span>
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

                <div className="p-4 rounded-2xl bg-white/80 border border-stone-200/70 space-y-2">
                  <div className="flex items-center gap-2 font-sans font-bold text-stone-900 text-sm">
                    <Target className="w-4 h-4 text-amber-700" />
                    <span>Objetivo y Recompensas</span>
                  </div>
                  <p>• <strong>Ovillos (+15 pts):</strong> Alcanza la meta del taller artesanal.</p>
                  <p>• <strong>Botones (+50 pts):</strong> Puntos adicionales.</p>
                  <p>• <strong>Pelusas:</strong> Salta sobre ellas para despejar el camino.</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ACTIVE GAME CONTAINER (PLAYING / PAUSED) */
          <div className="w-full flex flex-col items-center gap-3">
            {/* Live In-Game HUD Bar */}
            <div className="w-full max-w-4xl liquid-glass-elevated rounded-2xl p-3 sm:p-4 border border-white/80 shadow-md flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <span className="px-2.5 py-1 rounded-lg bg-stone-900 text-white text-xs font-sans font-bold tracking-wider">
                  NIVEL 0{selectedLevel}
                </span>
                <div>
                  <h4 className="text-sm font-sans font-bold text-stone-900 leading-tight">
                    {currentLevelConfig.title}
                  </h4>
                  <p className="text-[11px] text-stone-500 hidden sm:block">
                    Rescata los ovillos y llega a la canasta artesanal
                  </p>
                </div>
              </div>

              {/* Live HUD Counters with Lucide Icons */}
              <div className="flex items-center gap-2.5 sm:gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/80 border border-stone-200 shadow-xs">
                  <CircleDot className="w-3.5 h-3.5 text-amber-600" />
                  <span className="tabular-nums font-bold text-stone-900">
                    {telemetry.woolCollected} / {currentLevelConfig.targetWool}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/80 border border-stone-200 shadow-xs">
                  <span className="hidden sm:inline text-stone-500">Puntos:</span>
                  <span className="tabular-nums font-bold text-stone-900">
                    {telemetry.score}
                  </span>
                </div>

                {/* Hearts / Lives */}
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

                {/* Pause Button */}
                <button
                  onClick={handlePauseToggle}
                  className="p-1.5 sm:p-2 rounded-xl text-stone-700 hover:text-stone-950 bg-white/80 hover:bg-white border border-stone-200 transition-colors cursor-pointer"
                  title="Pausar juego"
                >
                  <Pause className="w-4 h-4 text-amber-700 fill-amber-700" />
                </button>
              </div>
            </div>

            {/* Phaser Canvas Container */}
            <div className="relative w-full max-w-4xl aspect-[16/9] rounded-3xl overflow-hidden border border-white/90 shadow-2xl bg-[#FAF7F2]">
              <div
                ref={containerRef}
                className="w-full h-full flex items-center justify-center"
              />

              {/* PAUSED OVERLAY */}
              {screenState === 'paused' && (
                <div className="absolute inset-0 z-30 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="liquid-glass-elevated rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center space-y-4 border border-white/80 shadow-2xl bg-[#FAF7F2]/95">
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
                      <Pause className="w-6 h-6 fill-current" />
                    </div>
                    <h3 className="text-xl font-sans font-bold text-stone-900">
                      Juego Pausado
                    </h3>
                    <p className="text-xs text-stone-600">
                      Tómate un respiro. Pompón te espera para continuar la aventura en el taller.
                    </p>

                    <div className="space-y-2 pt-2">
                      <button
                        onClick={handlePauseToggle}
                        className="w-full py-2.5 px-4 rounded-xl liquid-btn-primary text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>Reanudar Partida</span>
                      </button>

                      <button
                        onClick={handleRestartLevel}
                        className="w-full py-2.5 px-4 rounded-xl bg-white/80 hover:bg-white text-stone-700 text-xs font-bold flex items-center justify-center gap-2 border border-stone-300 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Reiniciar Nivel</span>
                      </button>

                      <button
                        onClick={handleReturnToMenu}
                        className="w-full py-2.5 px-4 rounded-xl bg-stone-200/70 hover:bg-stone-200 text-stone-800 text-xs font-bold transition-colors cursor-pointer"
                      >
                        Seleccionar Otro Nivel
                      </button>

                      <button
                        onClick={handleReturnToStore}
                        className="w-full py-2 text-stone-500 hover:text-stone-800 text-xs font-medium cursor-pointer"
                      >
                        Volver a la Tienda de Amigurumis
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* On-Screen Mobile Touch Controls (< 1024px) */}
            <div className="lg:hidden w-full max-w-4xl flex items-center justify-between px-2 pt-2 select-none touch-none">
              <div className="flex items-center gap-3">
                <button
                  onPointerDown={handlePointerLeftDown}
                  onPointerUp={handlePointerLeftUp}
                  onPointerLeave={handlePointerLeftUp}
                  className="w-16 h-16 rounded-2xl liquid-glass border border-white/80 shadow-lg flex items-center justify-center text-stone-800 active:scale-90 active:bg-amber-100 transition-transform cursor-pointer"
                  aria-label="Mover a la izquierda"
                >
                  <ArrowLeft className="w-7 h-7 stroke-[2.5]" />
                </button>
                <button
                  onPointerDown={handlePointerRightDown}
                  onPointerUp={handlePointerRightUp}
                  onPointerLeave={handlePointerRightUp}
                  className="w-16 h-16 rounded-2xl liquid-glass border border-white/80 shadow-lg flex items-center justify-center text-stone-800 active:scale-90 active:bg-amber-100 transition-transform cursor-pointer"
                  aria-label="Mover a la derecha"
                >
                  <ArrowRight className="w-7 h-7 stroke-[2.5]" />
                </button>
              </div>

              <button
                onPointerDown={handlePointerJumpDown}
                onPointerUp={handlePointerJumpUp}
                onPointerLeave={handlePointerJumpUp}
                className="h-16 px-7 rounded-2xl liquid-btn-primary text-white font-sans font-bold text-sm tracking-wider shadow-lg active:scale-95 transition-transform flex items-center gap-2 cursor-pointer"
                aria-label="Saltar o doble salto"
              >
                <ArrowUp className="w-5 h-5 stroke-[2.5]" />
                <span>SALTAR</span>
              </button>
            </div>

            {/* Mobile Orientation Tip */}
            <div className="lg:hidden flex items-center justify-center gap-1.5 text-[11px] text-stone-500 pt-1">
              <Smartphone className="w-3.5 h-3.5 text-amber-600" />
              <span>Tip: Para mayor campo visual, también puedes girar tu teléfono en modo horizontal.</span>
            </div>
          </div>
        )}

        {/* VICTORY MODAL */}
        {screenState === 'victory' && victoryModalData && (
          <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="liquid-glass-elevated rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-5 border border-white/80 shadow-2xl bg-[#FAF7F2]">
              <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto shadow-sm">
                <Trophy className="w-8 h-8 text-amber-600" />
              </div>

              <div>
                <h3 className="text-2xl font-sans font-extrabold text-stone-900">
                  ¡Nivel Completado!
                </h3>
                <p className="text-xs text-stone-600 mt-1">
                  Pompón rescató los materiales y alcanzó la canasta dorada.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 py-3 border-y border-stone-200/60 text-xs">
                <div>
                  <span className="text-stone-500">Puntaje Total:</span>
                  <p className="font-bold text-stone-900 text-base">{victoryModalData.score}</p>
                </div>
                <div>
                  <span className="text-stone-500">Ovillos Rescatados:</span>
                  <p className="font-bold text-stone-900 text-base">
                    {victoryModalData.woolCollected} / {victoryModalData.targetWool}
                  </p>
                </div>
              </div>

              {/* Promotional Discount Voucher */}
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300/80 text-left space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>Beneficio del Juego Desbloqueado</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-200 text-amber-950 font-mono text-[11px]">
                    {rewardCoupon ? `${rewardCoupon.percent}% OFF` : currentLevelConfig.rewardProposed}
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
                <p className="text-[10px] text-amber-800">
                  Cupón exclusivo generado para ti. Puedes hacer clic en "Ir a Comprar" para cargarlo automáticamente en tu carrito.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                {selectedLevel < 3 && (
                  <button
                    onClick={() => startGame((selectedLevel + 1) as 1 | 2 | 3)}
                    className="w-full py-3 px-4 rounded-xl liquid-btn-primary text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Jugar Siguiente Nivel (Nivel 0{selectedLevel + 1})</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleRestartLevel}
                    className="py-2.5 px-3 rounded-xl bg-white border border-stone-300 text-stone-700 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-stone-50 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Repetir Nivel</span>
                  </button>
                  <button
                    onClick={handleGoToShopWithCoupon}
                    className="py-2.5 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Ir a Comprar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* GAME OVER MODAL */}
        {screenState === 'game_over' && gameOverModalData && (
          <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="liquid-glass-elevated rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-5 border border-white/80 shadow-2xl bg-[#FAF7F2]">
              <div className="w-16 h-16 rounded-3xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto shadow-sm">
                <Heart className="w-8 h-8 text-rose-500" />
              </div>

              <div>
                <h3 className="text-2xl font-sans font-extrabold text-stone-900">
                  ¡Pompón se quedó sin vidas!
                </h3>
                <p className="text-xs text-stone-600 mt-1">
                  Los alfileres y tijeras fueron implacables. ¡Inténtalo de nuevo, el taller te necesita!
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-stone-100 border border-stone-200 text-xs text-stone-700">
                Puntaje obtenido: <strong>{gameOverModalData.score} pts</strong>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleReturnToMenu}
                  className="py-2.5 px-3 rounded-xl bg-stone-200 text-stone-800 text-xs font-bold hover:bg-stone-300 transition-colors cursor-pointer"
                >
                  Elegir Nivel
                </button>
                <button
                  onClick={handleRestartLevel}
                  className="py-2.5 px-3 rounded-xl liquid-btn-primary text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Intentar de Nuevo</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
