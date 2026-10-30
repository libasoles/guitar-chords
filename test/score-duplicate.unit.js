const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/site/score-model');

const row = (...events) => events.map(([d, n, at, extra]) => ({ d, n, at, ...extra }));
const ns = (s, mi) => M.measures(s)[mi].map((ev) => ev.n);

test('duplicar copia despues de la ultima figura elegida, no del final del compas', () => {
  const s = M.emptyScore();
  s.rows[0][0] = row(['q', 37, 0], ['q', 38, 24], ['q', 39, 48]);
  const created = M.duplicateSelection(s, [{ mi: 0, i: 0 }, { mi: 0, i: 1 }]);
  assert.equal(created.length, 2);
  assert.deepEqual(M.onsets(M.measures(s)[0]).sort((a, b) => a - b), [0, 24, 48, 48, 72]);
  assert.deepEqual(M.measures(s)[0].filter((ev) => M.onsets(M.measures(s)[0])[M.measures(s)[0].indexOf(ev)] >= 48).map((ev) => ev.n).sort(), [37, 38, 39]);
});

test('lo que no entra rebalsa al compas siguiente, sin perder lo que ya habia', () => {
  const s = M.emptyScore();
  s.rows[0][0] = row(['q', 37, 0], ['q', 38, 24], ['q', 39, 48], ['q', 40, 72]);
  s.rows[0][1] = row(['q', 50, 0]);
  const created = M.duplicateSelection(s, [{ mi: 0, i: 2 }, { mi: 0, i: 3 }]);
  assert.equal(created.length, 2);
  assert.deepEqual(ns(s, 0), [37, 38, 39, 40]);
  assert.deepEqual(ns(s, 1).sort(), [39, 40, 50].sort());
  assert.deepEqual(created.map((r) => r.mi), [1, 1]);
});

test('la seleccion en varios compases se copia junta y agrega compases si hace falta', () => {
  const s = M.emptyScore();
  const last = M.measures(s).length - 1;
  const end = s.rows.at(-1);
  end[end.length - 2] = row(['h', 37, 0], ['h', 38, 48]);
  end[end.length - 1] = row(['w', 39, 0]);
  const before = M.measures(s).length;
  const created = M.duplicateSelection(s, [{ mi: last - 1, i: 0 }, { mi: last - 1, i: 1 }, { mi: last, i: 0 }]);
  assert.equal(created.length, 3);
  assert.ok(M.measures(s).length >= before + 2);
  assert.deepEqual(ns(s, last + 1), [37, 38]);
  assert.deepEqual(ns(s, last + 2), [39]);
});

test('una figura que cruza la barra se parte y queda ligada', () => {
  const s = M.emptyScore();
  s.rows[0][0] = row(['q', 37, 0], ['h', 38, 24], ['q', 39, 72]);
  M.duplicateSelection(s, [{ mi: 0, i: 1 }]);
  const [first, second] = [M.measures(s)[0], M.measures(s)[1]];
  const head = first.find((ev) => ev.n === 38 && ev.at === 72);
  assert.ok(head.tie);
  assert.equal(head.d, 'q');
  assert.equal(second.length, 1);
  assert.equal(second[0].n, 38);
  assert.equal(second[0].d, 'q');
});

test('misma altura y duracion se ignora; misma altura y otra duracion actualiza', () => {
  const s = M.emptyScore();
  s.rows[0][0] = row(['q', 37, 0], ['q', 38, 24], ['q', 39, 48], ['q', 40, 72]);
  s.rows[0][1] = row(['q', 39, 0]);
  const created = M.duplicateSelection(s, [{ mi: 0, i: 2 }, { mi: 0, i: 3 }]);
  assert.deepEqual(ns(s, 1).sort(), [39, 40]);
  assert.equal(created.length, 2);
  const u = M.emptyScore();
  u.rows[0][0] = row(['h', 37, 0], ['h', 38, 48]);
  u.rows[0][1] = row(['q', 37, 0]);
  M.duplicateSelection(u, [{ mi: 0, i: 0 }, { mi: 0, i: 1 }]);
  const second = M.measures(u)[1];
  assert.equal(second.filter((ev) => ev.n === 37).length, 1);
  assert.equal(second.find((ev) => ev.n === 37).d, 'h');
});

test('duplicar copia la digitacion de la TAB y las ligaduras', () => {
  const s = M.emptyScore();
  s.rows[0][0] = row(['q', 37, 0, { tie: true }], ['q', 37, 24]);
  const column = [null, null, null, null, 5, null];
  s.tabs = { '0:0': column };
  const created = M.duplicateSelection(s, [{ mi: 0, i: 0 }, { mi: 0, i: 1 }]);
  assert.equal(created.length, 2);
  assert.ok(M.measures(s)[0].some((ev) => ev.at === 48 && ev.tie));
  assert.deepEqual(s.tabs['0:48'], column);
  assert.deepEqual(s.tabs['0:0'], column);
});

test('duplicar conserva el sonido aunque el compas cambie su alteracion', () => {
  const s = M.emptyScore();
  s.rows[0][0] = row(['q', 37, 0], ['q', 37, 24, { acc: '#' }]);
  const [copy] = M.duplicateSelection(s, [{ mi: 0, i: 0 }]);
  assert.equal(M.measures(s)[0][copy.i].acc, 'n');
});
