/* Fechas de modificacion del sitemap. Run: node --test test/lastmod.unit.js */

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveLastmods } = require('../scripts/lib/lastmod');

test('una URL nueva recibe la fecha de hoy', () => {
  const { lastmods } = resolveLastmods({}, { '/a': 'x' }, '2026-10-03');
  assert.equal(lastmods['/a'], '2026-10-03');
});

test('contenido sin cambios conserva la fecha anterior', () => {
  const first = resolveLastmods({}, { '/a': 'x', '/b': 'y' }, '2026-01-01');
  const second = resolveLastmods(first.manifest, { '/a': 'x', '/b': 'y' }, '2026-10-03');
  assert.deepEqual(second.lastmods, { '/a': '2026-01-01', '/b': '2026-01-01' });
  assert.deepEqual(second.manifest, first.manifest);
});

test('solo la URL cuyo contenido cambio renueva su fecha', () => {
  const first = resolveLastmods({}, { '/a': 'x', '/b': 'y' }, '2026-01-01');
  const second = resolveLastmods(first.manifest, { '/a': 'x2', '/b': 'y' }, '2026-10-03');
  assert.equal(second.lastmods['/a'], '2026-10-03');
  assert.equal(second.lastmods['/b'], '2026-01-01');
});

test('URLs retiradas se descartan del manifest', () => {
  const first = resolveLastmods({}, { '/a': 'x', '/b': 'y' }, '2026-01-01');
  const second = resolveLastmods(first.manifest, { '/a': 'x' }, '2026-10-03');
  assert.deepEqual(Object.keys(second.manifest), ['/a']);
});
