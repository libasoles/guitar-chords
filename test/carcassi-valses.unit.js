const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/* Los valses son las piezas progresivas con "key" en pieces.json: la pagina de valses y la de progresivas publican los
   mismos archivos de downloads/carcassi-progresivas. */
const waltz = (number) => path.join(__dirname, `../downloads/carcassi-progresivas/Progressive Piece ${number} - Waltz - Matteo Carcassi.musicxml`);

test('Vals 2, compás 17: el re sostenido sigue al acorde de sol', () => {
  const file = waltz(2);
  const xml = fs.readFileSync(file, 'utf8');
  const bar = xml.match(/<measure\b[^>]*number="17"[^>]*>([\s\S]*?)<\/measure>/)[1];
  const notes = [...bar.matchAll(/<note\b[^>]*>([\s\S]*?)<\/note>/g)]
    .map((m) => m[1]).filter((n) => !/<staff>2<\/staff>/.test(n));
  for (const note of notes) assert.match(note, /<voice>1<\/voice>/, file);
  assert.equal(notes.length, 4, file);
  const attacks = [];
  for (const note of notes) {
    const pitch = note.match(/<step>(.*?)<\/step>/)[1]
      + (/<alter>1<\/alter>/.test(note) ? '#' : '')
      + note.match(/<octave>(.*?)<\/octave>/)[1];
    if (/<chord\s*\//.test(note)) attacks.at(-1).push(pitch);
    else attacks.push([pitch]);
    assert.match(note, attacks.length === 1 ? /<type>quarter<\/type>/ : /<type>eighth<\/type>/, file);
  }
  assert.deepEqual(attacks, [['G2', 'G3', 'D4'], ['D#4']], file);
  const tabs = [...bar.matchAll(/<note\b[^>]*>([\s\S]*?)<\/note>/g)]
    .map((m) => m[1]).filter((n) => /<staff>2<\/staff>/.test(n));
  const shapes = [];
  for (const note of tabs) {
    if (!/<chord\s*\//.test(note)) shapes.push(Array(6).fill(null));
    shapes.at(-1)[Number(note.match(/<string>(.*?)<\/string>/)[1]) - 1]
      = Number(note.match(/<fret>(.*?)<\/fret>/)[1]);
  }
  assert.deepEqual(shapes, [[null, 3, 0, null, null, 3], [null, 4, null, null, null, null]], file);
});

test('Vals 5, compás 16: mi en primera cuerda al aire mantiene la posición', () => {
  const xml = fs.readFileSync(waltz(5), 'utf8');
  const bar = xml.match(/<measure\b[^>]*number="16"[^>]*>([\s\S]*?)<\/measure>/)[1];
  const notes = [...bar.matchAll(/<note\b[^>]*>([\s\S]*?)<\/note>/g)]
    .map((m) => m[1]).filter((n) => /<staff>2<\/staff>/.test(n) && /<pitch>/.test(n));
  const melody = notes.filter((n) => /<voice>1<\/voice>/.test(n) && !/<chord\s*\//.test(n));
  assert.deepEqual(melody.slice(0, 3).map((n) => [
    Number(n.match(/<string>(.*?)<\/string>/)[1]),
    Number(n.match(/<fret>(.*?)<\/fret>/)[1]),
  ]), [[1, 0], [1, 2], [1, 0]]);
});

function melodyCells(number, measure) {
  const xml = fs.readFileSync(waltz(number), 'utf8');
  const bar = xml.match(new RegExp(`<measure\\b[^>]*number="${measure}"[^>]*>([\\s\\S]*?)<\\/measure>`))[1];
  const attacks = [];
  for (const [, note] of bar.matchAll(/<note\b[^>]*>([\s\S]*?)<\/note>/g)) {
    if (!/<staff>2<\/staff>/.test(note) || !/<voice>1<\/voice>/.test(note) || !/<pitch>/.test(note)) continue;
    const cell = [Number(note.match(/<string>(.*?)<\/string>/)[1]), Number(note.match(/<fret>(.*?)<\/fret>/)[1])];
    if (/<chord\s*\//.test(note)) attacks.at(-1).push(cell);
    else attacks.push([cell]);
  }
  return attacks.map((cells) => cells.sort((a, b) => a[0] - b[0])[0]);
}

for (const measure of [3, 7, 20, 24]) {
  test(`Vals 5, compás ${measure}: la melodía 5–4–5–3–0 sigue en primera cuerda`, () => {
    assert.deepEqual(melodyCells(5, measure), [[1, 5], [1, 4], [1, 5], [1, 3], [1, 0]]);
  });
}

test('Vals 7, compás 20: 2–1–2 en tercera cuerda y 0–1–3 en segunda', () => {
  assert.deepEqual(melodyCells(7, 20), [[3, 2], [3, 1], [3, 2], [2, 0], [2, 1], [2, 3]]);
});

/* Los ocho valses estan en dos paginas (valses y piezas progresivas) y no se generan dos veces. */
const WALTZES = [2, 5, 7, 10, 15, 26, 34, 36];

test('los valses salen de los archivos de las progresivas y solo se listan en la pagina de valses', () => {
  const { waltzes } = require('../scripts/lib/article-carcassi-preludes');
  const progressive = require('../scripts/lib/article-carcassi-progressive');
  assert.deepEqual(waltzes.publishedPreludes().map((p) => p.number), WALTZES);
  assert.equal(waltzes.PREVIEW_DIR, progressive.PREVIEW_DIR);
  assert.equal(waltzes.DOWNLOADS_DIR, progressive.DOWNLOADS_DIR);
  assert.equal(waltzes.SCORE_PREFIX, progressive.SCORE_PREFIX);
  const shared = new Map(progressive.allPublishedPieces().map((p) => [p.number, p.pdf]));
  for (const waltzPiece of waltzes.publishedPreludes()) assert.equal(waltzPiece.pdf, shared.get(waltzPiece.number));
  assert.deepEqual(progressive.publishedWaltzes().map((p) => p.number), WALTZES);
  assert.deepEqual(progressive.publishedPieces().filter((p) => WALTZES.includes(p.number)), [], 'la pagina de progresivas no lista valses');
  assert.ok(!fs.existsSync(path.join(__dirname, '../downloads/carcassi-valses')), 'sin una segunda copia de los PDF');
});

/* Digitaciones pedidas (extract.waltz_voicing): [compas, nota, cuerda, traste]. */
function tabCells(number, measure) {
  const xml = fs.readFileSync(waltz(number), 'utf8');
  const bar = xml.match(new RegExp(`<measure\\b[^>]*number="${measure}"[^>]*>([\\s\\S]*?)<\\/measure>`))[1];
  return [...bar.matchAll(/<note\b[^>]*>([\s\S]*?)<\/note>/g)].map((m) => m[1])
    .filter((n) => /<staff>2<\/staff>/.test(n) && /<pitch>/.test(n))
    .map((n) => n.match(/<step>(.*?)<\/step>/)[1] + (/<alter>1<\/alter>/.test(n) ? '#' : '') + ':' +
      n.match(/<string>(.*?)<\/string>/)[1] + '/' + n.match(/<fret>(.*?)<\/fret>/)[1]);
}

for (const [number, measure, cell] of [
  [7, 2, 'E:2/5'], [7, 4, 'E:2/5'], [7, 5, 'B:3/4'], [34, 10, 'F#:2/7'], [34, 12, 'E:2/5'], [34, 14, 'F#:2/7'],
  [36, 1, 'E:2/5'], [36, 22, 'E:2/5'], [26, 19, 'B:2/0'], [26, 23, 'B:2/0'], [36, 31, 'C:2/1'],
]) {
  test(`Vals ${number}, compás ${measure}: ${cell} sin salir de la posición`, () => {
    assert.ok(tabCells(number, measure).includes(cell), tabCells(number, measure).join(' '));
  });
}

test('Vals 26, compás 10: el fa es natural (fret 1), como en el libro', () => {
  assert.deepEqual(tabCells(26, 10).filter((c) => c.startsWith('F')), ['F:1/1', 'F:1/1']);
});
