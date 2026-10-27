#!/usr/bin/env node
/* Decides which e2e suites a change needs. Reads changed file paths (one per
   line) from stdin and prints the CI matrix as JSON. With no input, or with
   `--all`, prints every suite. A file matched by SHARED, or claimed by no
   suite, runs all of them; docs, backend and unit tests run none. */

/* The article suites (test/articles-<name>.e2e.js) share the page template, the
   score renderers and the harness, so those fan out to all of them; a score or
   a collection-specific renderer runs only its own suite. */
const ARTICLE_COMMON = [
  /^src\/site\/(article\.html|score-fingering\.js)$/,
  /^src\/shared\//,
  /^scripts\/lib\/(score-|editor-marks|chord-forms|structured-data|lastmod|fingerprint|article-(link|carcassi)\.js)/,
  /^scripts\/og-articles/,
  /^test\/articles-harness\./,
];
const articleSuite = (...specific) => ({ build: 'site', paths: [...specific, ...ARTICLE_COMMON] });
const ARTICLE_SUITES = {
  'articles-carcassi': articleSuite(/^src\/site\/(articles\/carcassi\/|og-score-carcassi\.)/, /^scripts\/articles\/carcassi\//, /^test\/articles-carcassi\./),
  'articles-arpeggios': articleSuite(/^src\/site\/(articles\/arpeggios\/|og-score-arpeggios\.)/, /^scripts\/lib\/article-arpeggio/, /^test\/(articles-arpeggios|arpeggio-layout)\./),
  'articles-preludios': articleSuite(/^src\/site\/(articles\/(carcassi|santisteban)-preludios\/|og-score-preludes\.)/, /^scripts\/carcassi-preludios\//, /^scripts\/lib\/article-carcassi-preludes\.js$/, /^test\/articles-preludios\./),
  'articles-progresivas': articleSuite(/^src\/site\/articles\/carcassi-progresivas\//, /^scripts\/carcassi-progresivas\//, /^scripts\/lib\/article-carcassi-progressive\.js$/, /^test\/articles-progresivas\./),
  'articles-valses': articleSuite(/^src\/site\/articles\/carcassi-valses\//, /^scripts\/carcassi-valses\//, /^test\/articles-valses\./),
  'articles-aguado': articleSuite(/^src\/site\/articles\/aguado\//, /^scripts\/aguado\//, /^scripts\/lib\/article-aguado\.js$/, /^test\/articles-aguado\./),
  'articles-sagreras': articleSuite(/^src\/site\/articles\/sagreras-lecciones\//, /^scripts\/sagreras\//, /^scripts\/lib\/article-sagreras\.js$/, /^test\/articles-sagreras\./),
  'articles-sor': articleSuite(/^src\/site\/articles\/sor\//, /^scripts\/sor\//, /^scripts\/lib\/article-sor(-collection)?\.js$/, /^test\/articles-sor\./),
  'articles-sor-estudios': articleSuite(/^src\/site\/articles\/sor-estudios\//, /^scripts\/sor\//, /^scripts\/lib\/article-sor(-collection|-estudios)\.js$/, /^test\/articles-sor-estudios\./),
  'articles-barrios': articleSuite(/^src\/site\/articles\/barrios\//, /^scripts\/barrios\//, /^scripts\/lib\/article-barrios\.js$/, /^test\/articles-barrios\./),
  'articles-giuliani': articleSuite(/^src\/site\/articles\/giuliani\//, /^scripts\/giuliani\//, /^scripts\/lib\/article-giuliani\.js$/, /^test\/articles-giuliani\./),
  'articles-giuliani-arpegios': articleSuite(/^src\/site\/articles\/giuliani-arpegios\//, /^scripts\/giuliani-arpegios\//, /^scripts\/lib\/article-giuliani-arpegios\.js$/, /^test\/articles-giuliani-arpegios\./),
  'articles-site': articleSuite(/^test\/articles-site\./),
};

const SUITES = {
  'chord-finder': {
    build: false,
    paths: [
      /^src\/site\/chord-finder\.js$/,
      /^src\/shared\/(chords-db|chord-positions|chord-search|note-names)\.js$/,
      /^test\/chord-finder\./,
      /^vendor\//,
    ],
  },
  'note-finder': {
    build: false,
    paths: [
      /^src\/site\/note-finder\.js$/,
      /^src\/shared\/(chords-db|chord-positions|note-match|note-names)\.js$/,
      /^test\/note-finder\./,
    ],
  },
  'tab-editor': {
    build: 'site',
    paths: [
      /^src\/shared\/tab-(editor|demo)\./,
      /^src\/site\/(tab-editor|tab-editor-promo|sixths-exercise)\.html$/,
      /^scripts\/lib\/(tab-editor|tab-tutorial|tab-icon|ascii-tab|modal)\.js$/,
      /^test\/tab-editor\./,
    ],
  },
  'picking-intervals': {
    build: 'site',
    paths: [/^src\/site\/picking-/, /^test\/picking-intervals\./],
  },
  'fifths-wheel': {
    build: 'site',
    paths: [
      /^src\/site\/(fifths-wheel|circle-fifths)/,
      /^src\/shared\/(circle-render|note-names)\.js$/,
      /^scripts\/og-fifths\.js$/,
      /^test\/fifths-wheel\./,
    ],
  },
  'score-editor': {
    build: 'site',
    paths: [
      /^src\/site\/score-(editor|model|confirm)\./,
      /^test\/score-editor\./,
    ],
  },
  partitura: {
    build: 'site',
    paths: [
      /^src\/site\/partitura/,
      /^scripts\/(og-partitura\.js|partitura-example\/)/,
      /^docs\/partitura-api\.md$/,
      /^test\/partitura\./,
    ],
  },
  extensions: {
    build: 'ext',
    paths: [
      /^src\/extensions\//,
      /^src\/shared\//,
      /^scripts\/build-ext\.js$/,
      /^scripts\/lib\/(extension-products|icon-png)\.js$/,
      /^test\/extensions\./,
    ],
  },
  ...ARTICLE_SUITES,
};

/* Touching any of these can affect every page or every suite. */
const SHARED = [
  /^package(-lock)?\.json$/,
  /^\.nvmrc$/,
  /^\.github\/workflows\/ci\.yml$/,
  /^scripts\/(build-site|vendor|ci-e2e-targets)\.js$/,
  /^scripts\/lib\/(static-server|slugs|chrome-path|minify-assets|site-css)\.js$/,
  /^src\/i18n\//,
  /^src\/site\/(template\.html|sw\.js|toast\.js|css\/)/,
];

/* Paths that never affect an e2e test. */
const IRRELEVANT = [
  /^(docs|store|backend|infra|downloads)\//,
  /\.md$/,
  /^test\/.*\.unit\.js$/,
  /^\.github\/workflows\/backend\.yml$/,
];

const claimedBy = (file) => Object.keys(SUITES).filter((n) => SUITES[n].paths.some((re) => re.test(file)));

function targets(files) {
  const names = Object.keys(SUITES);
  const relevant = files.filter((f) => claimedBy(f).length || !IRRELEVANT.some((re) => re.test(f)));
  if (relevant.some((f) => SHARED.some((re) => re.test(f)))) return names;
  if (relevant.some((f) => !claimedBy(f).length)) return names;
  return names.filter((n) => relevant.some((f) => claimedBy(f).includes(n)));
}

function matrix(names) {
  return { include: names.map((name) => ({ name, build: SUITES[name].build })) };
}

if (require.main === module) {
  const input = require('node:fs').readFileSync(0, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
  const all = process.argv.includes('--all') || !input.length;
  process.stdout.write(JSON.stringify(matrix(all ? Object.keys(SUITES) : targets(input))) + '\n');
}

module.exports = { SUITES, targets, matrix };
