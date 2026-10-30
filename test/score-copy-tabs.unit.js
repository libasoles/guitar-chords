const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/site/score-model');
const column = [null, 5, null, null, null, null];
const copy = (s, refs, columns) => JSON.parse(JSON.stringify(M.copySelection(s, refs, columns)));

test('copiar y pegar conserva la TAB serializada y permite repetir el pegado', () => {
  const s = M.emptyScore();
  s.rows[0][0] = [{ d: 'q', n: 37, at: 0 }];
  s.tabs = { '0:0': column.slice() };
  const f = copy(s, [{ mi: 0, i: 0 }]);
  for (const mi of [1, 11]) {
    assert.ok(M.pasteSelection(s, f, mi));
    assert.deepEqual(s.tabs[mi + ':0'], column);
  }
  s.tabs['1:0'][1] = 9;
  assert.deepEqual(s.tabs['0:0'], column);
  assert.deepEqual(s.tabs['11:0'], column);
});

test('copiar parte de un acorde conserva solo las cuerdas elegidas de la TAB visible', () => {
  const s = M.emptyScore();
  s.rows[0][0] = [{ d: 'q', n: 37, at: 0 }, { d: 'q', n: 35, at: 0 }];
  const f = copy(s, [{ mi: 0, i: 1 }], { '0:0': [0, null, 5, null, null, null] });
  M.pasteSelection(s, f, 2);
  assert.deepEqual(s.tabs['2:0'], [null, null, 5, null, null, null]);
});

test('pegar conserva la TAB del destino al reunir notas en un acorde', () => {
  const s = M.emptyScore();
  s.rows[0][0] = [{ d: 'q', n: 37, at: 0 }];
  s.rows[0][1] = [{ d: 'q', n: 35, at: 0 }, { d: 'q', n: 34, at: 24 }];
  s.tabs = { '0:0': [0, null, null, null, null, null], '1:0': [null, 1, null, null, null, null], '1:24': [null, 0, null, null, null, null] };
  const f = copy(s, [{ mi: 0, i: 0 }]);
  assert.ok(M.pasteSelection(s, f, 1));
  assert.deepEqual(s.tabs['1:0'], [0, 1, null, null, null, null]);
  assert.deepEqual(s.tabs['1:24'], [null, 0, null, null, null, null]);
});

test('pegar sin espacio tampoco modifica las tablaturas', () => {
  const s = M.emptyScore();
  s.rows[0][0] = [{ d: 'w', n: 37, at: 0 }];
  s.rows[0][1] = [{ d: 'q', n: 35, at: 0 }];
  s.tabs = { '0:0': column };
  s.measureDurations = { 1: 48 };
  const before = M.clone(s);
  assert.equal(M.pasteSelection(s, copy(s, [{ mi: 0, i: 0 }]), 1), null);
  assert.deepEqual(s, before);
});

test('los fragmentos anteriores y las entradas TAB invalidas se pueden pegar', () => {
  const s = M.emptyScore();
  s.rows[0][0] = [{ d: 'q', n: 37, at: 0 }];
  const f = copy(s, [{ mi: 0, i: 0 }]);
  delete f.tabs;
  assert.ok(M.pasteSelection(s, f, 1));
  f.tabs = [null, { notes: [null], column: [5] }, { notes: [{ mi: 99, i: 0, midi: 64 }], column: [5] }];
  assert.ok(M.pasteSelection(s, f, 2));
  assert.equal(s.tabs, undefined);
});
