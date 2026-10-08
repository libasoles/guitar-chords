/* Tablaturas ASCII a columnas del `value` de ascii-tabs. Run: node --test test/ascii-tab.unit.js */

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseAsciiTab } = require('../scripts/lib/ascii-tab');

test('cada columna lista los trastes de la 1ª a la 6ª cuerda', () => {
  const cols = parseAsciiTab([
    'e|-------0',
    'B|--------',
    'G|--------',
    'D|-------2',
    'A|---3----',
    'E|--10----',
  ].join('\n'));
  assert.deepEqual(cols, [
    [null, null, null, null, 3, 10],
    [0, null, null, 2, null, null],
  ]);
});

test('rechaza renglones de distinto largo', () => {
  assert.throws(() => parseAsciiTab('e|----\nB|----\nG|----\nD|----\nA|----\nE|--------'));
});
