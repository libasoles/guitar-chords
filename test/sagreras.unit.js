/* Artefactos publicados de las Primeras lecciones de Sagreras (downloads/sagreras-lecciones).
   Run: node --test test/sagreras.unit.js
   Contrato: cada leccion publicada tiene PDF y MusicXML con el mismo nombre base, el MusicXML es legible, con
   notacion y TAB y los compases de la edicion de origen. Independencia: ningun archivo conserva rastros del PDF
   de Marieh ni del programa que lo creo y el PDF lleva los metadatos fijados. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const catalog = require('../scripts/lib/article-sagreras');

/* Compases de cada leccion, contados sobre la partitura de la edicion de origen (scripts/sagreras/measures.json). */
const MEASURES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'scripts', 'sagreras', 'measures.json'), 'utf8'));

/* Cadenas de los archivos de origen: programa, transcriptor y marcas de la edicion. */
const SOURCE_TRACES = [/MuseScore/i, /Marieh/i, /Copyleft/i, /\.mscz/i, /IMSLP/i];
// El PDF si lleva la atribucion que exige CC BY-NC 4.0 (pie con enlaces); lo demas de la edicion no.
const PDF_TRACES = SOURCE_TRACES.filter((trace) => !/Marieh|IMSLP/.test(trace.source));

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

test('hay al menos una leccion publicada y salen en orden numerico', () => {
  assert.ok(pieces.length > 0);
  assert.deepEqual(pieces.map((p) => p.number), pieces.map((p) => p.number).sort((a, b) => a - b));
});

for (const piece of pieces) {
  test('leccion ' + piece.number + ': PDF y MusicXML con el mismo nombre', () => {
    assert.ok(fs.existsSync(path.join(DOWNLOADS_DIR, piece.base + '.pdf')));
    assert.ok(fs.existsSync(path.join(DOWNLOADS_DIR, piece.base + '.musicxml')));
  });

  test('leccion ' + piece.number + ': MusicXML legible, con notacion y TAB y los compases del libro', () => {
    const xml = fs.readFileSync(path.join(DOWNLOADS_DIR, piece.base + '.musicxml'), 'utf8');
    assertWellFormed(xml);
    const shape = scoreShape(xml);
    assert.equal(shape.staves, 2, 'notacion + pentagrama TAB');
    assert.equal(shape.measures, MEASURES[piece.number], 'compases de la edicion');
  });

  test('leccion ' + piece.number + ': vista previa de un sistema con partitura y TAB', () => {
    const svg = fs.readFileSync(path.join(PREVIEW_DIR, SCORE_PREFIX + String(piece.number).padStart(2, '0') + '.svg'), 'utf8');
    assertWellFormed(svg);
    assert.equal((svg.match(/ class="system"/g) || []).length, 1);
    const measures = (svg.match(/ class="measure"/g) || []).length;
    assert.ok(measures > 0);
    assert.equal((svg.match(/ class="staff"/g) || []).length, measures * 2);
    assert.match(svg, / class="tabGrp"/);
  });

  test('leccion ' + piece.number + ': independiente de los archivos de origen', () => {
    const pdf = fs.readFileSync(path.join(DOWNLOADS_DIR, piece.base + '.pdf'));
    const xml = fs.readFileSync(path.join(DOWNLOADS_DIR, piece.base + '.musicxml'), 'utf8');
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    const text = pdf.toString('latin1');
    for (const trace of PDF_TRACES) assert.doesNotMatch(text, trace, 'PDF: ' + trace);
    for (const trace of SOURCE_TRACES) assert.doesNotMatch(xml, trace, 'MusicXML: ' + trace);
    assert.match(text, /\(Con modificaciones a partir de\)/);
    assert.match(text, /\(Marieh \\\(2020\\\)\)/);
    assert.match(text, /\(CC BY-NC 4\.0\)/);
    const uris = [...text.matchAll(/\/URI\s*\(((?:\\.|[^\\)])*)\)/g)]
      .map((m) => m[1].replace(/\\(\d{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8))));
    assert.ok(uris.includes('https://creativecommons.org/licenses/by-nc/4.0/'), 'enlace a la licencia');
    assert.ok(uris.some((uri) => uri.startsWith('https://imslp.org/')), 'enlace a la edicion de origen');
    const title = 'Lesson ' + piece.number;
    const info = text.match(/\/Title\s*\(((?:\\.|[^\\)])*)\)/);
    assert.ok(info, 'el PDF declara /Title');
    // El PDF escapa algunos caracteres (p. ej. : como \072).
    assert.equal(info[1].replace(/\\(\d{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8))).replace(/\\([()\\])/g, '$1'), title);
    assert.ok(xml.includes('<work-title>' + title + '</work-title>'));
    assert.match(text, new RegExp('/Author\\s*\\(' + AUTHOR + '\\)'));
    assert.doesNotMatch(text, /\/Producer|\/Creator|\/CreationDate|\/ModDate/);
    assert.doesNotMatch(text, /<x:xmpmeta|\/Metadata/);
    assert.doesNotMatch(xml, /<encoding>|<software>|<rights>|<source>|<encoding-date>/);
  });
}

/* Dedos de la mano izquierda de la edicion de origen: la leccion 79 abre con 1 2 2 1 y el MusicXML los conserva
   (el motor los toma como pista de la TAB y los deja en la notacion). */
test('leccion 79: la notacion conserva los dedos de la edicion', { skip: !pieces.some((p) => p.number === 79) }, () => {
  const piece = pieces.find((p) => p.number === 79);
  const xml = fs.readFileSync(path.join(DOWNLOADS_DIR, piece.base + '.musicxml'), 'utf8');
  const fingers = [...xml.matchAll(/<fingering[^>]*>\s*(\d)\s*<\/fingering>/g)].map((m) => m[1]);
  assert.deepEqual(fingers.slice(0, 4), ['1', '2', '2', '1']);
  assert.equal(fingers.length, 27);
});

/* Letras de la mano derecha de la edicion: la leccion 1 las alterna i m i m. */
test('leccion 1: la notacion conserva las letras de la mano derecha', { skip: !pieces.some((p) => p.number === 1) }, () => {
  const piece = pieces.find((p) => p.number === 1);
  const xml = fs.readFileSync(path.join(DOWNLOADS_DIR, piece.base + '.musicxml'), 'utf8');
  const letters = [...xml.matchAll(/<fingering[^>]*>\s*([pima])\s*<\/fingering>/g)].map((m) => m[1]);
  assert.deepEqual(letters, ['i', 'm', 'i', 'm', 'i', 'm', 'i', 'm']);
});

/* El No.39 combina fusa + corchea con doble puntillo sobre un bajo de negra.
   Comprobar las duraciones reales, ademas de los simbolos: redondear la fusa desplaza toda la voz. */
test('leccion 39: fusas, doble puntillo y bajo sostenido conservan sus duraciones', () => {
  const piece = pieces.find((p) => p.number === 39);
  assert.ok(piece, 'la leccion 39 debe estar publicada');
  const files = [
    path.join(__dirname, '..', 'scripts', 'sagreras', 'sources', '39.musicxml'),
    path.join(DOWNLOADS_DIR, piece.base + '.musicxml'),
  ];
  for (const file of files) {
    const xml = fs.readFileSync(file, 'utf8');
    const divisions = Number(xml.match(/<divisions>(\d+)<\/divisions>/)[1]);
    const measures = [...xml.matchAll(/<measure\b[^>]*>([\s\S]*?)<\/measure>/g)].map((m) => m[1]);
    assert.equal(measures.length, 3);
    for (const [index, measure] of measures.entries()) {
      const notes = [...measure.matchAll(/<note\b[^>]*>([\s\S]*?)<\/note>/g)].map((m) => m[1]);
      const staff = notes.filter((n) => !/<staff>2<\/staff>/.test(n));
      const upper = staff.filter((n) => /<voice>1<\/voice>/.test(n));
      const expected = index < 2 ? [1 / 8, 7 / 8, 1 / 8, 7 / 8, 1 / 8, 7 / 8, 1 / 8, 7 / 8] : [1 / 8, 7 / 8, 1, 2];
      assert.deepEqual(upper.map((n) => Number(n.match(/<duration>(\d+)<\/duration>/)[1]) / divisions), expected);
      for (const [i, note] of upper.entries()) {
        if (index === 2 && i >= 2) {
          assert.match(note, /<rest\s*\/>/);
          continue;
        }
        assert.match(note, i % 2 === 0 ? /<type>32nd<\/type>/ : /<type>eighth<\/type>/);
        assert.equal((note.match(/<dot\s*\/>/g) || []).length, i % 2 === 0 ? 0 : 2);
        assert.doesNotMatch(note, /<time-modification>/, 'la fusa no es un tresillo');
      }
      const bass = staff.filter((n) => /<voice>2<\/voice>/.test(n) && /<pitch>/.test(n));
      assert.equal(bass.length, index < 2 ? 4 : 1);
      assert.ok(bass.every((n) => Number(n.match(/<duration>(\d+)<\/duration>/)[1]) === divisions));
    }
  }
});
