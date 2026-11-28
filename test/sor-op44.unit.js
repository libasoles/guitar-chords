'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const op44 = require('../scripts/lib/article-sor-op44');
const { pagePath } = require('../scripts/lib/slugs');

function measure(xml, number) {
  return xml.match(new RegExp('<measure\\b[^>]*number="' + number + '"[^>]*>([^]*?)<\\/measure>'))[1];
}

test('Op. 44: colección propia, ordenada, con textos en los tres idiomas', () => {
  const pieces = op44.publishedPieces();
  assert.deepEqual(pieces.map((p) => Number(p.n)), Array.from({ length: 24 }, (_, index) => index + 1));
  assert.ok(pieces.every((piece) => piece.opus === 44));
  for (const locale of ['es', 'en', 'pt']) {
    const strings = require('../src/i18n/strings.' + locale + '.json');
    assert.match(strings.artSorOp44H1, /Op\. 44/);
    assert.notEqual(pagePath('articulo-piezas-sor-op44', locale), pagePath('articulo-lecciones-sor', locale));
    const body = op44.renderBody(locale, strings);
    assert.equal((body.match(/class="example-card prelude-card"/g) || []).length, pieces.length);
    assert.doesNotMatch(body, /%%PIECES%%/);
    assert.match(body, /Op\. 44/);
  }
});

test('Op. 44 n.º 1: anacrusa, voces separadas y adorno final del impreso', () => {
  const xml = fs.readFileSync(path.join(__dirname, '../scripts/sor/sources/opus44/4401.musicxml'), 'utf8');
  assert.equal((xml.match(/<measure\b/g) || []).length, 33);
  assert.match(xml, /<measure[^>]*implicit="yes"/);
  assert.match(xml, /<voice>2<\/voice>/);
  assert.match(xml, /<grace/);
});

test('Op. 44 n.º 2: Do ligado entre 11–12 y atribución CC BY 3.0', () => {
  const xml = fs.readFileSync(path.join(__dirname, '../scripts/sor/sources/opus44/4402.musicxml'), 'utf8');
  assert.match(measure(xml, 11), /<tie type="start"/);
  assert.match(measure(xml, 12), /<tie type="stop"/);
  assert.equal(op44.PIECES[4402].license_family, 'by');
  const pdf = fs.readFileSync(path.join(op44.DOWNLOADS_DIR, op44.publishedPieces().find((p) => p.number === 4402).pdf), 'latin1');
  assert.match(pdf, /\(CC BY 3\.0\)/);
  assert.doesNotMatch(pdf, /CC BY-SA/);
});

test('Op. 44 n.º 3: 40 compases en 3/4 y Sol ligado entre 21–22', () => {
  const xml = fs.readFileSync(path.join(__dirname, '../scripts/sor/sources/opus44/4403.musicxml'), 'utf8');
  assert.equal((xml.match(/<measure\b/g) || []).length, 40);
  assert.match(xml, /<time><beats>3<\/beats><beat-type>4<\/beat-type><\/time>/);
  assert.match(measure(xml, 21), /<step>G<\/step><octave>4<\/octave><\/pitch><duration>480<\/duration><tie type="start"/);
  assert.match(measure(xml, 22), /<step>G<\/step><octave>4<\/octave><\/pitch><duration>480<\/duration><tie type="stop"/);
});

test('Op. 44 n.º 4: anacrusa, dos repeticiones y casillas en la descarga', () => {
  const piece = op44.publishedPieces().find((p) => p.number === 4404);
  const xml = fs.readFileSync(path.join(op44.DOWNLOADS_DIR, piece.pdf.replace(/\.pdf$/, '.musicxml')), 'utf8');
  assert.equal((xml.match(/<measure\b/g) || []).length, 26);
  assert.match(xml, /<measure\b[^>]*number="0"/);
  assert.match(measure(xml, 1), /<repeat direction="forward"/);
  assert.match(measure(xml, 8), /<repeat direction="backward"/);
  assert.match(measure(xml, 9), /<repeat direction="forward"/);
  assert.match(measure(xml, 24), /<ending number="1" type="start"/);
  assert.match(measure(xml, 24), /<repeat direction="backward"/);
  assert.match(measure(xml, 25), /<ending number="2" type="start"/);
  assert.match(measure(xml, 16), /<staccato\s*\/>/);
  assert.match(measure(xml, 18), /<staccato\s*\/>/);
});

test('Op. 44 n.º 4: el Sol sostenido del compás 8 y su reataque usan cuerdas distintas', () => {
  const piece = op44.publishedPieces().find((p) => p.number === 4404);
  const xml = fs.readFileSync(path.join(op44.DOWNLOADS_DIR, piece.pdf.replace(/\.pdf$/, '.musicxml')), 'utf8');
  const notes = measure(xml, 8).match(/<note\b[^>]*>[^]*?<\/note>/g);
  const gNotes = notes.filter((note) => /<step>G<\/step>\s*<octave>3<\/octave>/.test(note) && /<staff>2<\/staff>/.test(note));
  assert.deepEqual(gNotes.map((note) => [note.match(/<type>(\w+)<\/type>/)[1], note.match(/<string>(\d+)<\/string>/)[1]]),
    [['eighth', '3'], ['eighth', '3'], ['quarter', '4']]);
});

test('Op. 44 n.º 12: las voces del cierre breve conservan sus ataques simultáneos', () => {
  const piece = op44.publishedPieces().find((p) => p.number === 4412);
  const xml = fs.readFileSync(path.join(op44.DOWNLOADS_DIR, piece.pdf.replace(/\.pdf$/, '.musicxml')), 'utf8');
  const firstClosingBar = measure(xml, 8);
  let cursor = 0;
  let onset = 0;
  const firstAttack = [];
  for (const event of firstClosingBar.matchAll(/<(note|backup|forward)\b[^>]*>([^]*?)<\/\1>/g)) {
    const [, type, body] = event;
    const duration = Number(body.match(/<duration>(\d+)<\/duration>/)?.[1] || 0);
    if (type === 'note') {
      if (!/<chord\s*\/>/.test(body)) {
        onset = cursor;
        cursor += duration;
      }
      const step = body.match(/<step>(\w+)<\/step>/)?.[1];
      if (onset === 0 && step && /<staff>2<\/staff>/.test(body)) firstAttack.push(step);
    } else {
      cursor += type === 'backup' ? -duration : duration;
    }
  }
  assert.deepEqual(firstAttack.sort(), ['A', 'E', 'F']);
  assert.equal((xml.match(/<repeat direction="backward"/g) || []).length, 4);
});
