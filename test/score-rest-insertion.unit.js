const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/site/score-model.js');

for (const bassDuration of ['e', 'q']) {
  for (const beforeFirst of [true, false]) {
    test(`prepend bass rest: ending=${bassDuration}, beforeFirst=${beforeFirst}`, () => {
      const score = { ...M.emptyScore(), clef: 'guitar', meter: '6/8', fifths: -1 };
      const measure = [
        { d: 'e', rest: true, v: 1, at: 0 },
        { d: 'e', n: 28, v: 2, at: 0 },
        { d: 'e', n: 33, v: 1, at: 12 },
        { d: 'e', n: 35, v: 1, at: 24 },
        { d: 'e', n: 28, v: 1, at: 24 },
        { d: 'e', n: 40, v: 1, at: 36 },
        { d: 'e', n: 39, v: 1, at: 48 },
        { d: bassDuration, n: 24, v: 2, at: 48 },
        { d: 'e', n: 41, tie: true, v: 1, at: 60 },
      ];
      const original = structuredClone(measure);
      const placed = M.placeRest(measure, { d: 'e', rest: true }, 0, 28, score, 0, beforeFirst);
      assert.ok(placed.measure, 'the bass has room for an eighth rest');
      assert.deepEqual(measure, original, 'planning must not change the score');
      assert.equal(placed.measure[placed.index].v, 2);
      assert.deepEqual(placed.measure.filter(ev => ev.v === 1), original.filter(ev => ev.v === 1));
      assert.deepEqual(placed.measure.filter(ev => ev.v === 2).map(ev => [ev.rest || false, ev.at]), [[true, 0], [false, 12], [false, 48]]);
      assert.equal(M.measureLength(placed.measure), 72);
    });
  }
}

test('prepending still rejects a voice that is already full without mutating it', () => {
  const measure = Array.from({ length: 6 }, (_, i) => ({ d: 'e', n: 28 + i, v: 1, at: i * 12 }));
  const original = structuredClone(measure);
  assert.deepEqual(M.placeRest(measure, { d: 'e', rest: true }, 0, 28, { meter: '6/8' }, 0, true), { full: true });
  assert.deepEqual(measure, original);
});
