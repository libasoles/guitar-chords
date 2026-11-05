/* El paquete npm (consumido por partitura) publica el buscador de acordes junto al diccionario:
   chord-search.js requiere ../../vendor/fuzzysort.js, así que ambos deben estar en `files`. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('the package ships the chord search with its fuzzy-matching dependency and types', () => {
  for (const file of ['src/shared/chord-search.js', 'src/shared/chord-search.d.ts', 'vendor/fuzzysort.js']) {
    assert.ok(pkg.files.includes(file), `${file} is not in package.json "files"`);
    assert.ok(fs.existsSync(path.join(root, file)), `${file} does not exist`);
  }
  const source = fs.readFileSync(path.join(root, 'src/shared/chord-search.js'), 'utf8');
  assert.match(source, /require\('\.\.\/\.\.\/vendor\/fuzzysort\.js'\)/);
});

test('the published search finds chords by solfège root, ignoring case', () => {
  const { matchChords } = require('../src/shared/chord-search.js');
  const chords = require('../src/shared/chords-db.js').CHORDS;
  const names = (query) => matchChords(query, chords).map((chord) => chord.name);
  assert.strictEqual(names('Si')[0], 'B');
  assert.deepStrictEqual(names('si').slice(0, 3), names('Si').slice(0, 3));
  assert.strictEqual(names('c')[0], 'C');
  assert.ok(!names('Si').includes('Em(add9)'));
});
