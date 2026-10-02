/* Unit tests for note-match.js. Run: node test/note-match.unit.js */

const test = require('node:test');
const assert = require('node:assert/strict');

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { pitchClass, chordPitchClasses, soundingFrets, voicingNotes, toMask, matchByNotes } = require('../src/shared/note-match.js');

// chords-db.js y chord-positions.js son scripts de navegador (window.*).
function loadBrowserScript(file) {
  const fakeWindow = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/shared', file), 'utf8'), { window: fakeWindow });
  return fakeWindow;
}
const CHORDS = loadBrowserScript('chords-db.js').CHORDS;
const { getPositions } = loadBrowserScript('chord-positions.js').ChordPositions;
const chordsByName = Object.fromEntries(CHORDS.map((c) => [c.name, c]));

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

test('soundingFrets: cejilla como piso, dedos la pisan, x silencia', () => {
  const frets = soundingFrets([[6, 'x'], [4, 3], [1, 'o']], [{ fromString: 5, toString: 1, fret: 1 }]);
  assert.deepEqual(frets, { 1: 0, 2: 1, 3: 1, 4: 3, 5: 1 });
});

test('voicingNotes: notas que suenan de la 6ª a la 1ª, sin cuerdas mudas', () => {
  const f6 = chordsByName.F6;
  assert.deepEqual(voicingNotes(f6, f6).map((n) => n.note), ['F', 'A', 'D', 'F']);
  const f = chordsByName.F; // cejilla en el traste 1 que cubre las cuerdas sin dedo
  assert.deepEqual(voicingNotes(f, f).map((n) => n.note), ['F', 'C', 'F', 'A', 'C', 'F']);
});

test('toMask: clases de altura → máscara de 12 bits', () => {
  assert.equal(toMask([0, 4, 7]), 0b10010001);
  assert.equal(toMask([]), 0);
});

test('chords-db: `notes` coincide con lo que suena en la digitación', () => {
  CHORDS.forEach((chord) => {
    const fromNotes = [...chordPitchClasses(chord)].sort((a, b) => a - b);
    const sounding = [...new Set(voicingNotes(chord, chord).map((n) => n.pc))].sort((a, b) => a - b);
    assert.deepEqual(sounding, fromNotes, chord.name);
  });
});

test('matchByNotes: selección vacía → sin resultados', () => {
  assert.deepEqual(matchByNotes([], CHORDS, getPositions), []);
  assert.deepEqual(matchByNotes(new Set(), CHORDS, getPositions), []);
});

test('matchByNotes: Fa-La-Do-Re no trae acordes cuya digitación omite alguna', () => {
  const chords = ['F6', 'B♭maj9', 'Dm9', 'Dm7'].map((n) => chordsByName[n]);
  const result = matchByNotes([5, 9, 0, 2], chords, getPositions);
  assert.deepEqual(result.map((m) => m.chord.name), ['Dm7']);
});

test('matchByNotes: C7 sólo con la cejilla en la 5ª (la abierta omite el Sol)', () => {
  const result = matchByNotes([0, 4, 7, 10], [chordsByName.C7], getPositions);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].positions.map((p) => p.kind), ['barre5']);
  assert.equal(result[0].positions[0].notes, 'C G B♭ E G');
});

test('matchByNotes: devuelve todas las posiciones que matchean', () => {
  const result = matchByNotes([7, 11, 2], [chordsByName.G], getPositions);
  assert.equal(result[0].positions.length, 2);
});

test('matchByNotes: sin getPositions usa sólo la digitación base', () => {
  const result = matchByNotes([0, 4, 7, 10], [chordsByName.C7]);
  assert.deepEqual(result, []);
});

test('matchByNotes: menos notas extra primero', () => {
  const chords = ['Cmaj7', 'C'].map((n) => chordsByName[n]);
  const result = matchByNotes([0, 4, 7], chords);
  assert.deepEqual(result.map((m) => m.chord.name), ['C', 'Cmaj7']);
});

test('matchByNotes: enarmónicos (D♭ y C♯) son la misma clase de altura', () => {
  const result = matchByNotes([1], [chordsByName['D♭']]);
  assert.deepEqual(result.map((m) => m.chord.name), ['D♭']);
});
