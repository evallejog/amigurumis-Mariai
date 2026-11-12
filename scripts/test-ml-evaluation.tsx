import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Evaluation } from '../src/components/admin/MachineLearningDashboard';
import type { MlEvaluation } from '../src/types/analytics';

const historical = {
  status: 'evaluated',
  data_source: 'synthetic_academic',
  horizon: 4,
  models: [{ model: 'historical_mean', mae: 1.544, rmse: 1.827 }],
};

for (const [name, testPoints] of [
  ['ausente', undefined], ['null', null], ['vacío', []],
] as const) {
  const artifact = { ...historical, ...(name === 'ausente' ? {} : { test_points: testPoints }) } as unknown as MlEvaluation;
  const html = renderToStaticMarkup(<Evaluation data={artifact} />);
  assert.match(html, /Comparación de modelos/, name);
  assert.match(html, /No hay puntos de prueba disponibles/, name);
  assert.match(html, /historical_mean/, name);
  assert.match(html, /No disponible/, name);
  assert.doesNotMatch(html, /role="img"|NaN|Infinity|undefined|null/, name);
}

for (const models of [undefined, null, []]) {
  const html = renderToStaticMarkup(<Evaluation data={{ ...historical, models } as unknown as MlEvaluation} />);
  assert.match(html, /0 modelos evaluados/);
  assert.doesNotMatch(html, /NaN|Infinity|undefined|null/);
}

const invalidPoints = { ...historical, test_points: [null, { actual: Number.NaN, predicted: 1 }] } as unknown as MlEvaluation;
assert.match(renderToStaticMarkup(<Evaluation data={invalidPoints} />), /No hay puntos de prueba disponibles/);
console.log('Regresiones de Evaluación ML aprobadas (7 casos).');
