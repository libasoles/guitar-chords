/* Tablaturas ASCII a columnas del editor. Run: node --test test/ascii-tab.unit.js */

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
    ['', '', '', '', '3', '10'],
    ['0', '', '', '2', '', ''],
  ]);
});

test('rechaza renglones de distinto largo', () => {
  assert.throws(() => parseAsciiTab('e|----\nB|----\nG|----\nD|----\nA|----\nE|--------'));
});
