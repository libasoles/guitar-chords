/* Home startup: the first content must not wait for heavy, non-critical
   scripts. Run: node --test test/home-startup.unit.js (needs `npm run build:site`). */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DIST = path.join(__dirname, '..', 'dist', 'site');

for (const page of ['index.html', 'en/index.html']) {
  const html = fs.readFileSync(path.join(DIST, page), 'utf8');
  const scripts = [...html.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1]);

  test(`${page}: ningún script con src bloquea el parseo inicial`, () => {
    const blocking = scripts.filter((a) => /\bsrc=/.test(a) && !/\b(defer|async)\b/.test(a));
    assert.deepEqual(blocking, []);
  });

  test(`${page}: el renderer de diagramas (svguitar) no se carga en el arranque`, () => {
    assert.ok(!html.includes('svguitar.umd.js'));
  });

  test(`${page}: los scripts del buscador conservan su orden de ejecución`, () => {
    const order = ['chords-db.js', 'chord-diagram.js', 'chord-positions.js', 'chord-search.js', 'note-names.js', 'chord-finder.js'];
    const idx = order.map((f) => html.indexOf('/' + f.replace(/\.js$/, '.')));
    assert.ok(idx.every((i) => i > 0));
    assert.deepEqual([...idx].sort((a, b) => a - b), idx);
  });
}
