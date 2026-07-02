/* Unit tests for note-names.js. Run: node test/note-names.unit.js */

const test = require('node:test');
const assert = require('node:assert/strict');

const { toSpanishName, toSpanishNotes } = require('../src/shared/note-names.js');

test('toSpanishName: raíces simples', () => {
  assert.equal(toSpanishName('C'), 'Do');
  assert.equal(toSpanishName('D'), 'Re');
  assert.equal(toSpanishName('E'), 'Mi');
  assert.equal(toSpanishName('F'), 'Fa');
  assert.equal(toSpanishName('G'), 'Sol');
  assert.equal(toSpanishName('A'), 'La');
  assert.equal(toSpanishName('B'), 'Si');
});

test('toSpanishName: alteraciones (♯/♭)', () => {
  assert.equal(toSpanishName('C♯'), 'Do♯');
  assert.equal(toSpanishName('A♭'), 'La♭');
  assert.equal(toSpanishName('F#'), 'Fa♯');
  assert.equal(toSpanishName('Bb'), 'Si♭');
});

test('toSpanishName: calidad del acorde queda intacta', () => {
  assert.equal(toSpanishName('Am'), 'Lam');
  assert.equal(toSpanishName('Cmaj7'), 'Domaj7');
  assert.equal(toSpanishName('Bm7b5'), 'Sim7b5');
  assert.equal(toSpanishName('Gsus4'), 'Solsus4');
  assert.equal(toSpanishName('F♯dim7'), 'Fa♯dim7');
});

test('toSpanishName: nota de bajo tras "/"', () => {
  assert.equal(toSpanishName('D/F♯'), 'Re/Fa♯');
  assert.equal(toSpanishName('C/G'), 'Do/Sol');
});

test('toSpanishName: null/undefined/vacío → ""', () => {
  assert.equal(toSpanishName(null), '');
  assert.equal(toSpanishName(undefined), '');
  assert.equal(toSpanishName(''), '');
});

test('toSpanishNotes: lista de notas separadas por espacio', () => {
  assert.equal(toSpanishNotes('C E G'), 'Do Mi Sol');
  assert.equal(toSpanishNotes('D A D F♯'), 'Re La Re Fa♯');
});
