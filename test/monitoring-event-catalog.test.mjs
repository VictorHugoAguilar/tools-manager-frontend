import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const compiled = await build({
  entryPoints: ['src/app/pages/monitoring/monitoring-event-catalog.ts'], bundle: true, write: false, format: 'esm', platform: 'node'
});
const { describeEvent } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);

test('catalogued, pattern-derived and unknown events are described', () => {
  assert.equal(describeEvent('frontend.api.request.failed'), 'El navegador recibió un error al llamar a la API');
  assert.equal(describeEvent('task_board.column.reordered'), 'Tablero de tareas: column reordenado');
  assert.equal(describeEvent('todo.item.created'), 'Lista de tareas: item creado');
  assert.equal(describeEvent('algo'), 'algo');
  assert.equal(describeEvent('foo.bar.baz'), 'foo.bar.baz');
});

test('every browser telemetry event name has a description', async () => {
  const source = await readFile('src/app/services/telemetry-buffer.ts', 'utf8');
  const names = [...source.matchAll(/'(frontend\.[a-z_.]+)'/g)].map((match) => match[1]);
  assert.ok(names.length >= 12);
  for (const name of new Set(names)) assert.notEqual(describeEvent(name), name, name);
});
