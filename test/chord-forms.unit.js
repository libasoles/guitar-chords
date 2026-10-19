/* Formas de acorde estaticas. Run: node --test test/chord-forms.unit.js */

const test = require('node:test');
const assert = require('node:assert/strict');
const { fullForm, chordObject, chordCard } = require('../scripts/lib/chord-forms');

test('la Forma completa sale de la base de acordes, cuerda 1 primero', () => {
  assert.deepEqual(fullForm('G7'), [1, 0, 0, 0, 2, 3]);
  assert.deepEqual(fullForm('C'), [0, 1, 0, 2, 3, null]);
  assert.deepEqual(fullForm('Am'), [0, 1, 2, 2, 0, null]);
  assert.deepEqual(fullForm('E7'), [0, 0, 1, 0, 2, 0]);
});

test('un acorde fuera de la base falla', () => {
  assert.throws(() => fullForm('Zm'), /fuera de la base/);
});

test('la tarjeta lleva los datos del acorde para que el sitio la dibuje', () => {
  const html = chordCard(chordObject('C'), 'Diagrama de C');
  assert.match(html, /^<div class="chord-card-slot" data-chord-card /);
  const json = html.match(/data-chord="([^"]*)"/)[1].replace(/&quot;/g, '"');
  const chord = JSON.parse(json);
  assert.equal(chord.name, 'C');
  assert.equal(chord.fingers.length, 6);
  assert.ok(!html.includes('<script'));
});
