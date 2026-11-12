import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Bars } from '../src/components/admin/analytics/shared';
import { Evaluation } from '../src/components/admin/MachineLearningDashboard';

const short = renderToStaticMarkup(<Bars rows={[{ name: 'Serie corta', count: 4 }]} />);
assert.match(short, /Serie corta/);
assert.match(short, /Valor observado/);
assert.match(short, /aria-pressed/);

const long = renderToStaticMarkup(<Bars rows={Array.from({ length: 24 }, (_, index) => ({ name: `Serie ${index}`, count: index }))} />);
assert.match(long, /Serie 15/);
assert.doesNotMatch(long, /Serie 16/);

for (const rows of [undefined, null, []]) {
  const html = renderToStaticMarkup(<Bars rows={rows} />);
  assert.match(html, /No hay información registrada/);
}

const evaluation = renderToStaticMarkup(<Evaluation data={{ data_source: 'synthetic_academic', status: 'evaluated', models: [{ model: 'ridge', mae: 1, rmse: 2, wape: null, bias: 0, observations: 2 }], selected_model: 'ridge', test_points: [{ product_id: 'demo-1', date_utc: '2026-01-01', actual: 3, predicted: 2 }], warnings: [] }} />);
assert.match(evaluation, /Gráfico interactivo/);
assert.match(evaluation, /WAPE/);
assert.match(evaluation, /No disponible/);
assert.match(evaluation, /aria-pressed/);

const noPoints = renderToStaticMarkup(<Evaluation data={{ data_source: 'synthetic_academic', status: 'evaluated', models: [{ model: 'ridge', mae: 1, rmse: 2, wape: null, bias: 0, observations: 2 }], selected_model: null, test_points: [], warnings: [] }} />);
assert.match(noPoints, /No hay puntos de prueba disponibles/);
console.log('Regresiones de visualizaciones aprobadas (datos válidos, vacíos, largos y métricas opcionales).');
