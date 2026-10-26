/* Artefactos publicados de las Partituras de Barrios (downloads/barrios).
   Run: node --test test/barrios.unit.js
   Contrato: cada pieza publicada tiene PDF y MusicXML con el mismo nombre base, el MusicXML es legible, con
   notacion y TAB y los compases de la edicion de origen, y la pieza lleva el nombre de pieces.json. Independencia:
   ningun archivo conserva rastros del programa ni de los PDF de Stefan Apke salvo el credito (pie con enlace) que exige
   la licencia CC BY-SA 4.0, y el PDF lleva los metadatos fijados. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const catalog = require('../scripts/lib/article-barrios');

/* Compases de cada pieza, contados sobre la edicion de origen (la anacrusa cuenta como compas). */
const MEASURES = { 1: 24, 2: 44, 3: 31, 5: 72, 6: 32, 8: 47, 12: 25, 13: 40 };

/* Cadenas de los archivos de origen: programa y textos por defecto de MuseScore. */
const SOURCE_TRACES = [/MuseScore/i, /Eingerichtet/i, /Vlotho/i, /\.mscz/i];

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
const { DOWNLOADS_DIR, PREVIEW_DIR, SCORE_PREFIX, AUTHOR } = catalog;

test('hay al menos una pieza publicada y salen en orden numerico', () => {
  assert.ok(pieces.length > 0);
  assert.deepEqual(pieces.map((p) => p.number), pieces.map((p) => p.number).sort((a, b) => a - b));
});

for (const piece of pieces) {
  const label = piece.title;

  test(label + ': PDF y MusicXML con el nombre de pieces.json', () => {
    assert.ok(fs.existsSync(path.join(DOWNLOADS_DIR, piece.base + '.pdf')));
    assert.ok(fs.existsSync(path.join(DOWNLOADS_DIR, piece.base + '.musicxml')));
  });

  test(label + ': MusicXML legible, con notacion y TAB y los compases de la edicion', () => {
    const xml = fs.readFileSync(path.join(DOWNLOADS_DIR, piece.base + '.musicxml'), 'utf8');
    assertWellFormed(xml);
    const shape = scoreShape(xml);
    assert.equal(shape.staves, 2, 'notacion + pentagrama TAB');
    assert.equal(shape.measures, MEASURES[piece.number], 'compases de la edicion');
  });

  test(label + ': vista previa de un sistema con partitura y TAB', () => {
    const svg = fs.readFileSync(path.join(PREVIEW_DIR, SCORE_PREFIX + String(piece.number).padStart(2, '0') + '.svg'), 'utf8');
    assertWellFormed(svg);
    assert.equal((svg.match(/ class="system"/g) || []).length, 1);
    const measures = (svg.match(/ class="measure"/g) || []).length;
    assert.ok(measures > 0);
    assert.equal((svg.match(/ class="staff"/g) || []).length, measures * 2);
    assert.match(svg, / class="tabGrp"/);
  });

  test(label + ': credito a la edicion de origen y metadatos fijados', () => {
    const pdf = fs.readFileSync(path.join(DOWNLOADS_DIR, piece.base + '.pdf'));
    const xml = fs.readFileSync(path.join(DOWNLOADS_DIR, piece.base + '.musicxml'), 'utf8');
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    const text = pdf.toString('latin1');
    for (const trace of SOURCE_TRACES) {
      assert.doesNotMatch(text, trace, 'PDF: ' + trace);
      assert.doesNotMatch(xml, trace, 'MusicXML: ' + trace);
    }
    assert.match(text, /\(Con modificaciones a partir de\)/);
    assert.ok(text.includes('(Stefan Apke \\(' + piece.year + '\\))'), 'credito a Stefan Apke');
    const uris = [...text.matchAll(/\/URI\s*\(((?:\\.|[^\\)])*)\)/g)]
      .map((m) => m[1].replace(/\\(\d{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8))));
    assert.ok(uris.includes('https://creativecommons.org/licenses/by-sa/4.0/'), 'enlace a la licencia');
    assert.ok(uris.some((uri) => uri.startsWith('https://imslp.org/wiki/')), 'enlace a la edicion de origen');
    const info = text.match(/\/Title\s*\(((?:\\.|[^\\)])*)\)/);
    assert.ok(info, 'el PDF declara /Title');
    // El PDF escapa algunos caracteres (p. ej. : como \072).
    assert.equal(info[1].replace(/\\(\d{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8))).replace(/\\([()\\])/g, '$1'), label);
    assert.ok(xml.includes('<work-title>' + label + '</work-title>'));
    assert.match(text, /\/Author/);
    assert.doesNotMatch(text, /\/Producer|\/Creator|\/CreationDate|\/ModDate/);
    assert.doesNotMatch(text, /<x:xmpmeta|\/Metadata/);
    assert.doesNotMatch(xml, /<encoding>|<software>|<rights>|<source>|<encoding-date>/);
    assert.ok(AUTHOR.length > 0);
  });
}
