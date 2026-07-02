#!/usr/bin/env node
'use strict';
/* build-site.js — Generates dist/site from src/site + src/shared + src/i18n.
   Produces two locales:
     dist/site/index.html       (ES, at /)
     dist/site/en.html          (EN, at /en)
     dist/site/en/index.html    (EN, at /en/)
   Assets are shared via dist/site/assets/.

   Env vars:
     SITE_BASE_URL         Base URL without trailing slash (default: https://acordesdeguitarra.com.ar)
     EXTENSION_STORE_URL   Chrome Web Store URL — enables the "Add to Chrome" button
*/

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC_SITE = path.join(ROOT, 'src', 'site');
const SRC_SHARED = path.join(ROOT, 'src', 'shared');
const SRC_I18N = path.join(ROOT, 'src', 'i18n');
const SRC_EXT = path.join(ROOT, 'src', 'extension');
const SRC_VENDOR = path.join(ROOT, 'vendor');
const SRC_STORE = path.join(ROOT, 'store');
const DIST_SITE = path.join(ROOT, 'dist', 'site');

// Base URL for canonical/OG tags (no trailing slash).
const SITE_BASE_URL = (process.env.SITE_BASE_URL || 'https://acordesdeguitarra.com.ar').replace(/\/$/, '');
const SITE_HOSTNAME = new URL(SITE_BASE_URL).hostname;

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
const FUZZYSORT = path.join(SRC_VENDOR, 'fuzzysort.js');
if (!fs.existsSync(FUZZYSORT)) {
  fail('vendor/fuzzysort.js not found. Run: npm run vendor');
}

// ---- template rendering ----------------------------------------------------

const template = fs.readFileSync(path.join(SRC_SITE, 'template.html'), 'utf8');
const LOCALES = ['es', 'en'];

// Build the chord-finder i18n subset (only the cfXxx keys).
function finderI18N(strings) {
  const keys = ['cfFilters', 'cfEmpty', 'cfPinLabel', 'cfPinnedLabel', 'cfPinnedTitle', 'cfToolbarAriaLabel', 'cfUnpinAriaLabel', 'cfNotationToggleToSpanish', 'cfNotationToggleToEnglish'];
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
  return '<button class="ext-btn" type="button" disabled aria-disabled="true">' + strings.extensionComingSoon + '</button>';
}

// Replace all %%KEY%% placeholders in the template.
function altLangHref(locale, outputMode) {
  if (locale === 'es') return 'en';
  return outputMode === 'clean' ? './' : '../';
}

function canonicalUrl(locale) {
  return locale === 'es' ? SITE_BASE_URL + '/' : SITE_BASE_URL + '/en';
}

function render(template, strings, locale, assetsPrefix, outputMode) {
  const resolvedAssetsPrefix = assetsPrefix || (locale === 'es' ? 'assets/' : '../assets/');
  const ogImage = SITE_BASE_URL + '/assets/og-image.png';
  let html = template;

  // Simple key substitutions.
  const simpleKeys = [
    'htmlLang', 'pageTitle', 'metaDescription', 'wordmark', 'wordmarkSmall',
    'altLangLabel',
    'h1', 'lead', 'h2Decoder', 'decoderIntro',
    'thPart', 'thSymbols', 'thMeaning', 'thExample',
    'extensionHeading', 'extensionDescription',
  ];
  simpleKeys.forEach(function (key) {
    html = html.split('%%' + key + '%%').join(strings[key] || '');
  });

  // Computed substitutions.
  html = html.split('%%ASSETS_PREFIX%%').join(resolvedAssetsPrefix);
  html = html.split('%%altLangHref%%').join(altLangHref(locale, outputMode));
  html = html.split('%%canonicalUrl%%').join(canonicalUrl(locale));
  html = html.split('%%hreflangEs%%').join(SITE_BASE_URL + '/');
  html = html.split('%%hreflangEn%%').join(SITE_BASE_URL + '/en');
  html = html.split('%%ogImage%%').join(ogImage);
  html = html.split('%%DECODER_ROWS%%').join(decoderRows(strings));
  html = html.split('%%EXTENSION_CTA_BUTTON%%').join(ctaButton(strings));
  html = html.split('%%CHORD_FINDER_I18N%%').join(JSON.stringify(finderI18N(strings)));

  return html;
}

// ---- build -----------------------------------------------------------------

console.log('==> Building site assets...');

fs.rmSync(DIST_SITE, { recursive: true, force: true });
const ASSETS_DIST = path.join(DIST_SITE, 'assets');
const VENDOR_DIST = path.join(ASSETS_DIST, 'vendor');
ensureDir(ASSETS_DIST);
ensureDir(VENDOR_DIST);

// Shared JS.
['chords-db.js', 'chord-diagram.js', 'chord-search.js', 'note-names.js'].forEach(function (f) {
  copyFile(path.join(SRC_SHARED, f), path.join(ASSETS_DIST, f));
});
// Site-specific JS and CSS.
copyFile(path.join(SRC_SITE, 'chord-finder.js'), path.join(ASSETS_DIST, 'chord-finder.js'));
copyFile(path.join(SRC_SITE, 'site.css'), path.join(ASSETS_DIST, 'site.css'));
copyFile(path.join(SRC_EXT, 'icon-source.svg'), path.join(ASSETS_DIST, 'favicon.svg'));
// Vendored svguitar and fuzzysort.
copyFile(path.join(SRC_VENDOR, 'svguitar.umd.js'), path.join(VENDOR_DIST, 'svguitar.umd.js'));
copyFile(path.join(SRC_VENDOR, 'fuzzysort.js'), path.join(VENDOR_DIST, 'fuzzysort.js'));
// OG image (optional — skip silently if not present yet).
const ogImageSrc = path.join(SRC_SITE, 'og-image.png');
if (fs.existsSync(ogImageSrc)) {
  copyFile(ogImageSrc, path.join(ASSETS_DIST, 'og-image.png'));
} else {
  say('(src/site/og-image.png not found — og:image will 404 until added)');
}
// Store-facing static pages.
const storeDist = path.join(DIST_SITE, 'store');
ensureDir(storeDist);
copyFile(path.join(SRC_STORE, 'privacy-policy.html'), path.join(storeDist, 'privacy-policy.html'));

console.log('==> Rendering locale pages...');

LOCALES.forEach(function (locale) {
  const stringsPath = path.join(SRC_I18N, 'strings.' + locale + '.json');
  if (!fs.existsSync(stringsPath)) fail('Missing: ' + stringsPath);
  const strings = JSON.parse(fs.readFileSync(stringsPath, 'utf8'));

  if (locale === 'es') {
    const html = render(template, strings, locale, 'assets/', 'root');
    const outFile = path.join(DIST_SITE, 'index.html');
    fs.writeFileSync(outFile, html, 'utf8');
    say(path.relative(ROOT, outFile));
    return;
  }

  const localeDir = path.join(DIST_SITE, locale);
  ensureDir(localeDir);

  const cleanHtml = render(template, strings, locale, 'assets/', 'clean');
  const cleanUrlFile = path.join(DIST_SITE, locale + '.html');
  fs.writeFileSync(cleanUrlFile, cleanHtml, 'utf8');
  say(path.relative(ROOT, cleanUrlFile));

  const html = render(template, strings, locale, '../assets/', 'nested');
  const outFile = path.join(localeDir, 'index.html');
  fs.writeFileSync(outFile, html, 'utf8');
  say(path.relative(ROOT, outFile));
});

// ---- robots.txt ------------------------------------------------------------

console.log('==> Writing robots.txt...');
const robotsTxt = [
  'User-agent: *',
  'Allow: /',
  '',
  'Sitemap: ' + SITE_BASE_URL + '/sitemap.xml',
  '',
].join('\n');
const robotsFile = path.join(DIST_SITE, 'robots.txt');
fs.writeFileSync(robotsFile, robotsTxt, 'utf8');
say(path.relative(ROOT, robotsFile));

// ---- sitemap.xml -----------------------------------------------------------

console.log('==> Writing sitemap.xml...');
const today = new Date().toISOString().slice(0, 10);
const sitemapXml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
  '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  '  <url>',
  '    <loc>' + SITE_BASE_URL + '/</loc>',
  '    <lastmod>' + today + '</lastmod>',
  '    <changefreq>monthly</changefreq>',
  '    <priority>1.0</priority>',
  '    <xhtml:link rel="alternate" hreflang="es" href="' + SITE_BASE_URL + '/"/>',
  '    <xhtml:link rel="alternate" hreflang="en" href="' + SITE_BASE_URL + '/en"/>',
  '  </url>',
  '  <url>',
  '    <loc>' + SITE_BASE_URL + '/en</loc>',
  '    <lastmod>' + today + '</lastmod>',
  '    <changefreq>monthly</changefreq>',
  '    <priority>0.9</priority>',
  '    <xhtml:link rel="alternate" hreflang="es" href="' + SITE_BASE_URL + '/"/>',
  '    <xhtml:link rel="alternate" hreflang="en" href="' + SITE_BASE_URL + '/en"/>',
  '  </url>',
  '  <url>',
  '    <loc>' + SITE_BASE_URL + '/store/privacy-policy.html</loc>',
  '    <lastmod>' + today + '</lastmod>',
  '    <changefreq>yearly</changefreq>',
  '    <priority>0.3</priority>',
  '  </url>',
  '</urlset>',
  '',
].join('\n');
const sitemapFile = path.join(DIST_SITE, 'sitemap.xml');
fs.writeFileSync(sitemapFile, sitemapXml, 'utf8');
say(path.relative(ROOT, sitemapFile));

// ---- CNAME (GitHub Pages custom domain) -----------------------------------

const cnameFile = path.join(DIST_SITE, 'CNAME');
fs.writeFileSync(cnameFile, SITE_HOSTNAME + '\n', 'utf8');
say(path.relative(ROOT, cnameFile));

// ---- .nojekyll (GitHub Pages) ----------------------------------------------

const noJekyll = path.join(DIST_SITE, '.nojekyll');
fs.writeFileSync(noJekyll, '', 'utf8');
say(path.relative(ROOT, noJekyll));

console.log('==> Done. Site output: dist/site/');
