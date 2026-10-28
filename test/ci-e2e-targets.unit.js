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

test('a score change runs only its article suite', () => {
  assert.deepEqual(targets(['scripts/sagreras/pieces/sagreras-86.json', 'scripts/lib/article-sagreras.js']), ['articles-sagreras']);
  assert.deepEqual(targets(['scripts/lib/article-sor-estudios.js']), ['articles-sor-estudios']);
});

test('each article asset, source and test runs only its own suite', () => {
  const cases = {
    'articles-aguado': ['src/site/articles/aguado/aguado-01.svg', 'src/site/articles/aguado/body.es.html', 'scripts/aguado/pieces.json', 'test/articles-aguado.e2e.js'],
    'articles-sagreras': ['src/site/articles/sagreras-lecciones/body.en.html', 'scripts/sagreras/build.py'],
    'articles-preludios': ['src/site/articles/santisteban-preludios/x.svg', 'src/site/og-score-preludes.png', 'scripts/carcassi-preludios/corrected/prelude-01.musicxml'],
    'articles-giuliani': ['src/site/articles/giuliani/body.es.html', 'scripts/lib/article-giuliani.js'],
    'articles-giuliani-arpegios': ['src/site/articles/giuliani-arpegios/x.svg', 'scripts/giuliani-arpegios/build.py'],
    'articles-arpeggios': ['test/articles-arpeggios.e2e.js'],
    'articles-arpeggio-layout': ['test/articles-arpeggio-layout.e2e.js'],
    'articles-site': ['test/articles-site.e2e.js'],
  };
  for (const [suite, files] of Object.entries(cases)) {
    for (const file of files) assert.deepEqual(targets([file]), [suite], file);
  }
  assert.deepEqual(targets(['scripts/sor/pieces.json']).sort(), ['articles-sor', 'articles-sor-estudios']);
  for (const file of ['src/site/articles/arpeggios/preview.svg', 'scripts/lib/article-arpeggio-positions.js']) {
    assert.deepEqual(targets([file]).sort(), ['articles-arpeggio-layout', 'articles-arpeggios'], file);
  }
});

test('the shared article template and harness run every article suite', () => {
  const articles = ALL.filter((n) => n.startsWith('articles-'));
  assert.deepEqual(targets(['src/site/article.html']), articles);
  assert.deepEqual(targets(['test/articles-harness.js']), articles);
});

test('shared chord data fans out to its consumers', () => {
  const run = targets(['src/shared/chords-db.js']);
  for (const n of ['chord-finder', 'note-finder', 'articles-carcassi', 'articles-sagreras', 'extensions']) assert.ok(run.includes(n), n);
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
