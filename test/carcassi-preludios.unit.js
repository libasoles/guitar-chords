/* Artefactos publicados de los Preludios de Carcassi (downloads/carcassi-preludios).
   Run: node --test test/carcassi-preludios.unit.js
   Contrato: cada preludio publicado tiene PDF y MusicXML con el mismo nombre base,
   el MusicXML es legible y trae los compases esperados. Independencia: ningun
   archivo conserva rastros del PDF de origen y el PDF lleva los metadatos fijados. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { publishedPreludes, DOWNLOADS_DIR } = require('../scripts/lib/article-carcassi-preludes');

/* Compases de cada preludio, contados una vez sobre la partitura del libro. */
const MEASURES = { 1: 8, 2: 8, 3: 7, 4: 8, 5: 8, 6: 16, 7: 8, 8: 11, 9: 8, 10: 10 };

/* Cadenas del PDF de origen: nombre del archivo, productor del original, editor, licencia de la edicion. */
const SOURCE_TRACES = [/CarcassiMethod/i, /Ghostscript/i, /Santisteban/i, /Mutopia/i, /LilyPond/i, /Preludes in Progressive/i];

/* Verifica que el XML este bien formado (etiquetas balanceadas); devuelve el texto sin la cabecera. */
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

const preludes = publishedPreludes();

test('hay al menos un preludio publicado y salen en orden numerico', () => {
  assert.ok(preludes.length >= 1);
  assert.deepEqual(preludes.map((p) => p.number), preludes.map((p) => p.number).sort((a, b) => a - b));
});

for (const prelude of preludes) {
  test('preludio ' + prelude.number + ': PDF y MusicXML con el mismo nombre base', () => {
    assert.match(prelude.base, /^Prelude \d+ in [A-G][#b]? (Major|Minor) - Matteo Carcassi$/);
    assert.ok(fs.existsSync(path.join(DOWNLOADS_DIR, prelude.base + '.pdf')));
    assert.ok(fs.existsSync(path.join(DOWNLOADS_DIR, prelude.base + '.musicxml')));
  });

  test('preludio ' + prelude.number + ': MusicXML legible, con notacion y TAB y los compases del libro', () => {
    const xml = fs.readFileSync(path.join(DOWNLOADS_DIR, prelude.base + '.musicxml'), 'utf8');
    assertWellFormed(xml);
    const shape = scoreShape(xml);
    assert.equal(shape.staves, 2, 'notacion + pentagrama TAB');
    assert.equal(shape.measures, MEASURES[prelude.number]);
  });

  test('preludio ' + prelude.number + ': independiente del PDF de origen', () => {
    const pdf = fs.readFileSync(path.join(DOWNLOADS_DIR, prelude.base + '.pdf'));
    const xml = fs.readFileSync(path.join(DOWNLOADS_DIR, prelude.base + '.musicxml'), 'utf8');
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    const text = pdf.toString('latin1');
    for (const trace of SOURCE_TRACES) {
      assert.doesNotMatch(text, trace, 'PDF: ' + trace);
      assert.doesNotMatch(xml, trace, 'MusicXML: ' + trace);
    }
    const info = text.match(/\/Title\s*\(([^)]*)\)/);
    assert.ok(info, 'el PDF declara /Title');
    // El PDF escapa algunos caracteres (p. ej. # como \043).
    const title = info[1].replace(/\\(\d{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)));
    assert.equal(title, prelude.base.split(' - ')[0]);
    assert.match(text, /\/Author\s*\(Matteo Carcassi\)/);
    assert.doesNotMatch(text, /\/Producer|\/Creator|\/CreationDate|\/ModDate/);
    assert.doesNotMatch(text, /<x:xmpmeta|\/Metadata/);
    assert.doesNotMatch(xml, /<encoding>|<software>|<rights>|<source>|<encoding-date>/);
  });
}
