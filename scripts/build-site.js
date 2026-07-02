#!/usr/bin/env node
'use strict';
/* build-site.js — Generates dist/site from src/site + src/shared + src/i18n.
   Produces two locales:
     dist/site/index.html       (ES, at /)
     dist/site/en/index.html    (EN, at /en/)
   Assets are shared via dist/site/assets/. */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC_SITE = path.join(ROOT, 'src', 'site');
const SRC_SHARED = path.join(ROOT, 'src', 'shared');
const SRC_I18N = path.join(ROOT, 'src', 'i18n');
const SRC_VENDOR = path.join(ROOT, 'vendor');
const DIST_SITE = path.join(ROOT, 'dist', 'site');

// ---- helpers ---------------------------------------------------------------

function say(msg) { process.stdout.write('  ' + msg + '\n'); }
function fail(msg) { process.stderr.write('ERROR: ' + msg + '\n'); process.exit(1); }

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dst) {
  fs.copyFileSync(src, dst);
  say(path.relative(ROOT, src) + ' → ' + path.relative(ROOT, dst));
}

// ---- validation ------------------------------------------------------------

const SVGUITAR = path.join(SRC_VENDOR, 'svguitar.umd.js');
if (!fs.existsSync(SVGUITAR)) {
  fail('vendor/svguitar.umd.js not found. Run: npm run vendor');
}

// ---- template rendering ----------------------------------------------------

const template = fs.readFileSync(path.join(SRC_SITE, 'template.html'), 'utf8');
const LOCALES = ['es', 'en'];

// Build the chord-finder i18n subset (only the cfXxx keys).
function finderI18N(strings) {
  const keys = ['cfFilters', 'cfEmpty', 'cfPinLabel', 'cfPinnedLabel', 'cfPinnedTitle', 'cfToolbarAriaLabel', 'cfUnpinAriaLabel'];
  const out = {};
  keys.forEach(function (k) { if (strings[k] !== undefined) out[k] = strings[k]; });
  return out;
}

// Build the decoder table rows from the row* keys.
const ROW_KEYS = ['rowRoot','rowMajor','rowMinor','rowDom7','rowMinor7','rowMaj7','rowDim','rowHalfDim','rowAug','rowSus','rowAdd','rowExt','rowSlash'];
function decoderRows(strings) {
  return ROW_KEYS.map(function (key) {
    const row = strings[key] || ['', '', '', ''];
    return '<tr><td>' + row[0] + '</td><td>' + row[1] + '</td><td>' + row[2] + '</td><td>' + row[3] + '</td></tr>';
  }).join('\n    ');
}

// Build the extension CTA button.
function ctaButton(strings) {
  const storeUrl = process.env.EXTENSION_STORE_URL || '';
  if (storeUrl) {
    return '<a class="ext-btn" href="' + storeUrl + '" target="_blank" rel="noopener">' + strings.extensionAddButton + '</a>';
  }
  return '<span class="ext-btn">' + strings.extensionComingSoon + '</span>';
}

// Replace all %%KEY%% placeholders in the template.
function render(template, strings, locale) {
  const assetsPrefix = locale === 'es' ? 'assets/' : '../assets/';
  let html = template;

  // Simple key substitutions.
  const simpleKeys = [
    'htmlLang', 'pageTitle', 'wordmark', 'wordmarkSmall',
    'altLangLabel', 'altLangHref',
    'h1', 'lead', 'h2Decoder', 'decoderIntro',
    'thPart', 'thSymbols', 'thMeaning', 'thExample',
    'callout',
    'extensionHeading', 'extensionDescription',
  ];
  simpleKeys.forEach(function (key) {
    html = html.split('%%' + key + '%%').join(strings[key] || '');
  });

  // Computed substitutions.
  html = html.split('%%ASSETS_PREFIX%%').join(assetsPrefix);
  html = html.split('%%DECODER_ROWS%%').join(decoderRows(strings));
  html = html.split('%%EXTENSION_CTA_BUTTON%%').join(ctaButton(strings));
  html = html.split('%%CHORD_FINDER_I18N%%').join(JSON.stringify(finderI18N(strings)));

  return html;
}

// ---- build -----------------------------------------------------------------

console.log('==> Building site assets...');

const ASSETS_DIST = path.join(DIST_SITE, 'assets');
const VENDOR_DIST = path.join(ASSETS_DIST, 'vendor');
ensureDir(ASSETS_DIST);
ensureDir(VENDOR_DIST);

// Shared JS.
['chords-db.js', 'chord-diagram.js', 'chord-search.js'].forEach(function (f) {
  copyFile(path.join(SRC_SHARED, f), path.join(ASSETS_DIST, f));
});
// Site-specific JS and CSS.
copyFile(path.join(SRC_SITE, 'chord-finder.js'), path.join(ASSETS_DIST, 'chord-finder.js'));
copyFile(path.join(SRC_SITE, 'site.css'), path.join(ASSETS_DIST, 'site.css'));
// Vendored svguitar.
copyFile(path.join(SRC_VENDOR, 'svguitar.umd.js'), path.join(VENDOR_DIST, 'svguitar.umd.js'));

console.log('==> Rendering locale pages...');

LOCALES.forEach(function (locale) {
  const stringsPath = path.join(SRC_I18N, 'strings.' + locale + '.json');
  if (!fs.existsSync(stringsPath)) fail('Missing: ' + stringsPath);
  const strings = JSON.parse(fs.readFileSync(stringsPath, 'utf8'));

  const outDir = locale === 'es' ? DIST_SITE : path.join(DIST_SITE, 'en');
  ensureDir(outDir);

  const html = render(template, strings, locale);
  const outFile = path.join(outDir, 'index.html');
  fs.writeFileSync(outFile, html, 'utf8');
  say(path.relative(ROOT, outFile));
});

console.log('==> Done. Site output: dist/site/');
