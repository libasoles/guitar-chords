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
const circleTemplate = fs.readFileSync(path.join(SRC_SITE, 'circle-fifths.html'), 'utf8');
const pickingTemplate = fs.readFileSync(path.join(SRC_SITE, 'picking-lesson.html'), 'utf8');
const notFoundTemplate = fs.readFileSync(path.join(SRC_SITE, '404.html'), 'utf8');
const LOCALES = ['es', 'en'];

// Build the chord-finder i18n subset (only the cfXxx keys).
function finderI18N(strings) {
  const keys = ['cfFilters', 'cfFilterCategoryType', 'cfFilterCategoryKey', 'cfClearFilters', 'cfRootLabels', 'cfEmpty', 'cfPinLabel', 'cfPinnedLabel', 'cfPinnedTitle', 'cfClearPinned', 'cfExportPdf', 'cfToolbarAriaLabel', 'cfUnpinAriaLabel', 'cfAdvancedFiltersLabel', 'cfNotationGroupLabel', 'cfNotationAmerican', 'cfNotationSpanish', 'cfLoadMore', 'cfPosPrevLabel', 'cfPosNextLabel', 'cfPosOpen', 'cfPosBarre6', 'cfPosBarre5'];
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

// "Chords and their notes" pages rendered from src/site/circle-fifths.html —
// one for major chords, one for minor. Same layout; each loads its own data
// script and cross-links to the other below the lesson.
const CIRCLE_PAGES = [
  {
    slug: 'acordes-mayores-y-sus-notas',
    scriptFile: 'circle-fifths.js',
    titleKey: 'circlePageTitle', metaKey: 'circleMetaDescription', h1Key: 'circleH1', leadKey: 'circleLead',
    otherSlug: 'acordes-menores-y-sus-notas', otherLabelKey: 'circleSeeMinorLink',
  },
  {
    slug: 'acordes-menores-y-sus-notas',
    scriptFile: 'circle-fifths-minor.js',
    titleKey: 'circleMinorPageTitle', metaKey: 'circleMinorMetaDescription', h1Key: 'circleMinorH1', leadKey: 'circleMinorLead',
    otherSlug: 'acordes-mayores-y-sus-notas', otherLabelKey: 'circleSeeMajorLink',
  },
];
// Home-nav link points at the major "chords and their notes" page.
const CIRCLE_SLUG = CIRCLE_PAGES[0].slug;

// Static lesson pages rendered from src/site/picking-lesson.html — modal
// picking patterns with the open low E string as a pedal note. One page per
// mode; each cross-links to the other two. i18n keys are namespaced by
// `prefix` (e.g. pickingH1, pickingJonicoH1, pickingFrigioH1).
const PICKING_PAGES = [
  { slug: 'punteo-dorico-sexta-cuerda-al-aire', mode: 'dorian', prefix: 'picking', modeLabelKey: 'pickingModeDorianLabel' },
  { slug: 'punteo-jonico-sexta-cuerda-al-aire', mode: 'ionian', prefix: 'pickingJonico', modeLabelKey: 'pickingModeJonicoLabel' },
  { slug: 'punteo-frigio-sexta-cuerda-al-aire', mode: 'phrygian', prefix: 'pickingFrigio', modeLabelKey: 'pickingModeFrigioLabel' },
  { slug: 'punteo-lidio-sexta-cuerda-al-aire', mode: 'lydian', prefix: 'pickingLidio', modeLabelKey: 'pickingModeLidioLabel' },
  { slug: 'punteo-mixolidio-sexta-cuerda-al-aire', mode: 'mixolydian', prefix: 'pickingMixolidio', modeLabelKey: 'pickingModeMixolidioLabel' },
  { slug: 'punteo-eolico-sexta-cuerda-al-aire', mode: 'aeolian', prefix: 'pickingEolico', modeLabelKey: 'pickingModeEolicoLabel' },
  { slug: 'punteo-locrio-sexta-cuerda-al-aire', mode: 'locrian', prefix: 'pickingLocrio', modeLabelKey: 'pickingModeLocrioLabel' },
];
// Home-nav / 404 / og default link points at the original Dorian lesson.
const PICKING_SLUG = PICKING_PAGES[0].slug;

// Builds the "see also" nav line linking a picking-lesson page to its two
// sibling modes.
function pickingOtherModesNav(strings, locale, page) {
  const label = strings.pickingSeeOtherModesLabel || '';
  const links = PICKING_PAGES.filter(function (pg) { return pg.slug !== page.slug; })
    .map(function (pg) {
      return '<a href="' + v7PageHref(locale, pg.slug) + '">' + (strings[pg.modeLabelKey] || pg.mode) + '</a>';
    })
    .join(' · ');
  return '<p class="v7-nav">' + label + ' ' + links + '</p>';
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
    'v7NavLabel', 'circleNavLabel', 'pickingGroupLabel', 'pickingNavLabel',
    'pickingJonicoNavLabel', 'pickingFrigioNavLabel',
    'pickingLidioNavLabel', 'pickingMixolidioNavLabel', 'pickingEolicoNavLabel',
    'pickingLocrioNavLabel',
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
  html = html.split('%%CIRCLE_PAGE_HREF%%').join(v7PageHref(locale, CIRCLE_SLUG));
  html = html.split('%%PICKING_PAGE_HREF%%').join(v7PageHref(locale, PICKING_PAGES[0].slug));
  html = html.split('%%PICKING_JONICO_PAGE_HREF%%').join(v7PageHref(locale, PICKING_PAGES[1].slug));
  html = html.split('%%PICKING_FRIGIO_PAGE_HREF%%').join(v7PageHref(locale, PICKING_PAGES[2].slug));
  html = html.split('%%PICKING_LIDIO_PAGE_HREF%%').join(v7PageHref(locale, PICKING_PAGES[3].slug));
  html = html.split('%%PICKING_MIXOLIDIO_PAGE_HREF%%').join(v7PageHref(locale, PICKING_PAGES[4].slug));
  html = html.split('%%PICKING_EOLICO_PAGE_HREF%%').join(v7PageHref(locale, PICKING_PAGES[5].slug));
  html = html.split('%%PICKING_LOCRIO_PAGE_HREF%%').join(v7PageHref(locale, PICKING_PAGES[6].slug));

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

// Render a "chords and their notes" page (src/site/circle-fifths.html, shared
// by all entries in CIRCLE_PAGES) for one locale. Same head/footer chrome as
// the V7 pages; a single-column grid of chords with per-voicing 1ª/3ª/5ª counts
// (computed client-side by the page's data script).
function renderCirclePage(template, strings, locale, page) {
  const resolvedAssetsPrefix = locale === 'es' ? 'assets/' : '../assets/';
  const ogImage = SITE_BASE_URL + '/assets/og-image.png';
  let html = template;

  const simpleKeys = [
    'htmlLang', 'wordmark', 'wordmarkSmall', 'altLangLabel',
    'circleColChord', 'circleColNotes',
    'extensionHeading', 'extensionDescription',
  ];
  simpleKeys.forEach(function (key) {
    html = html.split('%%' + key + '%%').join(strings[key] || '');
  });

  const labels = {
    root: strings.circleLabelRoot || '1ª',
    third: strings.circleLabelThird || '3ª',
    fifth: strings.circleLabelFifth || '5ª',
    times: strings.circleTimesLabel || 'veces',
    prevLabel: strings.cfPosPrevLabel || 'Posición anterior',
    nextLabel: strings.cfPosNextLabel || 'Posición siguiente',
    posOpen: strings.cfPosOpen || 'Posición abierta',
    posBarre6: strings.cfPosBarre6 || 'Cejilla en la 6ª cuerda',
    posBarre5: strings.cfPosBarre5 || 'Cejilla en la 5ª cuerda',
  };

  html = html.split('%%PAGE_TITLE%%').join(strings[page.titleKey] || '');
  html = html.split('%%PAGE_META_DESCRIPTION%%').join(strings[page.metaKey] || '');
  html = html.split('%%PAGE_H1%%').join(strings[page.h1Key] || '');
  html = html.split('%%PAGE_LEAD%%').join(strings[page.leadKey] || '');
  html = html.split('%%CIRCLE_LABELS_JSON%%').join(JSON.stringify(labels));
  html = html.split('%%CIRCLE_SCRIPT%%').join(resolvedAssetsPrefix + page.scriptFile);
  html = html.split('%%OTHER_CIRCLE_HREF%%').join(v7PageHref(locale, page.otherSlug));
  html = html.split('%%OTHER_CIRCLE_LABEL%%').join(strings[page.otherLabelKey] || '');

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

// Render a modal picking lesson page (src/site/picking-lesson.html) for one
// locale — one of PICKING_PAGES (Dorian, Ionian, Phrygian). Static content
// (three fretboard-diagram images + tips, computed client-side from the
// mode by src/site/picking-render.js), no client-side data script.
function renderPickingPage(template, strings, locale, page) {
  const resolvedAssetsPrefix = locale === 'es' ? 'assets/' : '../assets/';
  const ogImage = SITE_BASE_URL + '/assets/og-image.png';
  const p = page.prefix;
  let html = template;

  const simpleKeys = [
    'htmlLang', 'wordmark', 'wordmarkSmall', 'altLangLabel',
    'extensionHeading', 'extensionDescription',
    'metronomeTitle',
    'metronomeBeatsAria', 'metronomeSlowerLabel', 'metronomeFasterLabel',
    'metronomeTempoSliderLabel', 'metronomeStartLabel', 'metronomeStopLabel',
    'metronomeMeasureLabel', 'metronomeSubdivisionLabel', 'metronomePitchLabel',
    'metronomeMuteLabel', 'metronomeUnmuteLabel', 'metronomeVolumeLabel',
    'metronomeVolumeOnIcon', 'metronomeVolumeOffIcon', 'metronomeShortcut',
    'metronomeTempoLargo', 'metronomeTempoAdagio', 'metronomeTempoAndante',
    'metronomeTempoModerato', 'metronomeTempoAllegro',
    'metronomeTempoVivace', 'metronomeTempoPresto',
    'metronomeSubdivisionQuarter', 'metronomeSubdivisionEighth',
    'metronomeSubdivisionTriplet', 'metronomeSubdivisionSixteenth',
  ];
  simpleKeys.forEach(function (key) {
    html = html.split('%%' + key + '%%').join(strings[key] || '');
  });

  html = html.split('%%PAGE_TITLE%%').join(strings[p + 'PageTitle'] || '');
  html = html.split('%%PAGE_META_DESCRIPTION%%').join(strings[p + 'MetaDescription'] || '');
  html = html.split('%%PAGE_H1%%').join(strings[p + 'H1'] || '');
  html = html.split('%%PAGE_LEAD%%').join(strings[p + 'Lead'] || '');
  html = html.split('%%pickingIntro1%%').join(strings[p + 'Intro1'] || '');
  html = html.split('%%pickingIntro2%%').join(strings[p + 'Intro2'] || '');
  html = html.split('%%pickingFig1Alt%%').join(strings[p + 'Fig1Alt'] || '');
  html = html.split('%%pickingFig1Caption%%').join(strings[p + 'Fig1Caption'] || '');
  html = html.split('%%pickingFig2Alt%%').join(strings[p + 'Fig2Alt'] || '');
  html = html.split('%%pickingFig2Caption%%').join(strings[p + 'Fig2Caption'] || '');
  html = html.split('%%pickingFig3Alt%%').join(strings[p + 'Fig3Alt'] || '');
  html = html.split('%%pickingFig3Caption%%').join(strings[p + 'Fig3Caption'] || '');
  html = html.split('%%pickingTipsH2%%').join(strings[p + 'TipsH2'] || '');
  html = html.split('%%pickingTip1%%').join(strings[p + 'Tip1'] || '');
  html = html.split('%%pickingTip2%%').join(strings[p + 'Tip2'] || '');
  html = html.split('%%pickingTip3%%').join(strings[p + 'Tip3'] || '');

  html = html.split('%%PICKING_MODE%%').join(page.mode);
  html = html.split('%%PICKING_OTHER_MODES_NAV%%').join(pickingOtherModesNav(strings, locale, page));

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

// Render the site-wide 404 page (src/site/404.html) for GitHub Pages. A
// single Spanish page at the root — GitHub Pages only serves one 404.html
// at the domain root, so there's no per-locale variant.
function render404Page(template, strings) {
  const resolvedAssetsPrefix = 'assets/';
  const ogImage = SITE_BASE_URL + '/assets/og-image.png';
  let html = template;

  const simpleKeys = [
    'wordmark', 'wordmarkSmall',
    'extensionHeading', 'extensionDescription',
    'notFoundHomeLink', 'notFoundPickingLink', 'notFoundV7Link',
  ];
  simpleKeys.forEach(function (key) {
    html = html.split('%%' + key + '%%').join(strings[key] || '');
  });

  html = html.split('%%PAGE_TITLE%%').join(strings.notFoundPageTitle || '');
  html = html.split('%%PAGE_META_DESCRIPTION%%').join(strings.notFoundMetaDescription || '');
  html = html.split('%%PAGE_H1%%').join(strings.notFoundH1 || '');
  html = html.split('%%PAGE_LEAD%%').join(strings.notFoundLead || '');

  html = html.split('%%ASSETS_PREFIX%%').join(resolvedAssetsPrefix);
  html = html.split('%%homeHref%%').join(homeHref('es'));
  html = html.split('%%V7_PAGE_HREF%%').join(v7PageHref('es'));
  html = html.split('%%PICKING_PAGE_HREF%%').join(v7PageHref('es', PICKING_SLUG));
  html = html.split('%%ogImage%%').join(ogImage);
  html = html.split('%%EXTENSION_CTA_BUTTON%%').join(ctaButton(strings));
  html = html.split('%%MANIFEST_HREF%%').join(resolvedAssetsPrefix + 'manifest.es.webmanifest');
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
['chords-db.js', 'chord-diagram.js', 'chord-positions.js', 'chord-search.js', 'note-names.js'].forEach(function (f) {
  copyFile(path.join(SRC_SHARED, f), path.join(ASSETS_DIST, f));
});
// Site-specific JS and CSS.
copyFile(path.join(SRC_SITE, 'chord-finder.js'), path.join(ASSETS_DIST, 'chord-finder.js'));
copyFile(path.join(SRC_SITE, 'v7-guide.js'), path.join(ASSETS_DIST, 'v7-guide.js'));
copyFile(path.join(SRC_SITE, 'v7-minor.js'), path.join(ASSETS_DIST, 'v7-minor.js'));
copyFile(path.join(SRC_SHARED, 'v7-page-render.js'), path.join(ASSETS_DIST, 'v7-page-render.js'));
copyFile(path.join(SRC_SHARED, 'v7-chord-overrides.js'), path.join(ASSETS_DIST, 'v7-chord-overrides.js'));
copyFile(path.join(SRC_SITE, 'circle-fifths.js'), path.join(ASSETS_DIST, 'circle-fifths.js'));
copyFile(path.join(SRC_SITE, 'circle-fifths-minor.js'), path.join(ASSETS_DIST, 'circle-fifths-minor.js'));
copyFile(path.join(SRC_SHARED, 'circle-render.js'), path.join(ASSETS_DIST, 'circle-render.js'));
copyFile(path.join(SRC_SITE, 'site.css'), path.join(ASSETS_DIST, 'site.css'));
copyFile(path.join(SRC_SITE, 'picking-render.js'), path.join(ASSETS_DIST, 'picking-render.js'));
copyFile(path.join(SRC_SITE, 'metronome.js'), path.join(ASSETS_DIST, 'metronome.js'));
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
  '/assets/chord-positions.js',
  '/assets/chord-search.js',
  '/assets/note-names.js',
  '/assets/chord-finder.js',
  '/assets/circle-render.js',
  '/assets/circle-fifths.js',
  '/assets/circle-fifths-minor.js',
  '/assets/vendor/svguitar.umd.js',
  '/assets/vendor/fuzzysort.js',
  '/assets/vendor/jspdf.umd.min.js',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/picking-render.js',
  '/assets/metronome.js',
  '/404.html',
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

    CIRCLE_PAGES.forEach(function (page) {
      const circleHtml = renderCirclePage(circleTemplate, strings, locale, page);
      const circleOutFile = path.join(DIST_SITE, page.slug + '.html');
      fs.writeFileSync(circleOutFile, circleHtml, 'utf8');
      say(path.relative(ROOT, circleOutFile));
    });

    PICKING_PAGES.forEach(function (page) {
      const pickingHtml = renderPickingPage(pickingTemplate, strings, locale, page);
      const pickingOutFile = path.join(DIST_SITE, page.slug + '.html');
      fs.writeFileSync(pickingOutFile, pickingHtml, 'utf8');
      say(path.relative(ROOT, pickingOutFile));
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

  CIRCLE_PAGES.forEach(function (page) {
    const circleHtml = renderCirclePage(circleTemplate, strings, locale, page);
    const circleOutFile = path.join(localeDir, page.slug + '.html');
    fs.writeFileSync(circleOutFile, circleHtml, 'utf8');
    say(path.relative(ROOT, circleOutFile));
  });

  PICKING_PAGES.forEach(function (page) {
    const pickingHtml = renderPickingPage(pickingTemplate, strings, locale, page);
    const pickingOutFile = path.join(localeDir, page.slug + '.html');
    fs.writeFileSync(pickingOutFile, pickingHtml, 'utf8');
    say(path.relative(ROOT, pickingOutFile));
  });
});

console.log('==> Rendering 404 page...');
{
  const esStringsPath = path.join(SRC_I18N, 'strings.es.json');
  const esStrings = JSON.parse(fs.readFileSync(esStringsPath, 'utf8'));
  const notFoundHtml = render404Page(notFoundTemplate, esStrings);
  const notFoundOutFile = path.join(DIST_SITE, '404.html');
  fs.writeFileSync(notFoundOutFile, notFoundHtml, 'utf8');
  say(path.relative(ROOT, notFoundOutFile));
}

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
  ...CIRCLE_PAGES.flatMap(function (page) {
    return [
      '  <url>',
      '    <loc>' + SITE_BASE_URL + '/' + page.slug + '</loc>',
      '    <lastmod>' + today + '</lastmod>',
      '    <changefreq>monthly</changefreq>',
      '    <priority>0.5</priority>',
      '    <xhtml:link rel="alternate" hreflang="es" href="' + SITE_BASE_URL + '/' + page.slug + '"/>',
      '    <xhtml:link rel="alternate" hreflang="en" href="' + SITE_BASE_URL + '/en/' + page.slug + '"/>',
      '  </url>',
      '  <url>',
      '    <loc>' + SITE_BASE_URL + '/en/' + page.slug + '</loc>',
      '    <lastmod>' + today + '</lastmod>',
      '    <changefreq>monthly</changefreq>',
      '    <priority>0.4</priority>',
      '    <xhtml:link rel="alternate" hreflang="es" href="' + SITE_BASE_URL + '/' + page.slug + '"/>',
      '    <xhtml:link rel="alternate" hreflang="en" href="' + SITE_BASE_URL + '/en/' + page.slug + '"/>',
      '  </url>',
    ];
  }),
  ...PICKING_PAGES.flatMap(function (page) {
    return [
      '  <url>',
      '    <loc>' + SITE_BASE_URL + '/' + page.slug + '</loc>',
      '    <lastmod>' + today + '</lastmod>',
      '    <changefreq>monthly</changefreq>',
      '    <priority>0.5</priority>',
      '    <xhtml:link rel="alternate" hreflang="es" href="' + SITE_BASE_URL + '/' + page.slug + '"/>',
      '    <xhtml:link rel="alternate" hreflang="en" href="' + SITE_BASE_URL + '/en/' + page.slug + '"/>',
      '  </url>',
      '  <url>',
      '    <loc>' + SITE_BASE_URL + '/en/' + page.slug + '</loc>',
      '    <lastmod>' + today + '</lastmod>',
      '    <changefreq>monthly</changefreq>',
      '    <priority>0.4</priority>',
      '    <xhtml:link rel="alternate" hreflang="es" href="' + SITE_BASE_URL + '/' + page.slug + '"/>',
      '    <xhtml:link rel="alternate" hreflang="en" href="' + SITE_BASE_URL + '/en/' + page.slug + '"/>',
      '  </url>',
    ];
  }),
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
