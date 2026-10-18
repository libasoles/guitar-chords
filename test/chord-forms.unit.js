/* Formas de acorde estaticas. Run: node --test test/chord-forms.unit.js */

const test = require('node:test');
const assert = require('node:assert/strict');
const { fullForm, chordFingers, formText, formTab, diagramSvg } = require('../scripts/lib/chord-forms');

test('la Forma completa sale de la base de acordes, cuerda 1 primero', () => {
  assert.equal(formText(fullForm('G7')), '1 0 0 0 2 3');
  assert.equal(formText(fullForm('C')), '0 1 0 2 3 x');
  assert.equal(formText(fullForm('Am')), '0 1 2 2 0 x');
  assert.equal(formText(fullForm('E7')), '0 0 1 0 2 0');
});

test('un acorde fuera de la base falla', () => {
  assert.throws(() => fullForm('Zm'), /fuera de la base/);
});

test('TAB de una columna con x en la cuerda que no suena', () => {
  assert.equal(formTab([1, 0, 0, null, null, 3]), 'e|-1-\nB|-0-\nG|-0-\nD|-x-\nA|-x-\nE|-3-');
});

test('el diagrama es SVG estatico: un dedo por nota pisada y marcadores arriba', () => {
  const svg = diagramSvg(chordFingers('C'), 'Diagrama de C');
  assert.ok(svg.startsWith('<svg'));
  assert.equal((svg.match(/class="finger"/g) || []).length, 3);
  assert.equal((svg.match(/class="open"/g) || []).length, 2);
  assert.equal((svg.match(/class="muted"/g) || []).length, 1);
  assert.ok(!svg.includes('<script'));
});
