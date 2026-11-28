/* La biblioteca de acordes rotos que publica el paquete es un volcado de GROUPS (article-arpeggios):
   debe estar al día, declarada en `files` y con posiciones coherentes. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const { render } = require('../scripts/generate-broken-chords.js');
const { BROKEN_CHORDS } = require('../src/shared/broken-chords-db.js');

test('the package ships the broken chords library with its types', () => {
  for (const file of ['src/shared/broken-chords-db.js', 'src/shared/broken-chords-db.d.ts']) {
    assert.ok(pkg.files.includes(file), `${file} is not in package.json "files"`);
    assert.ok(fs.existsSync(path.join(root, file)), `${file} does not exist`);
  }
});

test('broken-chords-db.js is up to date with the arpeggios article', () => {
  assert.strictEqual(fs.readFileSync(path.join(root, 'src/shared/broken-chords-db.js'), 'utf8'), render(),
    'run node scripts/generate-broken-chords.js');
});

test('every broken chord position is a form with matching fingering and fingers', () => {
  assert.ok(BROKEN_CHORDS.length > 600);
  for (const chord of BROKEN_CHORDS) {
    assert.strictEqual(chord.form.length, 6, chord.name);
    assert.strictEqual(chord.fingering.length, 6, chord.name);
    assert.strictEqual(chord.fingers.length, 6, chord.name);
    assert.strictEqual(chord.notes.split(' ').length, chord.form.filter((fret) => fret !== null).length, chord.name);
    chord.form.forEach((fret, i) => {
      assert.strictEqual(chord.fingering[i] === '-', fret === null, `${chord.name} ${chord.fingering}`);
      assert.deepStrictEqual(chord.fingers[i].slice(0, 2), [i + 1, fret === null ? 'x' : fret === 0 ? 'o' : fret]);
    });
  }
});
