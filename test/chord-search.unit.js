/* Unit tests for chord-search.js. Run: node test/chord-search.unit.js */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { normalize, matchChords } = require('../src/shared/chord-search.js');

function loadChords() {
  const src = fs.readFileSync(path.join(__dirname, '../src/shared/chords-db.js'), 'utf8');
  const fakeWindow = {};
  const factory = vm.runInThisContext('(function(window){' + src + '\nreturn window;})');
  return factory(fakeWindow).CHORDS;
}

const CHORDS = loadChords();

function names(query) {
  return matchChords(query, CHORDS).map((c) => c.name);
}

test('la base se carga y no está vacía', () => {
  assert.ok(Array.isArray(CHORDS));
  assert.ok(CHORDS.length > 0);
});

test('normalize: minúsculas y sin espacios', () => {
  assert.equal(normalize(' CMAJ 7 '), 'cmaj7');
  assert.equal(normalize('A m 7'), 'am7');
});

test('normalize: símbolos ♭ ♯ △ Δ ø', () => {
  assert.equal(normalize('B♭'), 'bb');
  assert.equal(normalize('F♯'), 'f#');
  assert.equal(normalize('C△'), 'cmaj');
  assert.equal(normalize('CΔ'), 'cmaj');
  assert.equal(normalize('Bø'), 'bm7b5');
});

test('normalize: query vacía / null / sólo espacios → ""', () => {
  assert.equal(normalize(''), '');
  assert.equal(normalize('   '), '');
  assert.equal(normalize(null), '');
  assert.equal(normalize(undefined), '');
});

test('prefijo "am" incluye Am y Am7, excluye Caug', () => {
  const r = names('am');
  assert.ok(r.includes('Am'));
  assert.ok(r.includes('Am7'));
  assert.ok(!r.includes('Caug'));
  assert.ok(r.every((n) => !n.toLowerCase().startsWith('c')));
});

test('prefijo "C" no arrastra acordes que sólo lo tienen como alias interno', () => {
  const r = names('c');
  assert.ok(r.includes('C'));
  assert.ok(r.includes('Cmaj7'));
  assert.ok(r.includes('Caug'));
  assert.ok(!r.includes('Am'));
});

test('alias "amin" → Am', () => {
  assert.deepEqual(names('amin'), ['Am']);
});

test('alias "a-" → Am (y sus derivados por prefijo de alias)', () => {
  const r = names('a-');
  assert.ok(r.includes('Am'));
  assert.ok(r.includes('Am7'));
});

test('"cΔ" y "cmaj7" → Cmaj7', () => {
  assert.ok(names('cΔ').includes('Cmaj7'));
  assert.deepEqual(names('cmaj7'), ['Cmaj7']);
});

test('"bø" y "bm7b5" → Bm7b5', () => {
  assert.deepEqual(names('bø'), ['Bm7b5']);
  assert.deepEqual(names('bm7b5'), ['Bm7b5']);
});

test('"d/f♯" → D/F#', () => {
  assert.deepEqual(names('d/f♯'), ['D/F#']);
});

test('" CMAJ 7 " → Cmaj7', () => {
  assert.deepEqual(names(' CMAJ 7 '), ['Cmaj7']);
});

test('query vacía → []', () => {
  assert.deepEqual(matchChords('', CHORDS), []);
  assert.deepEqual(matchChords('   ', CHORDS), []);
});

test('query sin match → []', () => {
  assert.deepEqual(matchChords('zzz', CHORDS), []);
  assert.deepEqual(matchChords('x9', CHORDS), []);
});

test('"a" devuelve varios en orden estable de la base', () => {
  const r = names('a');
  assert.ok(r.length > 1);
  const orderInDb = CHORDS.filter((c) => r.includes(c.name)).map((c) => c.name);
  assert.deepEqual(r, orderInDb);
  ['A', 'Am', 'A7', 'Am7', 'Asus2', 'Asus4'].forEach((n) => {
    assert.ok(r.includes(n), `"a" debería incluir ${n}`);
  });
});

test('"d" devuelve varios en orden estable de la base', () => {
  const r = names('d');
  assert.ok(r.length > 1);
  const orderInDb = CHORDS.filter((c) => r.includes(c.name)).map((c) => c.name);
  assert.deepEqual(r, orderInDb);
  assert.ok(r.includes('D') && r.includes('Dm') && r.includes('D/F#'));
});

test('matchChords con lista vacía o ausente → []', () => {
  assert.deepEqual(matchChords('a', []), []);
  assert.deepEqual(matchChords('a', undefined), []);
});
