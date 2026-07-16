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
const { execSync } = require('child_process');
const { drawIcon } = require('./lib/icon-png');

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
const JSPDF = path.join(SRC_VENDOR, 'jspdf.umd.min.js');
if (!fs.existsSync(JSPDF)) {
  fail('vendor/jspdf.umd.min.js not found. Run: npm run vendor');
}

// ---- template rendering ----------------------------------------------------

const template = fs.readFileSync(path.join(SRC_SITE, 'template.html'), 'utf8');
const v7Template = fs.readFileSync(path.join(SRC_SITE, 'v7-guide.html'), 'utf8');
const LOCALES = ['es', 'en'];

// Build the chord-finder i18n subset (only the cfXxx keys).
function finderI18N(strings) {
  const keys = ['cfFilters', 'cfFilterCategoryType', 'cfFilterCategoryKey', 'cfClearFilters', 'cfRootLabels', 'cfEmpty', 'cfPinLabel', 'cfPinnedLabel', 'cfPinnedTitle', 'cfClearPinned', 'cfExportPdf', 'cfToolbarAriaLabel', 'cfUnpinAriaLabel', 'cfAdvancedFiltersLabel', 'cfNotationGroupLabel', 'cfNotationAmerican', 'cfNotationSpanish', 'cfLoadMore'];
  const out = {};
  keys.forEach(function (k) { if (strings[k] !== undefined) out[k] = strings[k]; });
  out.cfWordmark = strings.wordmark;
  out.cfWordmarkSmall = strings.wordmarkSmall;
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
  const storeUrl = process.env.EXTENSION_STORE_URL || 'https://chromewebstore.google.com/detail/guitar-chords/chigeaalpomifocjjhgcpblcepigajme';
  return '<a class="ext-btn" href="' + storeUrl + '" target="_blank" rel="noopener">' + strings.extensionAddButton + '</a>';
}

// Replace all %%KEY%% placeholders in the template.
function altLangHref(locale, outputMode) {
  if (locale === 'es') return 'en';
  return outputMode === 'clean' ? './' : '../';
}

function canonicalUrl(locale) {
  return locale === 'es' ? SITE_BASE_URL + '/' : SITE_BASE_URL + '/en';
}

function v7PageHref(locale, slug) {
  const s = slug || 'v7';
  return locale === 'es' ? '/' + s : '/en/' + s;
}

function v7CanonicalUrl(locale, slug) {
  return SITE_BASE_URL + v7PageHref(locale, slug);
}

function homeHref(locale) {
  return locale === 'es' ? '/' : '/en';
}

// Pages rendered from the shared src/site/v7-guide.html template — one for
// major chords, one for minor chords. Same layout, different i18n keys,
// data script, and cross-link to the other page.
const V7_PAGES = [
  {
    slug: 'v7',
    scriptFile: 'v7-guide.js',
    titleKey: 'v7PageTitle', metaKey: 'v7MetaDescription', h1Key: 'v7H1', leadKey: 'v7Lead',
    otherSlug: 'v7-menor', otherLabelKey: 'v7SeeMinorLink',
  },
  {
    slug: 'v7-menor',
    scriptFile: 'v7-minor.js',
    titleKey: 'v7mPageTitle', metaKey: 'v7mMetaDescription', h1Key: 'v7mH1', leadKey: 'v7mLead',
    otherSlug: 'v7', otherLabelKey: 'v7SeeMajorLink',
  },
];

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
    'v7NavLabel',
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
  html = html.split('%%MANIFEST_HREF%%').join(resolvedAssetsPrefix + 'manifest.' + locale + '.webmanifest');
  html = html.split('%%SW_PATH%%').join('/sw.js');
  html = html.split('%%V7_PAGE_HREF%%').join(v7PageHref(locale));

  return html;
}

// Render a "chords and their V7" page (src/site/v7-guide.html, shared by all
// entries in V7_PAGES) for one locale.
function renderV7Page(template, strings, locale, page) {
  const resolvedAssetsPrefix = locale === 'es' ? 'assets/' : '../assets/';
  const ogImage = SITE_BASE_URL + '/assets/og-image.png';
  let html = template;

  const simpleKeys = [
    'htmlLang', 'wordmark', 'wordmarkSmall', 'altLangLabel',
    'v7ColTonic', 'v7ColDominant',
    'extensionHeading', 'extensionDescription',
  ];
  simpleKeys.forEach(function (key) {
    html = html.split('%%' + key + '%%').join(strings[key] || '');
  });

  html = html.split('%%PAGE_TITLE%%').join(strings[page.titleKey] || '');
  html = html.split('%%PAGE_META_DESCRIPTION%%').join(strings[page.metaKey] || '');
  html = html.split('%%PAGE_H1%%').join(strings[page.h1Key] || '');
  html = html.split('%%PAGE_LEAD%%').join(strings[page.leadKey] || '');
  html = html.split('%%OTHER_PAGE_HREF%%').join(v7PageHref(locale, page.otherSlug));
  html = html.split('%%OTHER_PAGE_LABEL%%').join(strings[page.otherLabelKey] || '');
  html = html.split('%%PAGE_SCRIPT%%').join(resolvedAssetsPrefix + page.scriptFile);

  html = html.split('%%ASSETS_PREFIX%%').join(resolvedAssetsPrefix);
  html = html.split('%%homeHref%%').join(homeHref(locale));
  html = html.split('%%altLangHref%%').join(locale === 'es' ? v7PageHref('en', page.slug) : v7PageHref('es', page.slug));
  html = html.split('%%canonicalUrl%%').join(v7CanonicalUrl(locale, page.slug));
  html = html.split('%%hreflangEs%%').join(SITE_BASE_URL + v7PageHref('es', page.slug));
  html = html.split('%%hreflangEn%%').join(SITE_BASE_URL + v7PageHref('en', page.slug));
  html = html.split('%%ogImage%%').join(ogImage);
  html = html.split('%%EXTENSION_CTA_BUTTON%%').join(ctaButton(strings));
  html = html.split('%%MANIFEST_HREF%%').join(resolvedAssetsPrefix + 'manifest.' + locale + '.webmanifest');
  html = html.split('%%SW_PATH%%').join('/sw.js');

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
copyFile(path.join(SRC_SITE, 'v7-guide.js'), path.join(ASSETS_DIST, 'v7-guide.js'));
copyFile(path.join(SRC_SITE, 'v7-minor.js'), path.join(ASSETS_DIST, 'v7-minor.js'));
copyFile(path.join(SRC_SHARED, 'v7-page-render.js'), path.join(ASSETS_DIST, 'v7-page-render.js'));
copyFile(path.join(SRC_SHARED, 'v7-chord-overrides.js'), path.join(ASSETS_DIST, 'v7-chord-overrides.js'));
copyFile(path.join(SRC_SITE, 'site.css'), path.join(ASSETS_DIST, 'site.css'));
copyFile(path.join(SRC_EXT, 'icon-source.svg'), path.join(ASSETS_DIST, 'favicon.svg'));
// Vendored svguitar, fuzzysort, and jsPDF.
copyFile(path.join(SRC_VENDOR, 'svguitar.umd.js'), path.join(VENDOR_DIST, 'svguitar.umd.js'));
copyFile(path.join(SRC_VENDOR, 'fuzzysort.js'), path.join(VENDOR_DIST, 'fuzzysort.js'));
copyFile(path.join(SRC_VENDOR, 'jspdf.umd.min.js'), path.join(VENDOR_DIST, 'jspdf.umd.min.js'));
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

// ---- PWA: icons ------------------------------------------------------------
// PNG icons for the web app manifest, generated from the site logo. Prefer
// rsvg-convert (crisp, anti-aliased) and fall back to the pure-JS renderer so
// the build works on CI runners without librsvg installed.

console.log('==> Generating PWA icons...');
const ICONS_DIST = path.join(ASSETS_DIST, 'icons');
ensureDir(ICONS_DIST);
const PWA_ICON_SIZES = [192, 512];
const maskableSvg = path.join(SRC_SITE, 'icon-maskable.svg');
const hasRsvg = (() => {
  try { execSync('rsvg-convert --version', { stdio: 'ignore' }); return true; } catch { return false; }
})();
PWA_ICON_SIZES.forEach(function (size) {
  const out = path.join(ICONS_DIST, 'icon-' + size + '.png');
  if (hasRsvg && fs.existsSync(maskableSvg)) {
    execSync('rsvg-convert -w ' + size + ' -h ' + size + ' "' + maskableSvg + '" -o "' + out + '"');
  } else {
    drawIcon(size, out);
  }
  say('assets/icons/icon-' + size + '.png' + (hasRsvg ? '' : ' (js fallback)'));
});

// ---- PWA: web app manifest (one per locale) --------------------------------

console.log('==> Writing web app manifests...');
function writeManifest(locale, strings) {
  const name = locale === 'es' ? 'Acordes para la guitarra' : 'Guitar Chords';
  const shortName = strings.wordmark || name;
  const manifest = {
    name: name,
    short_name: shortName,
    description: strings.metaDescription || '',
    lang: strings.htmlLang || locale,
    start_url: locale === 'es' ? '/' : '/en',
    scope: '/',
    display: 'standalone',
    background_color: '#fdfaf5',
    theme_color: '#fdfaf5',
    icons: [
      { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };
  const out = path.join(ASSETS_DIST, 'manifest.' + locale + '.webmanifest');
  fs.writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  say(path.relative(ROOT, out));
}

// ---- PWA: service worker (root scope, offline app-shell) -------------------

console.log('==> Writing service worker...');
const swTemplate = fs.readFileSync(path.join(SRC_SITE, 'sw.js'), 'utf8');
const cacheVersion = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
const precacheUrls = [
  '/', '/en',
  '/assets/site.css',
  '/assets/favicon.svg',
  '/assets/chords-db.js',
  '/assets/chord-diagram.js',
  '/assets/chord-search.js',
  '/assets/note-names.js',
  '/assets/chord-finder.js',
  '/assets/vendor/svguitar.umd.js',
  '/assets/vendor/fuzzysort.js',
  '/assets/vendor/jspdf.umd.min.js',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
];
const swOut = swTemplate
  .split('%%CACHE_VERSION%%').join(cacheVersion)
  .split('%%PRECACHE_URLS%%').join(JSON.stringify(precacheUrls))
  .split('%%START_URL%%').join('/');
const swFile = path.join(DIST_SITE, 'sw.js');
fs.writeFileSync(swFile, swOut, 'utf8');
say(path.relative(ROOT, swFile));

console.log('==> Rendering locale pages...');

LOCALES.forEach(function (locale) {
  const stringsPath = path.join(SRC_I18N, 'strings.' + locale + '.json');
  if (!fs.existsSync(stringsPath)) fail('Missing: ' + stringsPath);
  const strings = JSON.parse(fs.readFileSync(stringsPath, 'utf8'));

  writeManifest(locale, strings);

  if (locale === 'es') {
    const html = render(template, strings, locale, 'assets/', 'root');
    const outFile = path.join(DIST_SITE, 'index.html');
    fs.writeFileSync(outFile, html, 'utf8');
    say(path.relative(ROOT, outFile));

    V7_PAGES.forEach(function (page) {
      const v7Html = renderV7Page(v7Template, strings, locale, page);
      const v7OutFile = path.join(DIST_SITE, page.slug + '.html');
      fs.writeFileSync(v7OutFile, v7Html, 'utf8');
      say(path.relative(ROOT, v7OutFile));
    });
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

  V7_PAGES.forEach(function (page) {
    const v7Html = renderV7Page(v7Template, strings, locale, page);
    const v7OutFile = path.join(localeDir, page.slug + '.html');
    fs.writeFileSync(v7OutFile, v7Html, 'utf8');
    say(path.relative(ROOT, v7OutFile));
  });
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
  '    <loc>' + SITE_BASE_URL + '/v7</loc>',
  '    <lastmod>' + today + '</lastmod>',
  '    <changefreq>monthly</changefreq>',
  '    <priority>0.6</priority>',
  '    <xhtml:link rel="alternate" hreflang="es" href="' + SITE_BASE_URL + '/v7"/>',
  '    <xhtml:link rel="alternate" hreflang="en" href="' + SITE_BASE_URL + '/en/v7"/>',
  '  </url>',
  '  <url>',
  '    <loc>' + SITE_BASE_URL + '/en/v7</loc>',
  '    <lastmod>' + today + '</lastmod>',
  '    <changefreq>monthly</changefreq>',
  '    <priority>0.5</priority>',
  '    <xhtml:link rel="alternate" hreflang="es" href="' + SITE_BASE_URL + '/v7"/>',
  '    <xhtml:link rel="alternate" hreflang="en" href="' + SITE_BASE_URL + '/en/v7"/>',
  '  </url>',
  '  <url>',
  '    <loc>' + SITE_BASE_URL + '/v7-menor</loc>',
  '    <lastmod>' + today + '</lastmod>',
  '    <changefreq>monthly</changefreq>',
  '    <priority>0.5</priority>',
  '    <xhtml:link rel="alternate" hreflang="es" href="' + SITE_BASE_URL + '/v7-menor"/>',
  '    <xhtml:link rel="alternate" hreflang="en" href="' + SITE_BASE_URL + '/en/v7-menor"/>',
  '  </url>',
  '  <url>',
  '    <loc>' + SITE_BASE_URL + '/en/v7-menor</loc>',
  '    <lastmod>' + today + '</lastmod>',
  '    <changefreq>monthly</changefreq>',
  '    <priority>0.4</priority>',
  '    <xhtml:link rel="alternate" hreflang="es" href="' + SITE_BASE_URL + '/v7-menor"/>',
  '    <xhtml:link rel="alternate" hreflang="en" href="' + SITE_BASE_URL + '/en/v7-menor"/>',
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
