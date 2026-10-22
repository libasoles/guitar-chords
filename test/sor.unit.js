/* Artefactos publicados de las Lecciones progresivas de Sor (downloads/sor).
   Run: node --test test/sor.unit.js
   Contrato: cada pieza publicada tiene PDF y MusicXML con el mismo nombre base, el MusicXML es legible, con
   notacion y TAB y los compases de la fuente curada, y la pieza lleva el nombre de pieces.json. Independencia:
   ningun archivo conserva rastros del LilyPond de origen (programa, rutas) y el PDF lleva los metadatos fijados y el
   credito a la edicion de Mutopia con su licencia. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const catalog = require('../scripts/lib/article-sor');

/* Compases de cada pieza, contados sobre la fuente curada (la partitura del libro; la anacrusa cuenta como compas). */
const MEASURES = { 1: 16, 2: 40, 3: 24, 4: 26, 5: 40, 6: 36, 7: 44, 8: 16, 9: 16, 10: 17, 11: 32, 12: 27, 13: 24 };

/* Cadenas del archivo de origen: programa, rutas y textos de la cabecera de LilyPond. */
const SOURCE_TRACES = [/LilyPond/i, /\.ly\b/i, /fernandosor\.free\.fr/i, /mutopiatitle/i];
// El PDF si lleva el credito a Mutopia (pie con enlace); el MusicXML no lleva rastros.
const PDF_TRACES = SOURCE_TRACES;

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
  const label = catalog.pieceName(piece, 'en');

  test(label + ': PDF y MusicXML con el nombre de pieces.json', () => {
    assert.ok(fs.existsSync(path.join(DOWNLOADS_DIR, piece.base + '.pdf')));
    assert.ok(fs.existsSync(path.join(DOWNLOADS_DIR, piece.base + '.musicxml')));
  });

  test(label + ': MusicXML legible, con notacion y TAB y los compases de la fuente', () => {
    const xml = fs.readFileSync(path.join(DOWNLOADS_DIR, piece.base + '.musicxml'), 'utf8');
    assertWellFormed(xml);
    const shape = scoreShape(xml);
    assert.equal(shape.staves, 2, 'notacion + pentagrama TAB');
    assert.equal(shape.measures, MEASURES[piece.number], 'compases de la fuente');
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

  test(label + ': independiente de los archivos de origen', () => {
    const pdf = fs.readFileSync(path.join(DOWNLOADS_DIR, piece.base + '.pdf'));
    const xml = fs.readFileSync(path.join(DOWNLOADS_DIR, piece.base + '.musicxml'), 'utf8');
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    const text = pdf.toString('latin1');
    for (const trace of PDF_TRACES) assert.doesNotMatch(text, trace, 'PDF: ' + trace);
    for (const trace of SOURCE_TRACES) assert.doesNotMatch(xml, trace, 'MusicXML: ' + trace);
    assert.match(text, /\(Con modificaciones a partir de la edicion de [^)]+ en Mutopia\)/);
    assert.match(text, /\(CC BY-SA [23]\.[05]\)/);
    const uris = [...text.matchAll(/\/URI\s*\(((?:\\.|[^\\)])*)\)/g)]
      .map((m) => m[1].replace(/\\(\d{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8))));
    assert.ok(uris.includes('https://www.mutopiaproject.org/cgibin/make-table.cgi?Composer=SorF'), 'enlace a la edicion de origen');
    assert.ok(uris.some((uri) => /^https:\/\/creativecommons\.org\/licenses\/by-sa\/[23]\.[05]\/$/.test(uri)), 'enlace a la licencia');
    const info = text.match(/\/Title\s*\(((?:\\.|[^\\)])*)\)/);
    assert.ok(info, 'el PDF declara /Title');
    // El PDF escapa algunos caracteres (p. ej. : como \072).
    assert.equal(info[1].replace(/\\(\d{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8))).replace(/\\([()\\])/g, '$1'), label);
    assert.ok(xml.includes('<work-title>' + label + '</work-title>'));
    assert.match(text, new RegExp('/Author\\s*\\(' + AUTHOR + '\\)'));
    assert.doesNotMatch(text, /\/Producer|\/Creator|\/CreationDate|\/ModDate/);
    assert.doesNotMatch(text, /<x:xmpmeta|\/Metadata/);
    assert.doesNotMatch(xml, /<encoding>|<software>|<rights>|<source>|<encoding-date>/);
  });
}
