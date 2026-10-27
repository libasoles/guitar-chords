const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SUITES, targets } = require('../scripts/ci-e2e-targets');

const ALL = Object.keys(SUITES);

test('docs, backend and unit test changes need no e2e suite', () => {
  assert.deepEqual(targets(['README.md', 'docs/ocr-evaluacion.md', 'backend/api/app.py', 'infra/stack.py', 'test/slugs.unit.js']), []);
});

test('a tool-specific change runs only its suite', () => {
  assert.deepEqual(targets(['src/site/picking-render.js']), ['picking-intervals']);
  assert.deepEqual(targets(['src/site/note-finder.js']), ['note-finder']);
  assert.deepEqual(targets(['src/site/score-editor.js', 'src/site/score-editor.css']), ['score-editor']);
});

test('a score change runs only the articles suite', () => {
  assert.deepEqual(targets(['scripts/sagreras/pieces/sagreras-86.json', 'scripts/lib/article-sagreras.js']), ['articles']);
});

test('shared chord data fans out to its consumers', () => {
  const run = targets(['src/shared/chords-db.js']);
  for (const n of ['chord-finder', 'note-finder', 'articles', 'extensions']) assert.ok(run.includes(n), n);
  assert.ok(!run.includes('picking-intervals'));
});

test('build, i18n and package changes run everything', () => {
  for (const f of ['package.json', 'src/i18n/strings.es.json', 'scripts/build-site.js', 'src/site/css/site.css']) {
    assert.deepEqual(targets([f]), ALL, f);
  }
});

test('an unclaimed source file runs everything', () => {
  assert.deepEqual(targets(['src/site/something-new.js']), ALL);
});

test('every suite has an e2e test file', () => {
  for (const name of ALL) assert.ok(fs.existsSync(path.join(__dirname, name + '.e2e.js')), name);
});
