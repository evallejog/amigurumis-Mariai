import assert from 'node:assert/strict';
import { GAME_PHYSICS, LEVEL_SCISSORS, LEVEL_WOOL, singleJumpHeight } from '../src/game/levelLayout';

assert.equal(LEVEL_WOOL[1].length >= 12, true);
assert.equal(LEVEL_WOOL[2].length >= 16, true);
assert.equal(LEVEL_WOOL[3].length >= 22, true);

for (const level of [1, 2, 3] as const) {
  for (const wool of LEVEL_WOOL[level]) {
    assert.equal(wool.x > 0 && wool.y > 80 && wool.y < 460, true, `ovillo fuera de zona jugable en nivel ${level}`);
  }
  for (const scissor of LEVEL_SCISSORS[level]) {
    assert.equal(scissor.amplitude > 0 && scissor.amplitude <= 36, true);
    assert.equal(scissor.duration >= 1200 && scissor.duration <= 1600, true);
    assert.equal(scissor.y - scissor.amplitude > 80 && scissor.y + scissor.amplitude < 460, true);
  }
}

assert.equal(singleJumpHeight() > 130, true);
assert.equal(GAME_PHYSICS.runSpeed * 0.9 > 180, true);
console.log('Pruebas deterministas de geometría de Pompón aprobadas (coleccionables, salto y tijeras).');
