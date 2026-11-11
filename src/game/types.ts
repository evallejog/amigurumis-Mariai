/**
 * Definiciones de tipos para el minivideojuego BTL:
 * "Las Aventuras de Pompón: El Gran Rescate de los Ovillos"
 */

export interface LevelConfig {
  levelNumber: 1 | 2 | 3;
  title: string;
  subtitle: string;
  difficulty: 'Fácil' | 'Intermedia' | 'Alta';
  targetWool: number;
  timeLimitSeconds: number;
  rewardProposed: string;
  themeColor: string;
  description: string;
}

export interface GameTelemetryPayload {
  level: number;
  score: number;
  woolCollected: number;
  targetWool: number;
  livesRemaining: number;
  timeElapsedSeconds: number;
  starsEarned: 1 | 2 | 3;
  victory: boolean;
}

export type GameState = 'menu' | 'playing' | 'paused' | 'victory' | 'game_over';
