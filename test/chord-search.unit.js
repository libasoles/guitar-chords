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

test('"a" devuelve varios, con el match exacto primero', () => {
  const r = names('a');
  assert.ok(r.length > 1);
  assert.equal(r[0], 'A');
  ['A', 'Am', 'A7', 'Am7', 'Asus2', 'Asus4'].forEach((n) => {
    assert.ok(r.includes(n), `"a" debería incluir ${n}`);
  });
});

test('"d" devuelve varios, con el match exacto primero', () => {
  const r = names('d');
  assert.ok(r.length > 1);
  assert.equal(r[0], 'D');
  assert.ok(r.includes('Dm') && r.includes('D/F#'));
});

test('"cmaj" prioriza el match exacto (C, alias "Cmaj") sobre el prefijo más largo (Cmaj7)', () => {
  const r = names('cmaj');
  assert.ok(r.includes('C'));
  assert.ok(r.includes('Cmaj7'));
  assert.equal(r[0], 'C');
  assert.ok(r.indexOf('C') < r.indexOf('Cmaj7'));
});

test('matchChords con lista vacía o ausente → []', () => {
  assert.deepEqual(matchChords('a', []), []);
  assert.deepEqual(matchChords('a', undefined), []);
});

test('normalize: nota inicial en español → letra americana', () => {
  assert.equal(normalize('Do'), 'c');
  assert.equal(normalize('Re'), 'd');
  assert.equal(normalize('Mi'), 'e');
  assert.equal(normalize('Fa'), 'f');
  assert.equal(normalize('Sol'), 'g');
  assert.equal(normalize('La'), 'a');
  assert.equal(normalize('Si'), 'b');
});

test('normalize: cifrado español con calidad y alteraciones', () => {
  assert.equal(normalize('Dom'), 'cm');
  assert.equal(normalize('Sol7'), 'g7');
  assert.equal(normalize('Do♯m'), 'c#m');
  assert.equal(normalize('Reb'), 'db');
  assert.equal(normalize('Sim7b5'), 'bm7b5');
});

test('cifrado español "do" matchea lo mismo que "c"', () => {
  assert.deepEqual(names('do'), names('c'));
});

test('cifrado español "solm7" matchea "Gm7"', () => {
  assert.ok(names('solm7').includes('Gm7'));
});

test('cifrado español "la" matchea lo mismo que "a"', () => {
  assert.deepEqual(names('la'), names('a'));
});

test('"C9" matchea "Cmaj9" (novena sin "maj" explícito)', () => {
  assert.ok(names('C9').includes('Cmaj9'));
});

test('"9" sola matchea todos los acordes de novena, de cualquier raíz', () => {
  const r = names('9');
  assert.ok(r.includes('Cmaj9'));
  assert.ok(r.includes('Dmaj9'));
  assert.ok(r.includes('Em(add9)'));
});

test('"cmaj7" no matchea "D♭maj7" vía su alias enarmónico "C♯maj7"', () => {
  assert.ok(!names('cmaj7').includes('D♭maj7'));
});

test('normalize: abreviatura de una sola letra en español (r/m/l/s)', () => {
  assert.equal(normalize('R'), 'd');
  assert.equal(normalize('M'), 'e');
  assert.equal(normalize('L'), 'a');
  assert.equal(normalize('S'), 'g');
  assert.equal(normalize('Rm'), 'dm');
});

test('cifrado español "r" matchea lo mismo que "d" (buscar acordes de Re)', () => {
  assert.deepEqual(names('r'), names('d'));
  assert.ok(names('r').includes('D'));
});

test('normalize: "d" es D (Re) por defecto, pero Do (c) en modo español', () => {
  assert.equal(normalize('d'), 'd');
  assert.equal(normalize('d', 'es'), 'c');
  assert.equal(normalize('dm', 'es'), 'cm');
  assert.equal(normalize('do', 'es'), 'c');
});

test('modo español: "d" matchea Do (C), no D (Re)', () => {
  const r = matchChords('d', CHORDS, 'es').map((c) => c.name);
  assert.ok(r.includes('C'));
  assert.ok(!r.includes('D'));
});

test('modo inglés (sin notation): "d" sigue matcheando D (Re), no Do (C)', () => {
  const r = names('d');
  assert.ok(r.includes('D'));
  assert.ok(!r.includes('C'));
});
