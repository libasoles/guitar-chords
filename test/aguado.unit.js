/* Artefactos publicados de las Partituras de Aguado (downloads/aguado).
   Run: node --test test/aguado.unit.js
   Contrato: cada pieza publicada tiene PDF y MusicXML con el mismo nombre base, el MusicXML es legible, con
   notacion y TAB y los compases de la fuente curada, y la pieza lleva el nombre de pieces.json. Independencia:
   ningun archivo conserva rastros de los MuseScore ni de los PDF de TabGuitar y el PDF lleva los metadatos fijados. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const catalog = require('../scripts/lib/article-aguado');

/* Compases de cada pieza, contados sobre la fuente curada (la partitura del libro; la anacrusa cuenta como compas). */
const MEASURES = { 1: 19, 2: 16, 3: 16, 4: 24, 5: 24, 6: 24, 7: 16, 8: 16, 9: 24, 10: 35, 11: 41, 13: 24, 14: 16, 15: 16, 16: 17, 17: 16, 18: 16, 19: 18, 20: 32, 21: 16 };

/* Cadenas de los archivos de origen: programa, editor y textos por defecto de MuseScore. */
const SOURCE_TRACES = [/MuseScore/i, /TabGuitar/i, /tabguitar\.it/i, /\.mscz/i, /Boije/i, /Borgognoni/i];
// El PDF si lleva el credito a TabGuitar (pie con enlace); lo demas de la fuente no.
const PDF_TRACES = SOURCE_TRACES.filter((trace) => !/TabGuitar|tabguitar|Borgognoni/i.test(trace.source));

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

test('hay al menos una pieza publicada y salen en el orden del libro', () => {
  assert.ok(pieces.length > 0);
  const rank = { lesson: 0, righthand: 1, study: 2 };
  const order = pieces.map((p) => [rank[p.kind], parseInt(p.n, 10)]);
  assert.deepEqual(order, [...order].sort((a, b) => a[0] - b[0] || a[1] - b[1]));
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
    const uris = [...text.matchAll(/\/URI\s*\(((?:\\.|[^\\)])*)\)/g)]
      .map((m) => m[1].replace(/\\(\d{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8))));
    if (piece.credit) {
      // Transcrita a mano del facsimil de IMSLP: el pie cita el libro, no a TabGuitar.
      assert.doesNotMatch(text, /TabGuitar/);
      assert.ok(uris.includes(piece.credit_url), 'enlace al facsimil de origen');
    } else {
      assert.match(text, /\(Con modificaciones a partir de\)/);
      assert.match(text, /\(Luigi Borgognoni \\\(TabGuitar\\\)\)/);
      assert.ok(uris.includes('https://www.tabguitar.it/autori/aguado-metodi-e-studi/'), 'enlace a la transcripcion de origen');
    }
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
