'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const op44 = require('../scripts/lib/article-sor-op44');
const { pagePath } = require('../scripts/lib/slugs');

test('Op. 44: colección propia, ordenada, con textos en los tres idiomas', () => {
  const pieces = op44.publishedPieces();
  assert.ok(pieces.length > 0);
  assert.ok(pieces.every((piece) => piece.opus === 44));
  assert.deepEqual(pieces.map((p) => Number(p.n)), pieces.map((p) => Number(p.n)).sort((a, b) => a - b));
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
