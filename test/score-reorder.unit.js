'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/site/score-model');
const fixture = () => ({ ...M.emptyScore(), rows: Array.from({ length: 3 }, (_, r) => Array.from({ length: 4 }, (_, i) => [{ n: 28 + r * 4 + i, d: 'q', at: 0 }])) });
const order = (s) => M.measures(s).map((m) => m[0].n - 28);

test('interior drops cascade across rows in both directions without changing row sizes', () => {
  const s = fixture();
  assert.equal(M.moveMeasure(s, 1, 7), true);
  assert.deepEqual(order(s), [0, 2, 3, 4, 5, 6, 1, 7, 8, 9, 10, 11]);
  assert.deepEqual(s.rows.map((r) => r.length), [4, 4, 4]);
  assert.equal(M.moveMeasure(s, 6, 1), true);
  assert.deepEqual(order(s), Array.from({ length: 12 }, (_, i) => i));
  assert.equal(M.moveMeasure(s, 2, 3), false);
  assert.equal(M.moveMeasure(s, -1, 0), false);
});

test('an end drop that fits adds a fifth measure, and survives storage', () => {
  const s = fixture();
  M.moveMeasure(s, 5, 4, 0);
  assert.deepEqual(s.rows.map((r) => r.length), [5, 3, 4]);
  assert.deepEqual(order(s), [0, 1, 2, 3, 5, 4, 6, 7, 8, 9, 10, 11]);
  assert.deepEqual(M.sanitize(s).rows, s.rows);
  assert.equal(M.moveMeasure({ ...s, rows: [[[]], [[], []]] }, 0, 3, 1), false);
});

test('reordering retains each measure context, marks, duration, width and TAB', () => {
  const s = fixture();
  s.meters = { 4: '3/4' }; s.keys = { 4: 2 }; s.clefs = { 4: 'bass' };
  s.navigation = { 4: { segno: true } }; s.barlines = { 4: { end: true } };
  s.measureDurations = { 4: 24 }; s.measureWidths = { 4: 0.2 };
  s.tabs = { '4:0': [null, null, 2, null, null, null] };
  const contexts = M.measures(s).map((_, i) => [M.meterAt(s, i), M.keyAt(s, i), M.clefAt(s, i)]);
  M.moveMeasure(s, 4, 0);
  order(s).forEach((old, mi) => assert.deepEqual([M.meterAt(s, mi), M.keyAt(s, mi), M.clefAt(s, mi)], contexts[old]));
  assert.deepEqual(s.navigation, { 0: { segno: true } });
  assert.deepEqual(s.barlines, { 0: { end: true } });
  assert.deepEqual(s.measureDurations, { 0: 24 });
  assert.deepEqual(s.measureWidths, { 0: 0.2 });
  assert.deepEqual(s.tabs, { '0:0': [null, null, 2, null, null, null] });
});

test('links retain their endpoints only while the original measures remain adjacent', () => {
  const s = fixture();
  s.rows[0][0][0].slur = true;
  s.barres = { 0: { at: 0, fret: 3, span: 1, to: 24 } };
  M.moveMeasure(s, 0, 5);
  assert.equal(M.measures(s)[4][0].slur, undefined);
  assert.deepEqual(s.barres, { 4: { at: 0, fret: 3 } });
});
