/* Unit tests for the alternate chord positions shared by the site UI. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadPositions() {
  const src = fs.readFileSync(path.join(__dirname, '../src/shared/chord-positions.js'), 'utf8');
  const fakeWindow = {};
  const factory = vm.runInThisContext('(function(window){' + src + '\nreturn window;})');
  return factory(fakeWindow).ChordPositions;
}

test('dim7 expone las tres formas movibles de la guía', () => {
  const positions = loadPositions().getPositions({
    name: 'Cdim7',
    fingers: [[6, 'x'], [5, 'x'], [4, 10, '1'], [3, 11, '2'], [2, 10, '1'], [1, 11, '3']],
    barres: [], position: 10,
  });

  assert.equal(positions.length, 3);
  assert.equal(positions[0].kind, 'dim4');
  assert.equal(positions[1].kind, 'dim6');
  assert.equal(positions[2].kind, 'dim5');
  assert.deepEqual(positions[1].fingers, [[6, 8, '2'], [5, 'x'], [4, 7, '1'], [3, 8, '3'], [2, 7, '1'], [1, 'x']]);
  assert.deepEqual(positions[2].fingers, [[6, 'x'], [5, 3, '2'], [4, 'x'], [3, 2, '1'], [2, 4, '3'], [1, 2, '1']]);
});

// La forma se escribe de primera a sexta cuerda, como en la interfaz.
test('10200x está disponible para Dm6 y Bm7b5 con La en el bajo', () => {
  const { CHORDS } = require('../src/shared/chords-db.js');
  const { soundingFrets, voicingNotes, toMask } = require('../src/shared/note-match.js');
  const { getPositions } = loadPositions();
  for (const name of ['Dm6', 'Bm7b5']) {
    const chord = CHORDS.find((c) => c.name === name);
    const position = getPositions(chord).find((p) => {
      const frets = soundingFrets(p.fingers, p.barres);
      return [1, 0, 2, 0, 0, undefined].every((fret, i) => frets[i + 1] === fret);
    });
    assert.ok(position, `${name}: falta 10200x`);
    const notes = voicingNotes(chord, position);
    assert.equal(notes[0].pc, 9, 'La es el bajo');
    assert.equal(toMask(notes.map((n) => n.pc)), toMask([11, 2, 5, 9]));
  }
});
