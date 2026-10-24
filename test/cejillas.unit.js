/* Cejillas impresas en las partituras: Sagreras («₵N»), Santisteban («b_II», «B_IV») y Aguado («Barré», «C.VII»).
   Run: node --test test/cejillas.unit.js
   Contrato: cada fuente curada lleva una marca «C n» / «½C n» con su linea punteada por cejilla (texto, inicio y fin), y el
   MusicXML publicado conserva las mismas marcas con su linea. El motor (backend/engine/test_barres.py) cubre la TAB. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const MARK = /<words>(½?C \d+)<\/words>/g;

/* Cejillas de cada leccion de Sagreras (lo que imprime Marieh: lecciones 55, 74, 76 y 79 a 86). */
const SAGRERAS = { 55: ['C 3'], 74: ['C 5', 'C 5'], 76: ['C 2', 'C 2'], 79: ['C 2'], 80: ['C 2'], 81: ['C 2', 'C 3', 'C 2', 'C 3'],
  82: ['C 4', 'C 4'], 83: ['C 2', 'C 2', 'C 2'], 84: ['C 5', 'C 4'], 85: ['C 2'], 86: ['C 2', 'C 7', 'C 2', 'C 2', 'C 5'] };

function marks(xml) {
  return [...xml.matchAll(MARK)].map((m) => m[1]).sort();
}

test('Sagreras: cada fuente lleva las cejillas del libro, con linea punteada', () => {
  for (const [lesson, expected] of Object.entries(SAGRERAS)) {
    const xml = read('scripts', 'sagreras', 'sources', `${String(lesson).padStart(2, '0')}.musicxml`);
    assert.deepEqual(marks(xml), [...expected].sort(), `leccion ${lesson}`);
    assert.equal((xml.match(/<dashes type="start"/g) || []).length, expected.length, `leccion ${lesson}: inicios`);
    assert.equal((xml.match(/<dashes type="stop"/g) || []).length, expected.length, `leccion ${lesson}: finales`);
  }
});

test('Sagreras: el MusicXML publicado conserva las cejillas', () => {
  for (const [lesson, expected] of Object.entries(SAGRERAS)) {
    const xml = read('downloads', 'sagreras-lecciones', `Lesson ${lesson} - Julio Salvador Sagreras.musicxml`);
    assert.deepEqual(marks(xml), [...expected].sort(), `leccion ${lesson}`);
    assert.equal((xml.match(/<bracket [^>]*type="start"/g) || []).length, expected.length, `leccion ${lesson}: lineas`);
  }
});

test('Sagreras: las lecciones sin cejilla en el libro no llevan ninguna', () => {
  for (const file of fs.readdirSync(path.join(root, 'scripts', 'sagreras', 'sources'))) {
    const lesson = Number(file.slice(0, 2));
    if (SAGRERAS[lesson]) continue;
    assert.deepEqual(marks(read('scripts', 'sagreras', 'sources', file)), [], `leccion ${lesson}`);
  }
});

test('Santisteban: los preludios 5 a 16 llevan las cejillas de barres.json (cada marca vale hasta la siguiente)', () => {
  const spans = JSON.parse(read('scripts', 'carcassi-preludios', 'santisteban', 'barres.json'));
  assert.deepEqual(Object.keys(spans).map(Number), [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  for (const [number, list] of Object.entries(spans)) {
    const xml = read('scripts', 'carcassi-preludios', 'santisteban', `prelude-${String(number).padStart(2, '0')}.musicxml`);
    const expected = list.map((s) => (s.strings === 3 ? '½' : '') + `C ${s.fret}`).sort();
    assert.deepEqual(marks(xml), expected, `preludio ${number}`);
    for (const s of list) {
      assert.ok(s.end_bar > s.bar || s.end_at > s.at, `preludio ${number}: cejilla sin extension en el compas ${s.bar}`);
    }
  }
});

test('Aguado: las piezas con Barré/Ceja/C.n llevan cejillas y las demas ninguna', () => {
  const withBarre = { 2: 1, 8: 3, 10: 5, 15: 9, 16: 4, 17: 4, 18: 2, 19: 2, 20: 3 };
  for (const file of fs.readdirSync(path.join(root, 'scripts', 'aguado', 'sources'))) {
    const n = Number(file.slice(0, 2));
    const xml = read('scripts', 'aguado', 'sources', file);
    assert.equal(marks(xml).length, withBarre[n] || 0, `pieza ${n}`);
    assert.equal((xml.match(/<dashes type="stop"/g) || []).length, withBarre[n] || 0, `pieza ${n}: finales`);
  }
});
