export type LevelNumber = 1 | 2 | 3;
export type Point = { x: number; y: number };
export type ScissorLayout = Point & { amplitude: number; duration: number };

export const GAME_PHYSICS = { gravity: 820, runSpeed: 230, firstJumpVelocity: 480, doubleJumpVelocity: 450, playerHeight: 42 } as const;
export const LEVEL_WOOL: Record<LevelNumber, Point[]> = {
  1: [{x:220,y:430},{x:300,y:342},{x:380,y:430},{x:530,y:282},{x:600,y:282},{x:780,y:232},{x:850,y:430},{x:1050,y:322},{x:1120,y:322},{x:1190,y:322},{x:1350,y:272},{x:1580,y:212},{x:1650,y:430}],
  2: [{x:200,y:430},{x:240,y:342},{x:440,y:292},{x:700,y:262},{x:820,y:430},{x:920,y:222},{x:1030,y:222},{x:1220,y:302},{x:1330,y:430},{x:1540,y:242},{x:1650,y:242},{x:1820,y:182},{x:1930,y:430},{x:2120,y:282},{x:2230,y:282},{x:2340,y:430},{x:2450,y:430}],
  3: [{x:180,y:430},{x:220,y:342},{x:380,y:282},{x:580,y:212},{x:740,y:172},{x:850,y:430},{x:980,y:132},{x:1100,y:430},{x:1240,y:202},{x:1380,y:430},{x:1520,y:262},{x:1660,y:430},{x:1780,y:202},{x:1920,y:430},{x:2050,y:142},{x:2160,y:430},{x:2240,y:102},{x:2380,y:430},{x:2500,y:182},{x:2620,y:430},{x:2760,y:282},{x:2880,y:430}],
};
export const LEVEL_SCISSORS: Record<LevelNumber, ScissorLayout[]> = {
  1: [],
  2: [{x:820,y:360,amplitude:24,duration:1300},{x:1420,y:335,amplitude:30,duration:1500}],
  3: [{x:900,y:300,amplitude:28,duration:1250},{x:1680,y:315,amplitude:34,duration:1450},{x:2420,y:270,amplitude:30,duration:1350}],
};

/** Conservative jump height without held-jump assist or the second impulse. */
export const singleJumpHeight = () => GAME_PHYSICS.firstJumpVelocity ** 2 / (2 * GAME_PHYSICS.gravity);
export const isCollectibleReachable = (point: Point, supportTop: number) => point.y <= supportTop && supportTop - point.y <= singleJumpHeight() + 20;
