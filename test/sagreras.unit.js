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

test('leccion 66: la doble barra separa los compases 8 y 9 sin fusionarlos', () => {
  for (const file of ['scripts/sagreras/sources/66.musicxml',
    'downloads/sagreras-lecciones/Lesson 66 - Julio Salvador Sagreras.musicxml']) {
    const xml = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const measures = [...xml.matchAll(/<measure\b[^>]*>([\s\S]*?)<\/measure>/g)].map((m) => m[1]);
    assert.equal(measures.length, 16, file);
    assert.match(measures[7], /<barline location="right">\s*<bar-style>light-light<\/bar-style>/, file);
    assert.doesNotMatch(measures[7], /<repeat\b/, file);
    assert.match(measures[7], /<words[^>]*>Fine<\/words>/, file);
    const divisions = Number(xml.match(/<divisions>(\d+)<\/divisions>/)[1]);
    for (const measure of measures) {
      let cursor = 0;
      let end = 0;
      for (const [, kind, body] of measure.matchAll(/<(note|backup|forward)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
        const duration = Number(body.match(/<duration>(\d+)<\/duration>/)[1]);
        if (kind === 'backup') cursor -= duration;
        else if (!/<chord\s*\//.test(body)) cursor += duration;
        end = Math.max(end, cursor);
      }
      assert.equal(end / divisions, 3, `${file}: cada compas dura tres negras`);
    }
  }
});

test('leccion 65: tres voces independientes con sus silencios y puntillos en los 16 compases', () => {
  const root = path.join(__dirname, '..');
  const files = [path.join(root, 'scripts/sagreras/sources/65.musicxml'),
    path.join(root, 'downloads/sagreras-lecciones/Lesson 65 - Julio Salvador Sagreras.musicxml')];
  for (const file of files) {
    const xml = fs.readFileSync(file, 'utf8');
    const divisions = Number(xml.match(/<divisions>(\d+)<\/divisions>/)[1]);
    const measures = [...xml.matchAll(/<measure\b[^>]*number="(\d+)"[^>]*>([\s\S]*?)<\/measure>/g)];
    assert.equal(measures.length, 16);
    for (const [, number, measure] of measures) {
      const context = `${file}: compas ${number}`;
      let cursor = 0;
      let previous = 0;
      const voices = new Map();
      for (const token of measure.matchAll(/<(note|backup|forward)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
        const body = token[2];
        const duration = Number(body.match(/<duration>(\d+)<\/duration>/)[1]) / divisions;
        if (token[1] === 'backup') { cursor -= duration; continue; }
        if (token[1] === 'forward') { cursor += duration; continue; }
        const isChord = /<chord\s*\//.test(body);
        const onset = isChord ? previous : cursor;
        if (!isChord) { previous = cursor; cursor += duration; }
        if (/<staff>2<\/staff>/.test(body)) continue;
        const voice = body.match(/<voice>(\d+)<\/voice>/)[1];
        if (!voices.has(voice)) voices.set(voice, []);
        voices.get(voice).push({ onset, duration, body, hidden: /print-object="no"/.test(token[0]) });
      }
      assert.equal(voices.size, 3, context);
      const timing = (events) => events.map(({ onset, duration }) => [onset, duration]);
      const rests = (events) => events.filter(({ body }) => /<rest\b/.test(body)).map(({ onset }) => onset);
      const upper = voices.get('1');
      assert.deepEqual(timing(upper), [0, 1.5, 3, 4.5].map((onset) => [onset, 1.5]), context);
      assert.deepEqual(rests(upper), Number(number) <= 14 ? [0] : Number(number) === 15 ? [0, 3] : [0, 4.5], context);
      for (const { body } of upper) {
        assert.match(body, /<type>quarter<\/type>/, context);
        assert.equal((body.match(/<dot\s*\//g) || []).length, 1, context);
      }
      const bass = [...voices.values()].find((events) => /<type>(whole|half)<\/type>/.test(events[0].body));
      assert.deepEqual(timing(bass), Number(number) <= 14 ? [[0, 6]] : [[0, 3], [3, 3]], context);
      const middle = [...voices.values()].find((events) => events !== upper && events !== bass);
      const visible = middle.filter(({ hidden }) => !hidden);
      const count = Number(number) <= 15 ? 12 : 7;
      assert.deepEqual(timing(visible), Array.from({ length: count }, (_, i) => [i * 0.5, 0.5]), context);
      assert.deepEqual(rests(visible), Number(number) <= 15 ? [0, 1.5, 3, 4.5] : [0, 1.5, 3], context);
      for (const events of voices.values()) {
        assert.equal(Math.max(...events.map(({ onset, duration }) => onset + duration)), 6, context);
      }
    }
  }
});

test('leccion 60: el acompanamiento entra en los tiempos 2 y 3, separado de las blancas con puntillo', () => {
  const root = path.join(__dirname, '..');
  const files = [path.join(root, 'scripts/sagreras/sources/60.musicxml'),
    path.join(root, 'downloads/sagreras-lecciones/Lesson 60 - Julio Salvador Sagreras.musicxml')];
  const patterns = { 2: ['D5', 'B3', ['F4', 'G4']], 4: ['E5', 'C4', ['G4', 'C5']],
    10: ['G5', 'E4', ['G4', 'C5']], 12: ['E5', 'C4', ['G4', 'C5']] };
  for (const file of files) {
    const xml = fs.readFileSync(file, 'utf8');
    const divisions = Number(xml.match(/<divisions>(\d+)<\/divisions>/)[1]);
    for (const [number, [melody, bass, chord]] of Object.entries(patterns)) {
      const measure = xml.match(new RegExp(`<measure\\b[^>]*number="${number}"[^>]*>([\\s\\S]*?)<\\/measure>`))[1];
      let cursor = 0;
      let previous = 0;
      const notes = [];
      const rests = [];
      for (const token of measure.matchAll(/<(note|backup|forward)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
        const body = token[2];
        const duration = Number(body.match(/<duration>(\d+)<\/duration>/)[1]) / divisions;
        if (token[1] === 'backup') { cursor -= duration; continue; }
        if (token[1] === 'forward') { cursor += duration; continue; }
        const isChord = /<chord\s*\//.test(body);
        const onset = isChord ? previous : cursor;
        if (!isChord) { previous = cursor; cursor += duration; }
        if (/<staff>2<\/staff>/.test(body)) continue;
        const pitch = body.match(/<step>([A-G])<\/step>[\s\S]*?<octave>(\d)<\/octave>/);
        if (pitch) notes.push([onset, duration, pitch[1] + pitch[2]]);
        else if (!/print-object="no"/.test(token[0])) rests.push([onset, duration]);
      }
      const expected = [[0, 3, melody], [0, 3, bass],
        ...[1, 2].flatMap((beat) => chord.map((pitch) => [beat, 1, pitch]))];
      const sort = (a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b));
      assert.deepEqual(notes.sort(sort), expected.sort(sort), `${file}: compas ${number}`);
      assert.deepEqual(rests, [[0, 1]], `${file}: silencio inicial del acompanamiento en ${number}`);
    }
  }
});

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

/* La cabeza compartida del bajo no debe adelantar la corchea de la melodia. */
test('leccion 58: blanca con puntillo y entrada posterior de la melodia', () => {
  const files = [
    path.join(__dirname, '..', 'scripts', 'sagreras', 'sources', '58.musicxml'),
    path.join(DOWNLOADS_DIR, 'Lesson 58 - Julio Salvador Sagreras.musicxml'),
  ];
  for (const file of files) {
    const xml = fs.readFileSync(file, 'utf8');
    const divisions = Number(xml.match(/<divisions>(\d+)<\/divisions>/)[1]);
    for (const number of [1, 5, 13]) {
      const measure = xml.match(new RegExp('<measure\\b[^>]*number="' + number + '"[^>]*>([\\s\\S]*?)</measure>'))[1];
      const notes = [...measure.matchAll(/<note\b[^>]*>[\s\S]*?<\/note>/g)].map((m) => m[0]);
      const staff = notes.filter((n) => !/<staff>2<\/staff>/.test(n));
      const upper = staff.filter((n) => /<voice>1<\/voice>/.test(n));
      assert.match(upper[0], /print-object="no"/);
      assert.match(upper[0], /<rest\s*\/>/);
      assert.deepEqual(upper.map((n) => Number(n.match(/<duration>(\d+)<\/duration>/)[1]) / divisions), [1, 0.5, 1, 0.5]);
      const bass = staff.filter((n) => /<voice>2<\/voice>/.test(n));
      assert.equal(bass.length, 1);
      assert.match(bass[0], /<type>half<\/type>/);
      assert.match(bass[0], /<dot\s*\/>/);
      assert.equal(Number(bass[0].match(/<duration>(\d+)<\/duration>/)[1]) / divisions, 3);
    }
  }
});

/* En los primeros seis compases del No.53 los cuatro pulsos repiten silencio + tres semicorcheas.
   El espaciado mas estrecho del ultimo grupo no debe desplazar una nota a otra voz. */
test('leccion 53: el ultimo grupo conserva sus tres semicorcheas en la misma voz', () => {
  const piece = pieces.find((p) => p.number === 53);
  assert.ok(piece);
  for (const file of [path.join(__dirname, '..', 'scripts', 'sagreras', 'sources', '53.musicxml'),
    path.join(DOWNLOADS_DIR, piece.base + '.musicxml')]) {
    const xml = fs.readFileSync(file, 'utf8');
    const measures = [...xml.matchAll(/<measure\b[^>]*>([\s\S]*?)<\/measure>/g)].map((m) => m[1]);
    for (const measure of measures.slice(0, 6)) {
      const notes = [...measure.matchAll(/<note\b[^>]*>([\s\S]*?)<\/note>/g)].map((m) => m[1])
        .filter((n) => /<voice>2<\/voice>/.test(n) && !/<staff>2<\/staff>/.test(n));
      assert.equal(notes.length, 16);
      assert.ok(notes.every((n) => /<type>16th<\/type>/.test(n)));
      const pitches = notes.map((n) => (n.match(/<pitch>([\s\S]*?)<\/pitch>/) || [null, 'rest'])[1].replace(/\s+/g, ''));
      const durations = notes.map((n) => Number(n.match(/<duration>(\d+)<\/duration>/)[1]));
      assert.ok(durations.every((d) => d === durations[0]));
      for (let group = 1; group < 4; group++) {
        assert.deepEqual(pitches.slice(group * 4, group * 4 + 4), pitches.slice(0, 4));
      }
    }
  }
});
