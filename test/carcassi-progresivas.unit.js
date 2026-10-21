/* Artefactos publicados de las Piezas progresivas de Carcassi (downloads/carcassi-progresivas).
   Run: node --test test/carcassi-progresivas.unit.js
   Contrato: cada pieza publicada tiene PDF y MusicXML con el mismo nombre base, el MusicXML es legible, con
   notacion y TAB y los compases del libro, y la pieza lleva el nombre de pieces.json. Independencia: ningun
   archivo conserva rastros de los MuseScore ni de los PDF del canal de origen y el PDF lleva los metadatos fijados. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const catalog = require('../scripts/lib/article-carcassi-progressive');

/* Compases de cada pieza, contados sobre la partitura del libro; las anacrusas de cada seccion cuentan como compas. */
const MEASURES = { 1: 18, 2: 44, 3: 27, 4: 27, 5: 35, 6: 35, 7: 24, 8: 27, 9: 18, 10: 40, 11: 26, 12: 27, 13: 27, 14: 16, 15: 27, 16: 22, 17: 38, 18: 18, 19: 39, 20: 34, 21: 65, 22: 30, 23: 66, 24: 27, 25: 28, 26: 27, 27: 27, 28: 27, 29: 44, 30: 34, 31: 34, 32: 26, 33: 54 };

/* Cadenas de los archivos de origen: programa, canal y textos por defecto de MuseScore. */
const SOURCE_TRACES = [/MuseScore/i, /Guitar Notes/i, /guitar-notes/i, /\.mscz/i, /작곡가/, /이름 없는/, /Carcassi Op\.59/];

function assertWellFormed(xml) {
  const stack = [];
  const tags = xml.replace(/<!--[\s\S]*?-->/g, '').replace(/<\?[\s\S]*?\?>/g, '').replace(/<!DOCTYPE[^>]*>/g, '');
  for (const m of tags.matchAll(/<(\/?)([A-Za-z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g)) {
    if (m[4]) continue;
    if (m[1]) assert.equal(stack.pop(), m[2], 'etiqueta sin cerrar: ' + m[2]);
    else stack.push(m[2]);
  }
  assert.deepEqual(stack, [], 'etiquetas sin cerrar');
}

/* Compases de la parte y pentagramas que declara (notacion + TAB comparten parte). */
function scoreShape(xml) {
  const part = xml.match(/<part id="[^"]*">([\s\S]*?)<\/part>/)[1];
  return { parts: (xml.match(/<part id=/g) || []).length, measures: (part.match(/<measure\b/g) || []).length,
    staves: Number((part.match(/<staves>(\d+)<\/staves>/) || [])[1]) };
}

const pieces = catalog.publishedPieces();
const { DOWNLOADS_DIR, PREVIEW_DIR, SCORE_PREFIX, PIECES } = catalog;

test('hay al menos una pieza publicada y salen en orden numerico', () => {
  assert.ok(pieces.length > 0);
  assert.deepEqual(pieces.map((p) => p.number), pieces.map((p) => p.number).sort((a, b) => a - b));
});

for (const piece of pieces) {
  test('pieza ' + piece.number + ': PDF y MusicXML con el nombre de pieces.json', () => {
    assert.equal(piece.form, PIECES[piece.number].form);
    assert.ok(fs.existsSync(path.join(DOWNLOADS_DIR, piece.base + '.pdf')));
    assert.ok(fs.existsSync(path.join(DOWNLOADS_DIR, piece.base + '.musicxml')));
  });

  test('pieza ' + piece.number + ': MusicXML legible, con notacion y TAB y los compases del libro', () => {
    const xml = fs.readFileSync(path.join(DOWNLOADS_DIR, piece.base + '.musicxml'), 'utf8');
    assertWellFormed(xml);
    const shape = scoreShape(xml);
    assert.equal(shape.staves, 2, 'notacion + pentagrama TAB');
    assert.equal(shape.measures, MEASURES[piece.number], 'compases en el libro');
  });

  test('pieza ' + piece.number + ': vista previa de un sistema con partitura y TAB', () => {
    const svg = fs.readFileSync(path.join(PREVIEW_DIR, SCORE_PREFIX + String(piece.number).padStart(2, '0') + '.svg'), 'utf8');
    assertWellFormed(svg);
    assert.equal((svg.match(/ class="system"/g) || []).length, 1);
    const measures = (svg.match(/ class="measure"/g) || []).length;
    assert.ok(measures > 0);
    assert.equal((svg.match(/ class="staff"/g) || []).length, measures * 2);
    assert.match(svg, / class="tabGrp"/);
  });

  test('pieza ' + piece.number + ': independiente de los archivos de origen', () => {
    const pdf = fs.readFileSync(path.join(DOWNLOADS_DIR, piece.base + '.pdf'));
    const xml = fs.readFileSync(path.join(DOWNLOADS_DIR, piece.base + '.musicxml'), 'utf8');
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    const text = pdf.toString('latin1');
    for (const trace of SOURCE_TRACES) {
      assert.doesNotMatch(text, trace, 'PDF: ' + trace);
      assert.doesNotMatch(xml, trace, 'MusicXML: ' + trace);
    }
    const title = 'Progressive Piece ' + piece.number + ': ' + piece.form;
    const info = text.match(/\/Title\s*\(((?:\\.|[^\\)])*)\)/);
    assert.ok(info, 'el PDF declara /Title');
    // El PDF escapa algunos caracteres (p. ej. : como \072).
    assert.equal(info[1].replace(/\\(\d{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8))).replace(/\\([()\\])/g, '$1'), title);
    assert.ok(xml.includes('<work-title>' + title + '</work-title>'));
    assert.match(text, /\/Author\s*\(Matteo Carcassi\)/);
    assert.doesNotMatch(text, /\/Producer|\/Creator|\/CreationDate|\/ModDate/);
    assert.doesNotMatch(text, /<x:xmpmeta|\/Metadata/);
    assert.doesNotMatch(xml, /<encoding>|<software>|<rights>|<source>|<encoding-date>/);
  });
}
