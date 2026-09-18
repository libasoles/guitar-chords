/* Unit tests for note-match.js. Run: node test/note-match.unit.js */

const test = require('node:test');
const assert = require('node:assert/strict');

const { pitchClass, chordPitchClasses, chordToneClasses, matchByNotes } = require('../src/shared/note-match.js');

test('pitchClass: naturales y alteraciones', () => {
  assert.equal(pitchClass('C'), 0);
  assert.equal(pitchClass('C♯'), 1);
  assert.equal(pitchClass('D♭'), 1);
  assert.equal(pitchClass('B♭'), 10);
  assert.equal(pitchClass('B'), 11);
  assert.equal(pitchClass('nope'), null);
  assert.equal(pitchClass(''), null);
});

test('chordPitchClasses: colapsa octavas/duplicados a un set único', () => {
  const set = chordPitchClasses({ notes: 'E B E G♯ B E' });
  assert.deepEqual([...set].sort((a, b) => a - b), [4, 8, 11]);
});

test('chordPitchClasses: acorde sin notes → set vacío', () => {
  assert.equal(chordPitchClasses({}).size, 0);
  assert.equal(chordPitchClasses(null).size, 0);
});

test('chordToneClasses: fórmula teórica, no las notas de la digitación', () => {
  // El C7 de chords-db.js es una digitación abierta que omite la 5ª (Sol):
  // notes: 'C E B♭ C E'. La fórmula teórica de C7 SÍ incluye la 5ª.
  const c7 = { name: 'C7', notes: 'C E B♭ C E' };
  assert.deepEqual([...chordToneClasses(c7)].sort((a, b) => a - b), [0, 4, 7, 10]);
});

test('chordToneClasses: acordes con bajo (slash) suman la nota de bajo', () => {
  assert.deepEqual(
    [...chordToneClasses({ name: 'C/E' })].sort((a, b) => a - b),
    [0, 4, 7] // el bajo E ya es la 3ª de C, no agrega nada nuevo
  );
  assert.deepEqual(
    [...chordToneClasses({ name: 'D/F#' })].sort((a, b) => a - b),
    [2, 6, 9] // F# ya es la 3ª de D
  );
  assert.deepEqual(
    [...chordToneClasses({ name: 'C7/B' })].sort((a, b) => a - b),
    [0, 4, 7, 10, 11] // B (bajo) no es una nota de C7 → se suma
  );
});

test('chordToneClasses: calidades varias', () => {
  assert.deepEqual([...chordToneClasses({ name: 'Am' })].sort((a, b) => a - b), [9, 0, 4].sort((a, b) => a - b));
  assert.deepEqual([...chordToneClasses({ name: 'Cdim7' })].sort((a, b) => a - b), [0, 3, 6, 9]);
  assert.deepEqual([...chordToneClasses({ name: 'Caug' })].sort((a, b) => a - b), [0, 4, 8]);
  assert.deepEqual([...chordToneClasses({ name: 'Gsus4' })].sort((a, b) => a - b), [7, 0, 2].sort((a, b) => a - b));
});

test('chordToneClasses: nombre irreconocible cae de vuelta a chordPitchClasses', () => {
  const weird = { name: 'not-a-chord', notes: 'C E G' };
  assert.deepEqual([...chordToneClasses(weird)].sort((a, b) => a - b), [0, 4, 7]);
});

test('matchByNotes: selección vacía → sin resultados', () => {
  const chords = [{ name: 'C', notes: 'C E G' }];
  assert.deepEqual(matchByNotes([], chords), []);
  assert.deepEqual(matchByNotes(new Set(), chords), []);
});

test('matchByNotes: C7 matchea Do-Mi-Sol-Sib pese a que su digitación abierta omite la 5ª', () => {
  const chords = [
    { name: 'C', notes: 'C E G' },
    { name: 'C7', notes: 'C E B♭ C E' },
    { name: 'Em', notes: 'E G B' },
  ];
  // C, E, G, Bb -> pitch classes 0, 4, 7, 10.
  const result = matchByNotes([0, 4, 7, 10], chords);
  assert.deepEqual(result.map((c) => c.name), ['C7']);
});

test('matchByNotes: acordes con notas extra igual matchean (contención, no igualdad)', () => {
  const chords = [
    { name: 'C', notes: 'C E G' },
    { name: 'Cmaj7', notes: 'C E G B' },
    { name: 'C6', notes: 'C E G A' },
  ];
  // Seleccionando sólo C, E, G: los tres califican; el exacto (C) primero.
  const result = matchByNotes([0, 4, 7], chords);
  assert.deepEqual(result.map((c) => c.name), ['C', 'Cmaj7', 'C6']);
});

test('matchByNotes: enarmónicos (D♭ y C♯) son la misma clase de altura', () => {
  const chords = [{ name: 'D♭', notes: 'D♭ A♭ D♭ F A♭' }];
  const result = matchByNotes([1], chords); // 1 = C♯/D♭
  assert.deepEqual(result.map((c) => c.name), ['D♭']);
});
