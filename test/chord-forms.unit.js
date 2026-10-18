/* Formas de acorde estaticas. Run: node --test test/chord-forms.unit.js */

const test = require('node:test');
const assert = require('node:assert/strict');
const { fullForm, chordFingers, diagramSvg } = require('../scripts/lib/chord-forms');

test('la Forma completa sale de la base de acordes, cuerda 1 primero', () => {
  assert.deepEqual(fullForm('G7'), [1, 0, 0, 0, 2, 3]);
  assert.deepEqual(fullForm('C'), [0, 1, 0, 2, 3, null]);
  assert.deepEqual(fullForm('Am'), [0, 1, 2, 2, 0, null]);
  assert.deepEqual(fullForm('E7'), [0, 0, 1, 0, 2, 0]);
});

test('un acorde fuera de la base falla', () => {
  assert.throws(() => fullForm('Zm'), /fuera de la base/);
});

test('el diagrama es SVG estatico: un dedo por nota pisada y marcadores arriba', () => {
  const svg = diagramSvg(chordFingers('C'), 'Diagrama de C');
  assert.ok(svg.startsWith('<svg'));
  assert.equal((svg.match(/class="finger"/g) || []).length, 3);
  assert.equal((svg.match(/class="open"/g) || []).length, 2);
  assert.equal((svg.match(/class="muted"/g) || []).length, 1);
  assert.ok(!svg.includes('<script'));
});
