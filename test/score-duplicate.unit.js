const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/site/score-model');

test('duplicar copia las figuras elegidas en el resto del mismo compas', () => {
  const s = M.emptyScore();
  s.rows[0][0] = [{ d: 'q', n: 37, at: 0 }, { d: 'q', n: 38, at: 24 }];
  const created = M.duplicateInMeasure(s, [{ mi: 0, i: 0 }, { mi: 0, i: 1 }]);
  assert.equal(created.length, 2);
  assert.deepEqual(M.measures(s)[0].map((ev) => ev.n), [37, 38, 37, 38]);
  assert.deepEqual(M.onsets(M.measures(s)[0]), [0, 24, 48, 72]);
});

test('duplicar conserva el sonido de una nota aunque el compas cambie su alteracion', () => {
  const s = M.emptyScore();
  s.rows[0][0] = [{ d: 'q', n: 37, at: 0 }, { d: 'q', n: 37, at: 24, acc: '#' }];
  const [copy] = M.duplicateInMeasure(s, [{ mi: 0, i: 0 }]);
  const ctx = M.pitchContexts ? M.pitchContexts(s, 0) : null;
  assert.equal(copy.i, 2);
  assert.equal(M.measures(s)[0][2].acc, 'n');
  if (ctx) assert.equal(ctx[2].alter, 0);
});

test('duplicar no cambia nada si la copia no entra en el compas', () => {
  const s = M.emptyScore();
  s.rows[0][0] = [{ d: 'h', n: 37, at: 0 }, { d: 'q', n: 38, at: 48 }];
  const before = JSON.stringify(s);
  assert.equal(M.duplicateInMeasure(s, [{ mi: 0, i: 0 }]), null);
  assert.equal(JSON.stringify(s), before);
});
