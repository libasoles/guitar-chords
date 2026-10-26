#!/usr/bin/env node
/* Decides which e2e suites a change needs. Reads changed file paths (one per
   line) from stdin and prints the CI matrix as JSON. With no input, or with
   `--all`, prints every suite. A file matched by SHARED, or claimed by no
   suite, runs all of them; docs, backend and unit tests run none. */

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
  partitura: {
    build: 'site',
    paths: [
      /^src\/site\/partitura/,
      /^scripts\/(og-partitura\.js|partitura-example\/)/,
      /^docs\/partitura-api\.md$/,
      /^test\/partitura\./,
    ],
  },
  articles: {
    build: 'site',
    paths: [
      /^src\/site\/(article\.html|articles\/)/,
      /^src\/shared\//,
      /^scripts\/(articles|aguado|barrios|sagreras|sor|carcassi-[^/]+)\//,
      /^scripts\/(lib\/(article-|score-|editor-marks|chord-forms|structured-data|lastmod|fingerprint)|og-articles)/,
      /^test\/(articles|arpeggio-layout)\./,
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
