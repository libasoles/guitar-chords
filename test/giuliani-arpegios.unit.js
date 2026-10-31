/* Artefactos publicados de Los 120 arpegios de Giuliani (downloads/giuliani-arpegios).
   Run: node --test test/giuliani-arpegios.unit.js
   Contrato: los 120 ejercicios tienen PDF y MusicXML con el mismo nombre base, el MusicXML es legible, con notacion y TAB
   y los tres compases de la edicion (dos del arpegio con repeticion y el acorde final), y el ejercicio lleva su numero.
   Independencia: ningun archivo conserva rastros del programa de la edicion de origen salvo el credito (pie con enlace a
   Marieh y a la licencia CC0 1.0) y el PDF lleva los metadatos fijados. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const catalog = require('../scripts/lib/article-giuliani-arpegios');

const COUNT = 120;
const MEASURES = require('../scripts/giuliani-arpegios/measures.json');

/* Cadenas de los archivos de origen: programa y textos por defecto de MuseScore. */
const SOURCE_TRACES = [/MuseScore/i, /Copyleft/i, /Exercices pour la main droite/i, /\.mscz/i];

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
  return { measures: (part.match(/<measure\b/g) || []).length, staves: Number((part.match(/<staves>(\d+)<\/staves>/) || [])[1]) };
}

const pieces = catalog.publishedPieces();
const { DOWNLOADS_DIR, PREVIEW_DIR, SCORE_PREFIX } = catalog;

test('estan publicados los 120 ejercicios, en orden numerico', () => {
  assert.deepEqual(pieces.map((p) => p.number), Array.from({ length: COUNT }, (_, i) => i + 1));
});

for (const piece of pieces) {
  const label = 'Arpeggio Exercise ' + piece.number;

  test(label + ': MusicXML legible, con notacion y TAB y los compases de la edicion', () => {
    const xml = fs.readFileSync(path.join(DOWNLOADS_DIR, piece.base + '.musicxml'), 'utf8');
    assertWellFormed(xml);
    const shape = scoreShape(xml);
    assert.equal(shape.staves, 2, 'notacion + pentagrama TAB');
    assert.equal(shape.measures, MEASURES[piece.number], 'compases de la edicion');
    assert.equal(MEASURES[piece.number], 3);
    assert.ok(xml.includes('<work-title>' + label + '</work-title>'));
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
    assert.ok(text.includes('(Marieh \\(2020\\))'), 'credito a Marieh');
    const uris = [...text.matchAll(/\/URI\s*\(((?:\\.|[^\\)])*)\)/g)]
      .map((m) => m[1].replace(/\\(\d{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8))));
    assert.ok(uris.includes('https://creativecommons.org/publicdomain/zero/1.0/'), 'enlace a la licencia');
    assert.ok(uris.some((uri) => uri.startsWith('https://imslp.org/wiki/')), 'enlace a la edicion de origen');
    const info = text.match(/\/Title\s*\(((?:\\.|[^\\)])*)\)/);
    assert.ok(info, 'el PDF declara /Title');
    assert.equal(info[1].replace(/\\([()\\])/g, '$1'), label);
    assert.match(text, /\/Author/);
    assert.doesNotMatch(text, /\/Producer|\/Creator|\/CreationDate|\/ModDate/);
    assert.doesNotMatch(text, /<x:xmpmeta|\/Metadata/);
    assert.doesNotMatch(xml, /<encoding>|<software>|<rights>|<source>|<encoding-date>/);
  });
}

/* Las voces inferiores comparten el tiempo del seisillo; no deben imprimir otras cifras dentro del pentagrama. */
test('ejercicio 34: solo ocho cifras de seisillo, sin cifras adicionales del acompanamiento', () => {
  for (const relative of ['arpeggio-34.svg', 'full/arpeggio-34-p1.svg']) {
    const svg = fs.readFileSync(path.join(PREVIEW_DIR, relative), 'utf8');
    assert.equal((svg.match(/\sclass="tupletNum"/g) || []).length, relative.startsWith('full/') ? 8 : 4, relative);
  }
  for (const file of [path.join(__dirname, '../scripts/giuliani-arpegios/sources/034.musicxml'),
    path.join(DOWNLOADS_DIR, 'Arpeggio Exercise 034 - Mauro Giuliani.musicxml')]) {
    const xml = fs.readFileSync(file, 'utf8');
    const notes = [...xml.matchAll(/<note\b[^>]*>([\s\S]*?)<\/note>/g)].map((m) => m[1]);
    const lower = notes.filter((note) => /<voice>[23]<\/voice>/.test(note) && !/<staff>2<\/staff>/.test(note));
    assert.ok(lower.some((note) => /<time-modification>/.test(note)), 'conservar la subdivision del bajo');
    for (const note of lower) {
      for (const [tuplet] of note.matchAll(/<tuplet\b[^>]*>/g)) {
        if (!/type="start"/.test(tuplet)) continue;
        assert.match(tuplet, /show-number="none"/, file);
        assert.match(tuplet, /bracket="no"/, file);
      }
    }
  }
});

test('ejercicio 36: p-m, i, p, i quedan en el primer grupo de semicorcheas', () => {
  for (const file of [path.join(__dirname, '../scripts/giuliani-arpegios/sources/036.musicxml'),
    path.join(DOWNLOADS_DIR, 'Arpeggio Exercise 036 - Mauro Giuliani.musicxml')]) {
    const xml = fs.readFileSync(file, 'utf8');
    const measure = xml.match(/<measure\b[^>]*number="1"[^>]*>([\s\S]*?)<\/measure>/)[1];
    const notes = [...measure.matchAll(/<note\b[^>]*>([\s\S]*?)<\/note>/g)].map((m) => m[1])
      .filter((n) => !/<staff>2<\/staff>/.test(n));
    const marked = notes.flatMap((n, index) => [...n.matchAll(/<fingering[^>]*>([pima])<\/fingering>/g)]
      .map((m) => [index, m[1]]));
    assert.deepEqual(marked, [[0, 'p'], [1, 'm'], [2, 'i'], [3, 'p'], [4, 'i']], file);
  }
});

test('ejercicio 40: p-m, i-m, p, i quedan en el primer grupo de semicorcheas', () => {
  for (const file of [path.join(__dirname, '../scripts/giuliani-arpegios/sources/040.musicxml'),
    path.join(DOWNLOADS_DIR, 'Arpeggio Exercise 040 - Mauro Giuliani.musicxml')]) {
    const xml = fs.readFileSync(file, 'utf8');
    const measure = xml.match(/<measure\b[^>]*number="1"[^>]*>([\s\S]*?)<\/measure>/)[1];
    const notes = [...measure.matchAll(/<note\b[^>]*>([\s\S]*?)<\/note>/g)].map((m) => m[1])
      .filter((n) => !/<staff>2<\/staff>/.test(n));
    const marked = notes.flatMap((n, index) => [...n.matchAll(/<fingering[^>]*>([pima])<\/fingering>/g)]
      .map((m) => [index, m[1]]));
    assert.deepEqual(marked, [[0, 'p'], [1, 'm'], [2, 'i'], [3, 'm'], [4, 'p'], [5, 'i']], file);
  }
});

/* Las dos plicas del original comparten cabeza: el bajo coincide con una nota del seisillo. */
test('ejercicio 34: el bajo comparte los ataques del arpegio sin crear notas dobles', () => {
  for (const file of [path.join(__dirname, '../scripts/giuliani-arpegios/sources/034.musicxml'),
    path.join(DOWNLOADS_DIR, 'Arpeggio Exercise 034 - Mauro Giuliani.musicxml')]) {
    const xml = fs.readFileSync(file, 'utf8');
    const divisions = Number(xml.match(/<divisions>(\d+)<\/divisions>/)[1]);
    const measures = [...xml.matchAll(/<measure\b[^>]*>([\s\S]*?)<\/measure>/g)].slice(0, 2);
    for (const [index, match] of measures.entries()) {
      let cursor = 0;
      const bass = [];
      for (const [element] of match[1].matchAll(/<(?:note|backup|forward)\b[^>]*>[\s\S]*?<\/(?:note|backup|forward)>/g)) {
        const duration = Number(element.match(/<duration>(\d+)<\/duration>/)?.[1] || 0);
        if (element.startsWith('<backup>')) { cursor -= duration; continue; }
        if (element.startsWith('<forward>')) { cursor += duration; continue; }
        if (/<voice>[23]<\/voice>/.test(element) && !/<staff>2<\/staff>|<rest\b/.test(element)) {
          bass.push([cursor / divisions * 3, duration / divisions * 3,
            element.match(/<step>(\w)<\/step>/)[1]]);
        }
        if (!/<chord\s*\//.test(element)) cursor += duration;
      }
      const [low, high] = index === 0 ? ['C', 'E'] : ['B', 'D'];
      assert.deepEqual(bass, [[0, 1, low], [1, 2, low], [3, 1, high], [4, 2, high],
        [6, 1, low], [7, 2, low], [9, 1, high], [10, 2, high]], file);
    }
  }
});

/* Edicion Marieh, paginas 9-10: letras solo en los cuatro primeros ataques.
   Los dedos de una pareja se asignan por altura, no por proximidad a la letra. */
const REVIEWED_RIGHT_HAND = {
  41: 'pimpmi',
  43: 'pmipim',
  44: 'pmipmi',
  45: 'pimpim',
  46: 'pmimpmi',
  47: 'pimpmim',
};
for (const [number, fingers] of Object.entries(REVIEWED_RIGHT_HAND)) {
  test(`ejercicio ${number}: dedos de la mano derecha cotejados con la edicion`, () => {
    for (const file of [path.join(__dirname, `../scripts/giuliani-arpegios/sources/${number.padStart(3, '0')}.musicxml`),
      path.join(DOWNLOADS_DIR, `Arpeggio Exercise ${number.padStart(3, '0')} - Mauro Giuliani.musicxml`)]) {
      const xml = fs.readFileSync(file, 'utf8');
      const measures = [...xml.matchAll(/<measure\b[^>]*>([\s\S]*?)<\/measure>/g)];
      const marked = measures.flatMap(([_, measure], measureIndex) =>
        [...measure.matchAll(/<note\b[^>]*>([\s\S]*?)<\/note>/g)].map((m) => m[1])
          .filter((note) => !/<staff>2<\/staff>/.test(note))
          .flatMap((note, noteIndex) => [...note.matchAll(/<fingering[^>]*>([pima])<\/fingering>/g)]
            .map((m) => [measureIndex, noteIndex, m[1]])));
      assert.deepEqual(marked, [...fingers].map((finger, index) => [0, index, finger]), file);
    }
  });
}
