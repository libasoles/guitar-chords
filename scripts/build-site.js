#!/usr/bin/env node
"use strict";
/* build-site.js — Generates dist/site from src/site + src/shared + src/i18n.
   Produces two locales:
     dist/site/index.html       (ES, at /)
     dist/site/en.html          (EN, at /en)
     dist/site/en/index.html    (EN, at /en/)
   Assets are shared via dist/site/assets/.

   Env vars:
     SITE_BASE_URL         Base URL without trailing slash (default: https://acordesdeguitarra.com.ar)
     EXTENSION_STORE_URL   Chrome Web Store URL — enables the "Add to Chrome" button
     PARTITURA_API_URL     Base URL of the Partitura y tablatura API. The tool page
                           (and its home banner/links) is only generated when set.
     SITE_OUT_DIR          Output directory (default: dist/site)
     TURNSTILE_SITE_KEY    Cloudflare Turnstile public site key for that page
*/

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { drawIcon } = require("./lib/icon-png");
const { fingerprintAssets } = require("./lib/fingerprint");
const {
  resolveLastmods,
  loadManifest,
  saveManifest,
} = require("./lib/lastmod");
const {
  homeJsonLd,
  guideJsonLd,
  toolJsonLd,
  injectJsonLd,
} = require("./lib/structured-data");
const { parseAsciiTab } = require("./lib/ascii-tab");

const ROOT = path.join(__dirname, "..");
const SRC_SITE = path.join(ROOT, "src", "site");
const SRC_SHARED = path.join(ROOT, "src", "shared");
const SRC_I18N = path.join(ROOT, "src", "i18n");
const SRC_EXT = path.join(ROOT, "src", "extension");
const SRC_VENDOR = path.join(ROOT, "vendor");
const SRC_STORE = path.join(ROOT, "store");
// SITE_OUT_DIR lets tests build variants (with/without the API URL) side by side.
const DIST_SITE = process.env.SITE_OUT_DIR
  ? path.resolve(process.env.SITE_OUT_DIR)
  : path.join(ROOT, "dist", "site");

// Base URL for canonical/OG tags (no trailing slash).
const SITE_BASE_URL = (
  process.env.SITE_BASE_URL || "https://acordesdeguitarra.com.ar"
).replace(/\/$/, "");
const SITE_HOSTNAME = new URL(SITE_BASE_URL).hostname;

// Partitura y tablatura is generated only when its API URL is configured, so
// merging to main does not publish the page before the backend is deployed.
const PARTITURA_API_URL = (process.env.PARTITURA_API_URL || "").replace(
  /\/+$/,
  "",
);
const TURNSTILE_SITE_KEY =
  process.env.TURNSTILE_SITE_KEY || "0x4AAAAAAFX8ivpyYAAvr-8D";
const PARTITURA_ENABLED = Boolean(PARTITURA_API_URL && TURNSTILE_SITE_KEY);

// ---- helpers ---------------------------------------------------------------

function say(msg) {
  process.stdout.write("  " + msg + "\n");
}
function fail(msg) {
  process.stderr.write("ERROR: " + msg + "\n");
  process.exit(1);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dst) {
  fs.copyFileSync(src, dst);
  say(path.relative(ROOT, src) + " → " + path.relative(ROOT, dst));
}

// ---- validation ------------------------------------------------------------

const SVGUITAR = path.join(SRC_VENDOR, "svguitar.umd.js");
if (!fs.existsSync(SVGUITAR)) {
  fail("vendor/svguitar.umd.js not found. Run: npm run vendor");
}
const FUZZYSORT = path.join(SRC_VENDOR, "fuzzysort.js");
if (!fs.existsSync(FUZZYSORT)) {
  fail("vendor/fuzzysort.js not found. Run: npm run vendor");
}
const JSPDF = path.join(SRC_VENDOR, "jspdf.umd.min.js");
if (!fs.existsSync(JSPDF)) {
  fail("vendor/jspdf.umd.min.js not found. Run: npm run vendor");
}
// Only the dev server opts into the ignored local override. Production builds
// always use the committed release, even when a local symlink is present.
const LOCAL_ASCII_TABS = path.join(SRC_VENDOR, "ascii-tabs.local.js");
const ASCII_TABS =
  process.argv.includes("--local-ascii-tabs") && fs.existsSync(LOCAL_ASCII_TABS)
    ? LOCAL_ASCII_TABS
    : path.join(SRC_VENDOR, "ascii-tabs.js");
if (!fs.existsSync(ASCII_TABS)) {
  fail("vendor/ascii-tabs.js not found. Run: npm run vendor");
}

// ---- template rendering ----------------------------------------------------

const template = fs.readFileSync(path.join(SRC_SITE, "template.html"), "utf8");
const v7Template = fs.readFileSync(
  path.join(SRC_SITE, "v7-guide.html"),
  "utf8",
);
const circleTemplate = fs.readFileSync(
  path.join(SRC_SITE, "circle-fifths.html"),
  "utf8",
);
const fifthsTemplate = fs.readFileSync(
  path.join(SRC_SITE, "fifths-wheel.html"),
  "utf8",
);
const dimTemplate = fs.readFileSync(
  path.join(SRC_SITE, "dim-guide.html"),
  "utf8",
);
const noteFinderTemplate = fs.readFileSync(
  path.join(SRC_SITE, "note-finder.html"),
  "utf8",
);
const intervalsTemplate = fs.readFileSync(
  path.join(SRC_SITE, "picking-intervals.html"),
  "utf8",
);
const tabEditorTemplate = fs.readFileSync(
  path.join(SRC_SITE, "tab-editor.html"),
  "utf8",
);
const sixthsTemplate = fs.readFileSync(
  path.join(SRC_SITE, "sixths-exercise.html"),
  "utf8",
);
const notFoundTemplate = fs.readFileSync(
  path.join(SRC_SITE, "404.html"),
  "utf8",
);
const noteFinderPromoTemplate = fs.readFileSync(
  path.join(SRC_SITE, "note-finder-promo.html"),
  "utf8",
);
const tabEditorPromoTemplate = fs.readFileSync(
  path.join(SRC_SITE, "tab-editor-promo.html"),
  "utf8",
);
const privacyTemplate = fs.readFileSync(
  path.join(SRC_SITE, "privacy.html"),
  "utf8",
);
const partituraTemplate = fs.readFileSync(
  path.join(SRC_SITE, "partitura.html"),
  "utf8",
);
const partituraPromoTemplate = fs.readFileSync(
  path.join(SRC_SITE, "partitura-promo.html"),
  "utf8",
);
const LOCALES = ["es", "en"];

// Build the chord-finder i18n subset (only the cfXxx keys).
function finderI18N(strings) {
  const keys = [
    "cfFilters",
    "cfFilterCategoryType",
    "cfFilterCategoryKey",
    "cfClearFilters",
    "cfRootLabels",
    "cfEmpty",
    "cfPinLabel",
    "cfPinnedLabel",
    "cfPinnedTitle",
    "cfClearPinned",
    "cfExportPdf",
    "cfExportLoading",
    "cfExportError",
    "cfToolbarAriaLabel",
    "cfUnpinAriaLabel",
    "cfAdvancedFiltersLabel",
    "cfNotationGroupLabel",
    "cfNotationAmerican",
    "cfNotationSpanish",
    "cfLoadMore",
    "cfPosPrevLabel",
    "cfPosNextLabel",
    "cfPosOpen",
    "cfPosBarre6",
    "cfPosBarre5",
  ];
  const out = {};
  keys.forEach(function (k) {
    if (strings[k] !== undefined) out[k] = strings[k];
  });
  out.cfWordmark = strings.wordmark;
  out.cfWordmarkSmall = strings.wordmarkSmall;
  return out;
}

// Build the decoder table rows from the row* keys.
const ROW_KEYS = [
  "rowRoot",
  "rowMajor",
  "rowMinor",
  "rowDom7",
  "rowMinor7",
  "rowMaj7",
  "rowDim",
  "rowHalfDim",
  "rowAug",
  "rowSus",
  "rowAdd",
  "rowExt",
  "rowSlash",
];
function decoderRows(strings) {
  return ROW_KEYS.map(function (key) {
    const row = strings[key] || ["", "", "", ""];
    return (
      "<tr><td>" +
      row[0] +
      "</td><td>" +
      row[1] +
      "</td><td>" +
      row[2] +
      "</td><td>" +
      row[3] +
      "</td></tr>"
    );
  }).join("\n    ");
}

// Build the extension CTA button.
function ctaButton(strings) {
  const storeUrl =
    process.env.EXTENSION_STORE_URL ||
    "https://chromewebstore.google.com/detail/guitar-chords/chigeaalpomifocjjhgcpblcepigajme";
  return (
    '<a class="ext-btn" href="' +
    storeUrl +
    '" target="_blank" rel="noopener">' +
    strings.extensionAddButton +
    "</a>"
  );
}

// Replace all %%KEY%% placeholders in the template.
function altLangHref(locale, outputMode) {
  if (locale === "es") return "en";
  return outputMode === "clean" ? "./" : "../";
}

function canonicalUrl(locale) {
  return locale === "es" ? SITE_BASE_URL + "/" : SITE_BASE_URL + "/en";
}

function v7PageHref(locale, slug) {
  const s = slug || "v7";
  return locale === "es" ? "/" + s : "/en/" + s;
}

function v7CanonicalUrl(locale, slug) {
  return SITE_BASE_URL + v7PageHref(locale, slug);
}

function homeHref(locale) {
  return locale === "es" ? "/" : "/en";
}

// Pages rendered from the shared src/site/v7-guide.html template — one for
// major chords, one for minor chords. Same layout, different i18n keys,
// data script, and cross-link to the other page.
const V7_PAGES = [
  {
    slug: "v7",
    scriptFile: "v7-guide.js",
    titleKey: "v7PageTitle",
    metaKey: "v7MetaDescription",
    h1Key: "v7H1",
    leadKey: "v7Lead",
    otherSlug: "v7-menor",
    otherLabelKey: "v7SeeMinorLink",
  },
  {
    slug: "v7-menor",
    scriptFile: "v7-minor.js",
    titleKey: "v7mPageTitle",
    metaKey: "v7mMetaDescription",
    h1Key: "v7mH1",
    leadKey: "v7mLead",
    otherSlug: "v7",
    otherLabelKey: "v7SeeMajorLink",
  },
];

// "Chords and their notes" pages rendered from src/site/circle-fifths.html —
// plus the interactive circle, which uses its own template and script.
const CIRCLE_PAGES = [
  {
    slug: "circulo-de-quintas",
    scriptFile: "fifths-wheel.js",
    titleKey: "fifthsTitle",
    metaKey: "fifthsDescription",
    h1Key: "fifthsH1",
    otherSlug: "acordes-mayores-y-sus-notas",
    otherLabelKey: "circleNavLabel",
  },
  {
    slug: "acordes-mayores-y-sus-notas",
    scriptFile: "circle-fifths.js",
    titleKey: "circlePageTitle",
    metaKey: "circleMetaDescription",
    h1Key: "circleH1",
    leadKey: "circleLead",
    otherSlug: "acordes-menores-y-sus-notas",
    otherLabelKey: "circleSeeMinorLink",
  },
  {
    slug: "acordes-menores-y-sus-notas",
    scriptFile: "circle-fifths-minor.js",
    titleKey: "circleMinorPageTitle",
    metaKey: "circleMinorMetaDescription",
    h1Key: "circleMinorH1",
    leadKey: "circleMinorLead",
    otherSlug: "acordes-mayores-y-sus-notas",
    otherLabelKey: "circleSeeMajorLink",
  },
];
// Home-nav link points at the major "chords and their notes" page.
const CIRCLE_SLUG = "acordes-mayores-y-sus-notas";

// Diminished-chords page, rendered from src/site/dim-guide.html. Single
// page (no locale-agnostic pairing like V7/circle) with three movable dim7
// shapes grouped by root string (6th, 5th, 4th).
const DIM_SLUG = "acordes-disminuidos";

// "Identify chords from notes" page, rendered from src/site/note-finder.html.
// Single page (no locale-agnostic pairing like V7/circle): a piano-style note
// picker filters chords-db.js client-side to the chords with a position that
// sounds every selected note (see src/shared/note-match.js).
const NOTE_FINDER_SLUG = "identificar-acordes-por-notas";

// "Tablatura ASCII" page, rendered from src/site/tab-editor.html: an editor
// to write guitar tabs and copy them as plain text (vendor/ascii-tabs.js).
const TAB_EDITOR_SLUG = "crear-tablaturas-de-guitarra";

// "Ejercicio de sextas" exercise page, rendered from src/site/sixths-exercise.html:
// a read-only <ascii-tabs> preloaded with the exercise, the exercise video,
// the tab-editor promo and the extension CTA.
// Split in three parts (up, high position, down) so each one fits on a single
// staff instead of wrapping.
const SIXTHS_SLUG = "ejercicio-de-sextas";

// Partitura y tablatura tool (src/site/partitura.html, src/site/partitura.js)
// and the site-wide privacy policy (src/site/privacy.html).
const PARTITURA_SLUG = "partitura-y-tablatura";
const PRIVACY_SLUG = "politica-de-privacidad";
// YouTube video the exercise was taken from, embedded below the tabs.
const SIXTHS_VIDEO_ID = "NNwTR8Q8JN4";
const SIXTHS_TABS = [
  `
e|---------------------------------------0
B|---------------------------0---1---3----
G|-------------------0---2---------------0
D|-------0---2---3-----------0---2---3----
A|---3---------------2---3----------------
E|---0---1---3---5------------------------
`,
  `
e|---1---3---5---7---8--10--12--10---8---7---5---3---1
B|----------------------------------------------------
G|---2---4---5---7---9--10--12--10---9---7---5---4---2
D|----------------------------------------------------
A|----------------------------------------------------
E|----------------------------------------------------
`,
  `
e|---0------------------------------------
B|-------3---1---0------------------------
G|---0---------------2---0----------------
D|-------3---2---0-----------3---2---0----
A|-------------------3---2---------------3
E|---------------------------5---3---1---0
`,
];

// Static lesson page rendered from src/site/picking-intervals.html — a major
// or minor key in thirds, sixths and tenths. i18n keys are namespaced by
// `prefix` (intervalsH1, intervalsPageTitle, ...).
const INTERVALS_PAGE = {
  slug: "punteo-terceras-sextas-decimas",
  mode: "ionian",
  prefix: "intervals",
};
const ALL_PICKING_PAGES = [INTERVALS_PAGE];

// JSON-LD options shared by the home and guide renderers; mirrors the values
// already used for canonical/hreflang/meta so structured data matches the page.
function structuredDataOpts(locale, url, name, description, homeUrl) {
  return {
    baseUrl: SITE_BASE_URL,
    siteName: "Guitar Chords",
    ogImage: SITE_BASE_URL + "/assets/og-image.png",
    locale: locale,
    url: url,
    homeUrl: homeUrl || SITE_BASE_URL + homeHref(locale),
    name: name,
    description: description,
  };
}

function withGuideJsonLd(html, strings, locale, slug, titleKey, metaKey) {
  return injectJsonLd(
    html,
    guideJsonLd(
      structuredDataOpts(
        locale,
        v7CanonicalUrl(locale, slug),
        strings[titleKey] || "",
        strings[metaKey] || "",
      ),
    ),
  );
}

// Render the note-finder promo banner (src/site/note-finder-promo.html),
// shared by the home page and the 404 page.
function noteFinderPromo(strings, locale) {
  const keys = [
    "noteFinderPromoKicker",
    "noteFinderPromoTitle",
    "noteFinderPromoDescription",
    "noteFinderPromoCta",
    "promoNoteTop",
    "promoNoteUpperLeft",
    "promoNoteUpperRight",
    "promoNoteCenter",
    "promoNoteLowerLeft",
    "promoNoteLowerRight",
    "promoNoteBottom",
  ];
  let html = noteFinderPromoTemplate.trim();
  keys.forEach(function (key) {
    html = html.split("%%" + key + "%%").join(strings[key] || "");
  });
  return html
    .split("%%NOTE_FINDER_PAGE_HREF%%")
    .join(v7PageHref(locale, NOTE_FINDER_SLUG));
}

// Render the tab-editor promo banner (src/site/tab-editor-promo.html) shown
// on the home page below the note-finder promo and on the sixths exercise page.
function tabEditorPromo(strings, locale) {
  let html = tabEditorPromoTemplate.trim();
  ["tabPromoKicker", "tabPromoTitle", "tabPromoCta"].forEach(function (key) {
    html = html.split("%%" + key + "%%").join(strings[key] || "");
  });
  return html
    .split("%%TAB_EDITOR_PAGE_HREF%%")
    .join(v7PageHref(locale, TAB_EDITOR_SLUG));
}

// Home banner for Partitura y tablatura; empty when the page is not generated.
function partituraPromo(strings, locale, assetsPrefix) {
  if (!PARTITURA_ENABLED) return "";
  let html = partituraPromoTemplate.trim();
  [
    "partPromoKicker",
    "partPromoTitle",
    "partPromoDescription",
    "partPromoCta",
    "partPromoAlt",
  ].forEach(function (key) {
    html = html.split("%%" + key + "%%").join(strings[key] || "");
  });
  return html
    .split("%%PARTITURA_PAGE_HREF%%")
    .join(v7PageHref(locale, PARTITURA_SLUG))
    .split("%%ASSETS_PREFIX%%")
    .join(assetsPrefix);
}

function partituraNav(strings, locale) {
  if (!PARTITURA_ENABLED) return "";
  return (
    '<p class="v7-nav"><a href="' +
    v7PageHref(locale, PARTITURA_SLUG) +
    '">' +
    strings.partNavLabel +
    "</a></p>"
  );
}

function render(template, strings, locale, assetsPrefix, outputMode) {
  const resolvedAssetsPrefix =
    assetsPrefix || (locale === "es" ? "assets/" : "../assets/");
  const ogImage = SITE_BASE_URL + "/assets/og-image.png";
  let html = template;

  // Simple key substitutions.
  const simpleKeys = [
    "htmlLang",
    "pageTitle",
    "metaDescription",
    "wordmark",
    "wordmarkSmall",
    "altLangLabel",
    "h1",
    "lead",
    "h2Decoder",
    "decoderIntro",
    "thPart",
    "thSymbols",
    "thMeaning",
    "thExample",
    "extensionHeading",
    "extensionDescription",
    "v7NavLabel",
    "circleNavLabel",
    "fifthsH1",
    "dimNavLabel",
    "tabNavLabel",
    "sixthsH1",
  ];
  simpleKeys.forEach(function (key) {
    html = html.split("%%" + key + "%%").join(strings[key] || "");
  });
  html = html.split("%%INTERVALS_PAGE_HREF%%").join(v7PageHref(locale, INTERVALS_PAGE.slug));
  html = html.split("%%intervalsNavLabel%%").join(strings.intervalsNavLabel || "");

  // Computed substitutions.
  html = html
    .split("%%NOTE_FINDER_PROMO%%")
    .join(noteFinderPromo(strings, locale));
  html = html
    .split("%%TAB_EDITOR_PROMO%%")
    .join(tabEditorPromo(strings, locale));
  html = html
    .split("%%PARTITURA_PROMO%%")
    .join(partituraPromo(strings, locale, resolvedAssetsPrefix));
  html = html.split("%%PARTITURA_NAV%%").join(partituraNav(strings, locale));
  html = html.split("%%ASSETS_PREFIX%%").join(resolvedAssetsPrefix);
  html = html.split("%%altLangHref%%").join(altLangHref(locale, outputMode));
  html = html.split("%%canonicalUrl%%").join(canonicalUrl(locale));
  html = html.split("%%hreflangEs%%").join(SITE_BASE_URL + "/");
  html = html.split("%%hreflangEn%%").join(SITE_BASE_URL + "/en");
  html = html.split("%%ogImage%%").join(ogImage);
  html = html.split("%%DECODER_ROWS%%").join(decoderRows(strings));
  html = html.split("%%EXTENSION_CTA_BUTTON%%").join(ctaButton(strings));
  html = html
    .split("%%CHORD_FINDER_I18N%%")
    .join(JSON.stringify(finderI18N(strings)));
  html = html
    .split("%%MANIFEST_HREF%%")
    .join(resolvedAssetsPrefix + "manifest." + locale + ".webmanifest");
  html = html.split("%%SW_PATH%%").join("/sw.js");
  html = html.split("%%V7_PAGE_HREF%%").join(v7PageHref(locale));
  html = html
    .split("%%FIFTHS_PAGE_HREF%%")
    .join(v7PageHref(locale, "circulo-de-quintas"))
    .split("%%CIRCLE_PAGE_HREF%%")
    .join(v7PageHref(locale, CIRCLE_SLUG));
  html = html.split("%%DIM_PAGE_HREF%%").join(v7PageHref(locale, DIM_SLUG));
  html = html
    .split("%%SIXTHS_PAGE_HREF%%")
    .join(v7PageHref(locale, SIXTHS_SLUG));
  html = html
    .split("%%TAB_EDITOR_PAGE_HREF%%")
    .join(v7PageHref(locale, TAB_EDITOR_SLUG));

  return injectJsonLd(
    html,
    homeJsonLd(
      structuredDataOpts(
        locale,
        canonicalUrl(locale),
        strings.pageTitle || "",
        strings.metaDescription || "",
      ),
    ),
  );
}

// Render a "chords and their V7" page (src/site/v7-guide.html, shared by all
// entries in V7_PAGES) for one locale.
function renderV7Page(template, strings, locale, page) {
  const resolvedAssetsPrefix = locale === "es" ? "assets/" : "../assets/";
  const ogImage = SITE_BASE_URL + "/assets/og-image.png";
  let html = template;

  const simpleKeys = [
    "htmlLang",
    "wordmark",
    "wordmarkSmall",
    "altLangLabel",
    "v7ColTonic",
    "v7ColDominant",
    "extensionHeading",
    "extensionDescription",
  ];
  simpleKeys.forEach(function (key) {
    html = html.split("%%" + key + "%%").join(strings[key] || "");
  });

  const labels = {
    prevLabel: strings.cfPosPrevLabel || "Previous position",
    nextLabel: strings.cfPosNextLabel || "Next position",
    positionLabels: {
      open: strings.cfPosOpen || "Open position",
      barre6: strings.cfPosBarre6 || "Barre on the 6th string",
      barre5: strings.cfPosBarre5 || "Barre on the 5th string",
    },
  };

  html = html.split("%%PAGE_TITLE%%").join(strings[page.titleKey] || "");
  html = html
    .split("%%PAGE_META_DESCRIPTION%%")
    .join(strings[page.metaKey] || "");
  html = html.split("%%PAGE_H1%%").join(strings[page.h1Key] || "");
  html = html.split("%%PAGE_LEAD%%").join(strings[page.leadKey] || "");
  html = html
    .split("%%OTHER_PAGE_HREF%%")
    .join(v7PageHref(locale, page.otherSlug));
  html = html
    .split("%%OTHER_PAGE_LABEL%%")
    .join(strings[page.otherLabelKey] || "");
  html = html
    .split("%%PAGE_SCRIPT%%")
    .join(resolvedAssetsPrefix + page.scriptFile);
  html = html.split("%%V7_GUIDE_LABELS_JSON%%").join(JSON.stringify(labels));

  html = html.split("%%ASSETS_PREFIX%%").join(resolvedAssetsPrefix);
  html = html.split("%%homeHref%%").join(homeHref(locale));
  html = html
    .split("%%altLangHref%%")
    .join(
      locale === "es"
        ? v7PageHref("en", page.slug)
        : v7PageHref("es", page.slug),
    );
  html = html.split("%%canonicalUrl%%").join(v7CanonicalUrl(locale, page.slug));
  html = html
    .split("%%hreflangEs%%")
    .join(SITE_BASE_URL + v7PageHref("es", page.slug));
  html = html
    .split("%%hreflangEn%%")
    .join(SITE_BASE_URL + v7PageHref("en", page.slug));
  html = html.split("%%ogImage%%").join(ogImage);
  html = html.split("%%EXTENSION_CTA_BUTTON%%").join(ctaButton(strings));
  html = html
    .split("%%MANIFEST_HREF%%")
    .join(resolvedAssetsPrefix + "manifest." + locale + ".webmanifest");
  html = html.split("%%SW_PATH%%").join("/sw.js");

  return withGuideJsonLd(
    html,
    strings,
    locale,
    page.slug,
    page.titleKey,
    page.metaKey,
  );
}

// Render a "chords and their notes" page (src/site/circle-fifths.html, shared
// by all entries in CIRCLE_PAGES) for one locale. Same head/footer chrome as
// the V7 pages; a single-column grid of chords with the sounding pitch on each
// string and their root, third and fifth (computed client-side by the page's
// data script).
function renderCirclePage(template, strings, locale, page) {
  const resolvedAssetsPrefix = locale === "es" ? "assets/" : "../assets/";
  const ogImage = SITE_BASE_URL + "/assets/og-image.png";
  let html = template;

  const simpleKeys = [
    "htmlLang",
    "wordmark",
    "wordmarkSmall",
    "altLangLabel",
    "circleColChord",
    "circleColNotes",
    "extensionHeading",
    "extensionDescription",
  ];
  simpleKeys.forEach(function (key) {
    html = html.split("%%" + key + "%%").join(strings[key] || "");
  });

  const labels = {
    prevLabel: strings.cfPosPrevLabel || "Posición anterior",
    nextLabel: strings.cfPosNextLabel || "Posición siguiente",
  };

  html = html.split("%%PAGE_TITLE%%").join(strings[page.titleKey] || "");
  html = html
    .split("%%PAGE_META_DESCRIPTION%%")
    .join(strings[page.metaKey] || "");
  html = html.split("%%PAGE_H1%%").join(strings[page.h1Key] || "");
  html = html.split("%%PAGE_LEAD%%").join(strings[page.leadKey] || "");
  html = html.split("%%CIRCLE_LABELS_JSON%%").join(JSON.stringify(labels));
  html = html
    .split("%%CIRCLE_SCRIPT%%")
    .join(resolvedAssetsPrefix + page.scriptFile);
  html = html
    .split("%%OTHER_CIRCLE_HREF%%")
    .join(v7PageHref(locale, page.otherSlug));
  html = html
    .split("%%OTHER_CIRCLE_LABEL%%")
    .join(strings[page.otherLabelKey] || "");

  html = html.split("%%ASSETS_PREFIX%%").join(resolvedAssetsPrefix);
  html = html.split("%%homeHref%%").join(homeHref(locale));
  html = html
    .split("%%altLangHref%%")
    .join(
      locale === "es"
        ? v7PageHref("en", page.slug)
        : v7PageHref("es", page.slug),
    );
  html = html.split("%%canonicalUrl%%").join(v7CanonicalUrl(locale, page.slug));
  html = html
    .split("%%hreflangEs%%")
    .join(SITE_BASE_URL + v7PageHref("es", page.slug));
  html = html
    .split("%%hreflangEn%%")
    .join(SITE_BASE_URL + v7PageHref("en", page.slug));
  html = html.split("%%ogImage%%").join(ogImage);
  html = html.split("%%EXTENSION_CTA_BUTTON%%").join(ctaButton(strings));
  html = html
    .split("%%MANIFEST_HREF%%")
    .join(resolvedAssetsPrefix + "manifest." + locale + ".webmanifest");
  html = html.split("%%SW_PATH%%").join("/sw.js");

  return withGuideJsonLd(
    html,
    strings,
    locale,
    page.slug,
    page.titleKey,
    page.metaKey,
  );
}

// Render the diminished-chords page (src/site/dim-guide.html) for one
// locale. Single static page (no major/minor pairing) with three grids of
// dim7 diagrams, grouped by which string carries the root.
function renderDimPage(template, strings, locale) {
  const resolvedAssetsPrefix = locale === "es" ? "assets/" : "../assets/";
  const ogImage = SITE_BASE_URL + "/assets/og-image.png";
  let html = template;

  const simpleKeys = [
    "htmlLang",
    "wordmark",
    "wordmarkSmall",
    "altLangLabel",
    "extensionHeading",
    "extensionDescription",
    "dimSection6Title",
    "dimSection6Lead",
    "dimSection5Title",
    "dimSection5Lead",
    "dimSection4Title",
    "dimSection4Lead",
  ];
  simpleKeys.forEach(function (key) {
    html = html.split("%%" + key + "%%").join(strings[key] || "");
  });

  html = html.split("%%PAGE_TITLE%%").join(strings.dimPageTitle || "");
  html = html
    .split("%%PAGE_META_DESCRIPTION%%")
    .join(strings.dimMetaDescription || "");
  html = html.split("%%PAGE_H1%%").join(strings.dimH1 || "");
  html = html.split("%%PAGE_LEAD%%").join(strings.dimLead || "");
  html = html.split("%%PAGE_LEAD_FORMS%%").join(strings.dimLeadForms || "");
  html = html
    .split("%%PAGE_SCRIPT%%")
    .join(resolvedAssetsPrefix + "dim-guide.js");

  html = html.split("%%ASSETS_PREFIX%%").join(resolvedAssetsPrefix);
  html = html.split("%%homeHref%%").join(homeHref(locale));
  html = html
    .split("%%altLangHref%%")
    .join(
      locale === "es" ? v7PageHref("en", DIM_SLUG) : v7PageHref("es", DIM_SLUG),
    );
  html = html.split("%%canonicalUrl%%").join(v7CanonicalUrl(locale, DIM_SLUG));
  html = html
    .split("%%hreflangEs%%")
    .join(SITE_BASE_URL + v7PageHref("es", DIM_SLUG));
  html = html
    .split("%%hreflangEn%%")
    .join(SITE_BASE_URL + v7PageHref("en", DIM_SLUG));
  html = html.split("%%ogImage%%").join(ogImage);
  html = html.split("%%EXTENSION_CTA_BUTTON%%").join(ctaButton(strings));
  html = html
    .split("%%MANIFEST_HREF%%")
    .join(resolvedAssetsPrefix + "manifest." + locale + ".webmanifest");
  html = html.split("%%SW_PATH%%").join("/sw.js");

  return withGuideJsonLd(
    html,
    strings,
    locale,
    DIM_SLUG,
    "dimPageTitle",
    "dimMetaDescription",
  );
}

// Render the "identify chords from notes" page (src/site/note-finder.html)
// for one locale. Single static page (no major/minor pairing): a piano-style
// note picker filters chords-db.js client-side (see src/site/note-finder.js
// and src/shared/note-match.js).
function renderNoteFinderPage(template, strings, locale) {
  const resolvedAssetsPrefix = locale === "es" ? "assets/" : "../assets/";
  const ogImage = SITE_BASE_URL + "/assets/og-image.png";
  let html = template;

  const simpleKeys = [
    "htmlLang",
    "wordmark",
    "wordmarkSmall",
    "altLangLabel",
    "extensionHeading",
    "extensionDescription",
    "noteFinderNotesLabel",
    "noteFinderAccidentalsLabel",
    "noteFinderClearLabel",
    "noteFinderResultsLabel",
  ];
  simpleKeys.forEach(function (key) {
    html = html.split("%%" + key + "%%").join(strings[key] || "");
  });

  const noteFinderStrings = {
    noteFinderSelectPrompt: strings.noteFinderSelectPrompt || "",
    noteFinderEmpty: strings.noteFinderEmpty || "",
  };
  // Position-carousel labels, shared with the main chord finder.
  [
    "cfPosPrevLabel",
    "cfPosNextLabel",
    "cfPosOpen",
    "cfPosBarre6",
    "cfPosBarre5",
    "cfPosDim4",
    "cfPosDim5",
    "cfPosDim6",
  ].forEach(function (key) {
    if (strings[key]) noteFinderStrings[key] = strings[key];
  });

  html = html.split("%%PAGE_TITLE%%").join(strings.noteFinderPageTitle || "");
  html = html
    .split("%%PAGE_META_DESCRIPTION%%")
    .join(strings.noteFinderMetaDescription || "");
  html = html.split("%%PAGE_H1%%").join(strings.noteFinderH1 || "");
  html = html.split("%%PAGE_LEAD%%").join(strings.noteFinderLead || "");
  html = html
    .split("%%NOTE_FINDER_LABELS_JSON%%")
    .join(JSON.stringify(strings.cfRootLabels || []));
  html = html
    .split("%%NOTE_FINDER_STRINGS_JSON%%")
    .join(JSON.stringify(noteFinderStrings));

  html = html.split("%%ASSETS_PREFIX%%").join(resolvedAssetsPrefix);
  html = html.split("%%homeHref%%").join(homeHref(locale));
  html = html
    .split("%%altLangHref%%")
    .join(
      locale === "es"
        ? v7PageHref("en", NOTE_FINDER_SLUG)
        : v7PageHref("es", NOTE_FINDER_SLUG),
    );
  html = html
    .split("%%canonicalUrl%%")
    .join(v7CanonicalUrl(locale, NOTE_FINDER_SLUG));
  html = html
    .split("%%hreflangEs%%")
    .join(SITE_BASE_URL + v7PageHref("es", NOTE_FINDER_SLUG));
  html = html
    .split("%%hreflangEn%%")
    .join(SITE_BASE_URL + v7PageHref("en", NOTE_FINDER_SLUG));
  html = html.split("%%ogImage%%").join(ogImage);
  html = html.split("%%EXTENSION_CTA_BUTTON%%").join(ctaButton(strings));
  html = html
    .split("%%MANIFEST_HREF%%")
    .join(resolvedAssetsPrefix + "manifest." + locale + ".webmanifest");
  html = html.split("%%SW_PATH%%").join("/sw.js");

  return html;
}

// Render the tab editor page (src/site/tab-editor.html) for one locale.
function renderTabEditorPage(template, strings, locale) {
  const resolvedAssetsPrefix = locale === "es" ? "assets/" : "../assets/";
  const ogImage = SITE_BASE_URL + "/assets/og-image.png";
  let html = template;

  const simpleKeys = ["htmlLang", "wordmark", "wordmarkSmall", "altLangLabel"];
  simpleKeys.forEach(function (key) {
    html = html.split("%%" + key + "%%").join(strings[key] || "");
  });

  html = html.split("%%PAGE_TITLE%%").join(strings.tabPageTitle || "");
  html = html
    .split("%%PAGE_META_DESCRIPTION%%")
    .join(strings.tabMetaDescription || "");
  html = html.split("%%PAGE_H1%%").join(strings.tabH1 || "");
  html = html.split("%%PAGE_LEAD%%").join(strings.tabLead || "");
  html = html.split("%%ASSETS_PREFIX%%").join(resolvedAssetsPrefix);
  html = html.split("%%homeHref%%").join(homeHref(locale));
  html = html
    .split("%%altLangHref%%")
    .join(
      locale === "es"
        ? v7PageHref("en", TAB_EDITOR_SLUG)
        : v7PageHref("es", TAB_EDITOR_SLUG),
    );
  html = html
    .split("%%canonicalUrl%%")
    .join(v7CanonicalUrl(locale, TAB_EDITOR_SLUG));
  html = html
    .split("%%hreflangEs%%")
    .join(SITE_BASE_URL + v7PageHref("es", TAB_EDITOR_SLUG));
  html = html
    .split("%%hreflangEn%%")
    .join(SITE_BASE_URL + v7PageHref("en", TAB_EDITOR_SLUG));
  html = html.split("%%ogImage%%").join(ogImage);
  html = html
    .split("%%MANIFEST_HREF%%")
    .join(resolvedAssetsPrefix + "manifest." + locale + ".webmanifest");
  html = html.split("%%SW_PATH%%").join("/sw.js");

  const opts = structuredDataOpts(
    locale,
    v7CanonicalUrl(locale, TAB_EDITOR_SLUG),
    strings.tabPageTitle || "",
    strings.tabMetaDescription || "",
  );
  return injectJsonLd(html, toolJsonLd(opts));
}

// Render the "Ejercicio de sextas" page (src/site/sixths-exercise.html) for one locale.
function renderSixthsPage(template, strings, locale) {
  const resolvedAssetsPrefix = locale === "es" ? "assets/" : "../assets/";
  const ogImage = SITE_BASE_URL + "/assets/og-image.png";
  let html = template;

  const simpleKeys = [
    "htmlLang",
    "wordmark",
    "wordmarkSmall",
    "altLangLabel",
    "extensionHeading",
    "extensionDescription",
  ];
  simpleKeys.forEach(function (key) {
    html = html.split("%%" + key + "%%").join(strings[key] || "");
  });

  html = html.split("%%PAGE_TITLE%%").join(strings.sixthsPageTitle || "");
  html = html
    .split("%%PAGE_META_DESCRIPTION%%")
    .join(strings.sixthsMetaDescription || "");
  html = html.split("%%PAGE_H1%%").join(strings.sixthsH1 || "");
  html = html.split("%%PAGE_LEAD%%").join(strings.sixthsLead || "");
  html = html.split("%%SIXTHS_SOURCE%%").join(strings.sixthsSource || "");
  html = html.split("%%SIXTHS_VIDEO_ID%%").join(SIXTHS_VIDEO_ID);
  html = html
    .split("%%TAB_EDITOR_PROMO%%")
    .join(tabEditorPromo(strings, locale));
  html = html.split("%%EXTENSION_CTA_BUTTON%%").join(ctaButton(strings));
  html = html
    .split("%%SIXTHS_TABS_JSON%%")
    .join(JSON.stringify(SIXTHS_TABS.map(parseAsciiTab)));
  html = html.split("%%ASSETS_PREFIX%%").join(resolvedAssetsPrefix);
  html = html.split("%%homeHref%%").join(homeHref(locale));
  html = html
    .split("%%altLangHref%%")
    .join(
      locale === "es"
        ? v7PageHref("en", SIXTHS_SLUG)
        : v7PageHref("es", SIXTHS_SLUG),
    );
  html = html
    .split("%%canonicalUrl%%")
    .join(v7CanonicalUrl(locale, SIXTHS_SLUG));
  html = html
    .split("%%hreflangEs%%")
    .join(SITE_BASE_URL + v7PageHref("es", SIXTHS_SLUG));
  html = html
    .split("%%hreflangEn%%")
    .join(SITE_BASE_URL + v7PageHref("en", SIXTHS_SLUG));
  html = html.split("%%ogImage%%").join(ogImage);
  html = html
    .split("%%MANIFEST_HREF%%")
    .join(resolvedAssetsPrefix + "manifest." + locale + ".webmanifest");
  html = html.split("%%SW_PATH%%").join("/sw.js");

  return withGuideJsonLd(
    html,
    strings,
    locale,
    SIXTHS_SLUG,
    "sixthsPageTitle",
    "sixthsMetaDescription",
  );
}

// Fill the document chrome shared by the standalone tool/policy templates.
function fillPageChrome(html, strings, locale, slug) {
  const resolvedAssetsPrefix = locale === "es" ? "assets/" : "../assets/";
  html = html.split("%%ASSETS_PREFIX%%").join(resolvedAssetsPrefix);
  ["htmlLang", "wordmark", "wordmarkSmall", "altLangLabel"].forEach(
    function (key) {
      html = html.split("%%" + key + "%%").join(strings[key] || "");
    },
  );
  return html
    .split("%%homeHref%%")
    .join(homeHref(locale))
    .split("%%altLangHref%%")
    .join(locale === "es" ? v7PageHref("en", slug) : v7PageHref("es", slug))
    .split("%%canonicalUrl%%")
    .join(v7CanonicalUrl(locale, slug))
    .split("%%hreflangEs%%")
    .join(SITE_BASE_URL + v7PageHref("es", slug))
    .split("%%hreflangEn%%")
    .join(SITE_BASE_URL + v7PageHref("en", slug))
    .split("%%ogImage%%")
    .join(SITE_BASE_URL + "/assets/og-image.png")
    .split("%%MANIFEST_HREF%%")
    .join(resolvedAssetsPrefix + "manifest." + locale + ".webmanifest")
    .split("%%SW_PATH%%")
    .join("/sw.js");
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Plain text with contact addresses turned into mailto links.
function linkifyEmails(text) {
  return escapeHtml(text).replace(
    /([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g,
    '<a href="mailto:$1">$1</a>',
  );
}

// Render the bilingual privacy policy (src/site/privacy.html).
function renderPrivacyPage(template, strings, locale) {
  const sections = (strings.privSections || [])
    .map(function (section) {
      return (
        "<h2>" +
        escapeHtml(section.h) +
        "</h2>\n      " +
        section.p
          .map(function (para) {
            return "<p>" + linkifyEmails(para) + "</p>";
          })
          .join("\n      ")
      );
    })
    .join("\n      ");
  let html = fillPageChrome(template, strings, locale, PRIVACY_SLUG);
  html = html
    .split("%%PAGE_TITLE%%")
    .join(strings.privPageTitle || "")
    .split("%%PAGE_META_DESCRIPTION%%")
    .join(strings.privMetaDescription || "")
    .split("%%PAGE_H1%%")
    .join(strings.privH1 || "")
    .split("%%PAGE_LEAD%%")
    .join(strings.privLead || "")
    .split("%%PRIVACY_SECTIONS%%")
    .join(sections);
  return withGuideJsonLd(
    html,
    strings,
    locale,
    PRIVACY_SLUG,
    "privPageTitle",
    "privMetaDescription",
  );
}

// Render the Partitura y tablatura tool page (src/site/partitura.html). The
// client script reads window.PARTITURA_CONFIG: API base URL, Turnstile site
// key and every part* string for the locale.
function renderPartituraPage(template, strings, locale) {
  const i18n = {};
  Object.keys(strings).forEach(function (key) {
    if (key.indexOf("part") === 0) i18n[key] = strings[key];
  });
  const config = {
    apiUrl: PARTITURA_API_URL,
    turnstileSiteKey: TURNSTILE_SITE_KEY,
    locale: locale,
    privacyHref: v7PageHref(locale, PRIVACY_SLUG),
    strings: i18n,
  };
  let html = fillPageChrome(template, strings, locale, PARTITURA_SLUG);
  [
    "partRightsLabel",
    "partFileLabel",
    "partTuningLabel",
    "partTuningAuto",
    "partTuningStandard",
    "partTuningDropD",
    "partSubmit",
    "partResumeHint",
    "partLoadingAlt",
    "partPrivacySummary",
    "partPrivacyBody",
    "partPrivacyLink",
  ].forEach(function (key) {
    html = html.split("%%" + key + "%%").join(escapeHtml(strings[key] || ""));
  });
  html = html
    .split("%%PAGE_TITLE%%")
    .join(strings.partPageTitle || "")
    .split("%%PAGE_META_DESCRIPTION%%")
    .join(strings.partMetaDescription || "")
    .split("%%PAGE_H1%%")
    .join(strings.partH1 || "")
    .split("%%PAGE_LEAD%%")
    .join(strings.partLead || "")
    .split("%%PRIVACY_HREF%%")
    .join(v7PageHref(locale, PRIVACY_SLUG))
    .split("%%PARTITURA_CONFIG%%")
    .join(JSON.stringify(config).replace(/</g, "\\u003c"));
  return withGuideJsonLd(
    html,
    strings,
    locale,
    PARTITURA_SLUG,
    "partPageTitle",
    "partMetaDescription",
  );
}

// Render the intervals lesson page (src/site/picking-intervals.html) for one
// locale. Fretboard diagrams are computed client-side by
// src/site/picking-render.js; no client-side data script.
function renderPickingPage(template, strings, locale, page) {
  const resolvedAssetsPrefix = locale === "es" ? "assets/" : "../assets/";
  const ogImage = SITE_BASE_URL + "/assets/og-image.png";
  const p = page.prefix;
  let html = template;

  const simpleKeys = [
    "htmlLang",
    "wordmark",
    "wordmarkSmall",
    "altLangLabel",
    "extensionHeading",
    "extensionDescription",
    "intervalsKeyLabel",
    "intervalsInitialKey",
    "intervalsMajor",
    "intervalsMinor",
    "intervalsFig1",
    "intervalsFig2",
    "intervalsFig3",
    "intervalsFig4",
  ];
  simpleKeys.forEach(function (key) {
    html = html.split("%%" + key + "%%").join(strings[key] || "");
  });

  html = html.split("%%PAGE_TITLE%%").join(strings[p + "PageTitle"] || "");
  html = html
    .split("%%PAGE_META_DESCRIPTION%%")
    .join(strings[p + "MetaDescription"] || "");
  html = html.split("%%PAGE_H1%%").join(strings[p + "H1"] || "");
  html = html.split("%%PAGE_LEAD%%").join(strings[p + "Lead"] || "");

  html = html.split("%%PICKING_MODE%%").join(page.mode);

  html = html.split("%%ASSETS_PREFIX%%").join(resolvedAssetsPrefix);
  html = html.split("%%homeHref%%").join(homeHref(locale));
  html = html
    .split("%%altLangHref%%")
    .join(
      locale === "es"
        ? v7PageHref("en", page.slug)
        : v7PageHref("es", page.slug),
    );
  html = html.split("%%canonicalUrl%%").join(v7CanonicalUrl(locale, page.slug));
  html = html
    .split("%%hreflangEs%%")
    .join(SITE_BASE_URL + v7PageHref("es", page.slug));
  html = html
    .split("%%hreflangEn%%")
    .join(SITE_BASE_URL + v7PageHref("en", page.slug));
  html = html.split("%%ogImage%%").join(ogImage);
  html = html.split("%%EXTENSION_CTA_BUTTON%%").join(ctaButton(strings));
  html = html
    .split("%%MANIFEST_HREF%%")
    .join(resolvedAssetsPrefix + "manifest." + locale + ".webmanifest");
  html = html.split("%%SW_PATH%%").join("/sw.js");

  return withGuideJsonLd(
    html,
    strings,
    locale,
    page.slug,
    p + "PageTitle",
    p + "MetaDescription",
  );
}

// Render the site-wide 404 page (src/site/404.html) for GitHub Pages. A
// single Spanish page at the root — GitHub Pages only serves one 404.html
// at the domain root, so there's no per-locale variant.
function render404Page(template, strings) {
  const resolvedAssetsPrefix = "assets/";
  const ogImage = SITE_BASE_URL + "/assets/og-image.png";
  let html = template;

  const simpleKeys = [
    "wordmark",
    "wordmarkSmall",
    "extensionHeading",
    "extensionDescription",
    "notFoundExploreLabel",
    "notFoundHomeLink",
    "notFoundPickingLink",
    "notFoundV7Link",
  ];
  simpleKeys.forEach(function (key) {
    html = html.split("%%" + key + "%%").join(strings[key] || "");
  });

  html = html.split("%%PAGE_TITLE%%").join(strings.notFoundPageTitle || "");
  html = html
    .split("%%PAGE_META_DESCRIPTION%%")
    .join(strings.notFoundMetaDescription || "");
  html = html.split("%%PAGE_H1%%").join(strings.notFoundH1 || "");
  html = html.split("%%PAGE_LEAD%%").join(strings.notFoundLead || "");
  html = html
    .split("%%NOTE_FINDER_PROMO%%")
    .join(noteFinderPromo(strings, "es"));

  html = html.split("%%ASSETS_PREFIX%%").join(resolvedAssetsPrefix);
  html = html.split("%%homeHref%%").join(homeHref("es"));
  html = html.split("%%V7_PAGE_HREF%%").join(v7PageHref("es"));
  html = html
    .split("%%PICKING_PAGE_HREF%%")
    .join(v7PageHref("es", INTERVALS_PAGE.slug));
  html = html.split("%%ogImage%%").join(ogImage);
  html = html.split("%%EXTENSION_CTA_BUTTON%%").join(ctaButton(strings));
  html = html
    .split("%%MANIFEST_HREF%%")
    .join(resolvedAssetsPrefix + "manifest.es.webmanifest");
  html = html.split("%%SW_PATH%%").join("/sw.js");

  return html;
}

// ---- build -----------------------------------------------------------------

console.log("==> Building site assets...");

fs.rmSync(DIST_SITE, { recursive: true, force: true });
const ASSETS_DIST = path.join(DIST_SITE, "assets");
const VENDOR_DIST = path.join(ASSETS_DIST, "vendor");
ensureDir(ASSETS_DIST);
ensureDir(VENDOR_DIST);

// Shared JS.
[
  "chords-db.js",
  "chord-diagram.js",
  "chord-positions.js",
  "chord-search.js",
  "note-names.js",
  "note-match.js",
].forEach(function (f) {
  copyFile(path.join(SRC_SHARED, f), path.join(ASSETS_DIST, f));
});
// Site-specific JS and CSS.
copyFile(
  path.join(SRC_SITE, "chord-finder.js"),
  path.join(ASSETS_DIST, "chord-finder.js"),
);
copyFile(
  path.join(SRC_SITE, "v7-guide.js"),
  path.join(ASSETS_DIST, "v7-guide.js"),
);
copyFile(
  path.join(SRC_SITE, "v7-minor.js"),
  path.join(ASSETS_DIST, "v7-minor.js"),
);
copyFile(
  path.join(SRC_SHARED, "v7-page-render.js"),
  path.join(ASSETS_DIST, "v7-page-render.js"),
);
copyFile(
  path.join(SRC_SHARED, "v7-chord-overrides.js"),
  path.join(ASSETS_DIST, "v7-chord-overrides.js"),
);
copyFile(
  path.join(SRC_SITE, "fifths-wheel.js"),
  path.join(ASSETS_DIST, "fifths-wheel.js"),
);
copyFile(
  path.join(SRC_SITE, "circle-fifths.js"),
  path.join(ASSETS_DIST, "circle-fifths.js"),
);
copyFile(
  path.join(SRC_SITE, "circle-fifths-minor.js"),
  path.join(ASSETS_DIST, "circle-fifths-minor.js"),
);
copyFile(
  path.join(SRC_SHARED, "circle-render.js"),
  path.join(ASSETS_DIST, "circle-render.js"),
);
copyFile(
  path.join(SRC_SITE, "dim-guide.js"),
  path.join(ASSETS_DIST, "dim-guide.js"),
);
copyFile(
  path.join(SRC_SHARED, "dim-page-render.js"),
  path.join(ASSETS_DIST, "dim-page-render.js"),
);
copyFile(
  path.join(SRC_SITE, "note-finder.js"),
  path.join(ASSETS_DIST, "note-finder.js"),
);
copyFile(path.join(SRC_SITE, "site.css"), path.join(ASSETS_DIST, "site.css"));
copyFile(
  path.join(SRC_SITE, "picking-render.js"),
  path.join(ASSETS_DIST, "picking-render.js"),
);
copyFile(
  path.join(SRC_SITE, "guitar-player-cubist-left-head.svg"),
  path.join(ASSETS_DIST, "guitar-player-cubist-left-head.svg"),
);
// Song-sheet mechanism (cancionero: lyrics-with-chords pages under /canciones,
// not linked from nav — discoverable via SEO/sitemap only).
copyFile(
  path.join(SRC_SHARED, "song-sheet.js"),
  path.join(ASSETS_DIST, "song-sheet.js"),
);
copyFile(
  path.join(SRC_SHARED, "chord-modal.js"),
  path.join(ASSETS_DIST, "chord-modal.js"),
);
copyFile(
  path.join(SRC_SITE, "guitar-player-cubist-left-head.svg"),
  path.join(ASSETS_DIST, "favicon.svg"),
);
// Vendored svguitar, fuzzysort, and jsPDF.
copyFile(
  path.join(SRC_VENDOR, "svguitar.umd.js"),
  path.join(VENDOR_DIST, "svguitar.umd.js"),
);
copyFile(
  path.join(SRC_VENDOR, "fuzzysort.js"),
  path.join(VENDOR_DIST, "fuzzysort.js"),
);
copyFile(
  path.join(SRC_VENDOR, "jspdf.umd.min.js"),
  path.join(VENDOR_DIST, "jspdf.umd.min.js"),
);
copyFile(
  ASCII_TABS,
  path.join(VENDOR_DIST, "ascii-tabs.js"),
);
if (PARTITURA_ENABLED) {
  copyFile(
    path.join(SRC_SITE, "partitura.js"),
    path.join(ASSETS_DIST, "partitura.js"),
  );
  copyFile(
    path.join(SRC_SITE, "partitura-loading.svg"),
    path.join(ASSETS_DIST, "partitura-loading.svg"),
  );
  copyFile(
    path.join(SRC_SITE, "partitura-banner.webp"),
    path.join(ASSETS_DIST, "partitura-banner.webp"),
  );
}
// OG image (optional — skip silently if not present yet).
const ogImageSrc = path.join(SRC_SITE, "og-image.png");
if (fs.existsSync(ogImageSrc)) {
  copyFile(ogImageSrc, path.join(ASSETS_DIST, "og-image.png"));
} else {
  say("(src/site/og-image.png not found — og:image will 404 until added)");
}
// Store-facing static pages.
const storeDist = path.join(DIST_SITE, "store");
ensureDir(storeDist);
copyFile(
  path.join(SRC_STORE, "privacy-policy.html"),
  path.join(storeDist, "privacy-policy.html"),
);

// Song pages ("cancionero"): standalone lyrics-with-chords pages under
// /canciones. Static, not part of the i18n template pipeline, and NOT linked
// from the nav/index anywhere — discoverable only via sitemap.xml/SEO. Copies
// every file in src/site/canciones/ verbatim (HTML + the page's own CSS).
const SRC_CANCIONES = path.join(SRC_SITE, "canciones");
const CANCIONES_SLUGS = [];
if (fs.existsSync(SRC_CANCIONES)) {
  const cancionesDist = path.join(DIST_SITE, "canciones");
  ensureDir(cancionesDist);
  fs.readdirSync(SRC_CANCIONES).forEach(function (file) {
    copyFile(path.join(SRC_CANCIONES, file), path.join(cancionesDist, file));
    if (file.endsWith(".html")) CANCIONES_SLUGS.push(file);
  });
}

// ---- PWA: icons ------------------------------------------------------------
// PNG icons for the web app manifest, generated from the site logo.

console.log("==> Generating PWA icons...");
const ICONS_DIST = path.join(ASSETS_DIST, "icons");
ensureDir(ICONS_DIST);
const PWA_ICON_SIZES = [192, 512];
const maskableSvg = path.join(SRC_SITE, "icon-maskable.svg");
const hasRsvg = (() => {
  try {
    execSync("rsvg-convert --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();
if (!fs.existsSync(maskableSvg)) {
  fail("src/site/icon-maskable.svg is required to generate PWA icons.");
}
if (!hasRsvg) {
  say("(rsvg-convert not found — generating portable PNG fallbacks)");
}
PWA_ICON_SIZES.forEach(function (size) {
  const out = path.join(ICONS_DIST, "icon-" + size + ".png");
  if (hasRsvg) {
    execSync(
      "rsvg-convert -w " +
        size +
        " -h " +
        size +
        ' "' +
        maskableSvg +
        '" -o "' +
        out +
        '"',
    );
  } else {
    drawIcon(size, out);
  }
  say("assets/icons/icon-" + size + ".png");
});

// ---- PWA: web app manifest (one per locale) --------------------------------

console.log("==> Writing web app manifests...");
function writeManifest(locale, strings) {
  const name = locale === "es" ? "Acordes para la guitarra" : "Guitar Chords";
  const shortName = strings.wordmark || name;
  const manifest = {
    name: name,
    short_name: shortName,
    description: strings.metaDescription || "",
    lang: strings.htmlLang || locale,
    start_url: locale === "es" ? "/" : "/en",
    scope: "/",
    display: "standalone",
    background_color: "#fdfaf5",
    theme_color: "#fdfaf5",
    icons: [
      {
        src: "favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };
  const out = path.join(ASSETS_DIST, "manifest." + locale + ".webmanifest");
  fs.writeFileSync(out, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  say(path.relative(ROOT, out));
}

// ---- PWA: service worker (root scope, offline app-shell) -------------------

console.log("==> Writing service worker...");
const swTemplate = fs.readFileSync(path.join(SRC_SITE, "sw.js"), "utf8");
const cacheVersion = new Date()
  .toISOString()
  .replace(/[^0-9]/g, "")
  .slice(0, 14);
const precacheUrls = [
  "/",
  "/en",
  "/assets/site.css",
  "/assets/favicon.svg",
  "/assets/chords-db.js",
  "/assets/chord-diagram.js",
  "/assets/chord-positions.js",
  "/assets/chord-search.js",
  "/assets/note-names.js",
  "/assets/chord-finder.js",
  "/assets/fifths-wheel.js",
  "/assets/circle-render.js",
  "/assets/circle-fifths.js",
  "/assets/circle-fifths-minor.js",
  "/assets/dim-guide.js",
  "/assets/dim-page-render.js",
  "/assets/note-match.js",
  "/assets/note-finder.js",
  "/assets/vendor/svguitar.umd.js",
  "/assets/vendor/fuzzysort.js",
  "/assets/vendor/ascii-tabs.js",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
  "/assets/picking-render.js",
  "/404.html",
];
const swOut = swTemplate
  .split("%%CACHE_VERSION%%")
  .join(cacheVersion)
  .split("%%PRECACHE_URLS%%")
  .join(JSON.stringify(precacheUrls))
  .split("%%START_URL%%")
  .join("/");
const swFile = path.join(DIST_SITE, "sw.js");
fs.writeFileSync(swFile, swOut, "utf8");
say(path.relative(ROOT, swFile));

console.log("==> Rendering locale pages...");

LOCALES.forEach(function (locale) {
  const stringsPath = path.join(SRC_I18N, "strings." + locale + ".json");
  if (!fs.existsSync(stringsPath)) fail("Missing: " + stringsPath);
  const strings = JSON.parse(fs.readFileSync(stringsPath, "utf8"));

  writeManifest(locale, strings);

  if (locale === "es") {
    const html = render(template, strings, locale, "assets/", "root");
    const outFile = path.join(DIST_SITE, "index.html");
    fs.writeFileSync(outFile, html, "utf8");
    say(path.relative(ROOT, outFile));

    V7_PAGES.forEach(function (page) {
      const v7Html = renderV7Page(v7Template, strings, locale, page);
      const v7OutFile = path.join(DIST_SITE, page.slug + ".html");
      fs.writeFileSync(v7OutFile, v7Html, "utf8");
      say(path.relative(ROOT, v7OutFile));
    });

    CIRCLE_PAGES.forEach(function (page) {
      const circleHtml = renderCirclePage(
        page.slug === "circulo-de-quintas" ? fifthsTemplate : circleTemplate,
        strings,
        locale,
        page,
      );
      const circleOutFile = path.join(DIST_SITE, page.slug + ".html");
      fs.writeFileSync(circleOutFile, circleHtml, "utf8");
      say(path.relative(ROOT, circleOutFile));
    });

    {
      const dimHtml = renderDimPage(dimTemplate, strings, locale);
      const dimOutFile = path.join(DIST_SITE, DIM_SLUG + ".html");
      fs.writeFileSync(dimOutFile, dimHtml, "utf8");
      say(path.relative(ROOT, dimOutFile));
    }

    {
      const noteFinderHtml = renderNoteFinderPage(
        noteFinderTemplate,
        strings,
        locale,
      );
      const noteFinderOutFile = path.join(
        DIST_SITE,
        NOTE_FINDER_SLUG + ".html",
      );
      fs.writeFileSync(noteFinderOutFile, noteFinderHtml, "utf8");
      say(path.relative(ROOT, noteFinderOutFile));
    }

    {
      const tabEditorHtml = renderTabEditorPage(
        tabEditorTemplate,
        strings,
        locale,
      );
      const tabEditorOutFile = path.join(DIST_SITE, TAB_EDITOR_SLUG + ".html");
      fs.writeFileSync(tabEditorOutFile, tabEditorHtml, "utf8");
      say(path.relative(ROOT, tabEditorOutFile));
    }

    {
      const sixthsHtml = renderSixthsPage(sixthsTemplate, strings, locale);
      const sixthsOutFile = path.join(DIST_SITE, SIXTHS_SLUG + ".html");
      fs.writeFileSync(sixthsOutFile, sixthsHtml, "utf8");
      say(path.relative(ROOT, sixthsOutFile));
    }

    {
      const privacyOutFile = path.join(DIST_SITE, PRIVACY_SLUG + ".html");
      fs.writeFileSync(
        privacyOutFile,
        renderPrivacyPage(privacyTemplate, strings, locale),
        "utf8",
      );
      say(path.relative(ROOT, privacyOutFile));
    }

    if (PARTITURA_ENABLED) {
      const partOutFile = path.join(DIST_SITE, PARTITURA_SLUG + ".html");
      fs.writeFileSync(
        partOutFile,
        renderPartituraPage(partituraTemplate, strings, locale),
        "utf8",
      );
      say(path.relative(ROOT, partOutFile));
    }

    ALL_PICKING_PAGES.forEach(function (page) {
      const pickingHtml = renderPickingPage(
        intervalsTemplate,
        strings,
        locale,
        page,
      );
      const pickingOutFile = path.join(DIST_SITE, page.slug + ".html");
      fs.writeFileSync(pickingOutFile, pickingHtml, "utf8");
      say(path.relative(ROOT, pickingOutFile));
    });
    return;
  }

  const localeDir = path.join(DIST_SITE, locale);
  ensureDir(localeDir);

  const cleanHtml = render(template, strings, locale, "assets/", "clean");
  const cleanUrlFile = path.join(DIST_SITE, locale + ".html");
  fs.writeFileSync(cleanUrlFile, cleanHtml, "utf8");
  say(path.relative(ROOT, cleanUrlFile));

  const html = render(template, strings, locale, "../assets/", "nested");
  const outFile = path.join(localeDir, "index.html");
  fs.writeFileSync(outFile, html, "utf8");
  say(path.relative(ROOT, outFile));

  V7_PAGES.forEach(function (page) {
    const v7Html = renderV7Page(v7Template, strings, locale, page);
    const v7OutFile = path.join(localeDir, page.slug + ".html");
    fs.writeFileSync(v7OutFile, v7Html, "utf8");
    say(path.relative(ROOT, v7OutFile));
  });

  CIRCLE_PAGES.forEach(function (page) {
    const circleHtml = renderCirclePage(
      page.slug === "circulo-de-quintas" ? fifthsTemplate : circleTemplate,
      strings,
      locale,
      page,
    );
    const circleOutFile = path.join(localeDir, page.slug + ".html");
    fs.writeFileSync(circleOutFile, circleHtml, "utf8");
    say(path.relative(ROOT, circleOutFile));
  });

  {
    const dimHtml = renderDimPage(dimTemplate, strings, locale);
    const dimOutFile = path.join(localeDir, DIM_SLUG + ".html");
    fs.writeFileSync(dimOutFile, dimHtml, "utf8");
    say(path.relative(ROOT, dimOutFile));
  }

  {
    const noteFinderHtml = renderNoteFinderPage(
      noteFinderTemplate,
      strings,
      locale,
    );
    const noteFinderOutFile = path.join(localeDir, NOTE_FINDER_SLUG + ".html");
    fs.writeFileSync(noteFinderOutFile, noteFinderHtml, "utf8");
    say(path.relative(ROOT, noteFinderOutFile));
  }

  {
    const tabEditorHtml = renderTabEditorPage(
      tabEditorTemplate,
      strings,
      locale,
    );
    const tabEditorOutFile = path.join(localeDir, TAB_EDITOR_SLUG + ".html");
    fs.writeFileSync(tabEditorOutFile, tabEditorHtml, "utf8");
    say(path.relative(ROOT, tabEditorOutFile));
  }

  {
    const sixthsHtml = renderSixthsPage(sixthsTemplate, strings, locale);
    const sixthsOutFile = path.join(localeDir, SIXTHS_SLUG + ".html");
    fs.writeFileSync(sixthsOutFile, sixthsHtml, "utf8");
    say(path.relative(ROOT, sixthsOutFile));
  }

  {
    const privacyOutFile = path.join(localeDir, PRIVACY_SLUG + ".html");
    fs.writeFileSync(
      privacyOutFile,
      renderPrivacyPage(privacyTemplate, strings, locale),
      "utf8",
    );
    say(path.relative(ROOT, privacyOutFile));
  }

  if (PARTITURA_ENABLED) {
    const partOutFile = path.join(localeDir, PARTITURA_SLUG + ".html");
    fs.writeFileSync(
      partOutFile,
      renderPartituraPage(partituraTemplate, strings, locale),
      "utf8",
    );
    say(path.relative(ROOT, partOutFile));
  }

  ALL_PICKING_PAGES.forEach(function (page) {
    const pickingHtml = renderPickingPage(
      intervalsTemplate,
      strings,
      locale,
      page,
    );
    const pickingOutFile = path.join(localeDir, page.slug + ".html");
    fs.writeFileSync(pickingOutFile, pickingHtml, "utf8");
    say(path.relative(ROOT, pickingOutFile));
  });
});

console.log("==> Rendering 404 page...");
{
  const esStringsPath = path.join(SRC_I18N, "strings.es.json");
  const esStrings = JSON.parse(fs.readFileSync(esStringsPath, "utf8"));
  const notFoundHtml = render404Page(notFoundTemplate, esStrings);
  const notFoundOutFile = path.join(DIST_SITE, "404.html");
  fs.writeFileSync(notFoundOutFile, notFoundHtml, "utf8");
  say(path.relative(ROOT, notFoundOutFile));
}

// ---- Privacy policy link in every page footer --------------------------------
// Runs on the built HTML so every page — including the standalone song sheets
// and pages without a footer — links to the policy in its own language.

console.log("==> Linking the privacy policy from every page footer...");
function addPrivacyLinks(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "assets" || entry.name === "store") return;
      addPrivacyLinks(full);
      return;
    }
    if (!entry.name.endsWith(".html")) return;
    const rel = path.relative(DIST_SITE, full).split(path.sep).join("/");
    const isEn = rel === "en.html" || rel.indexOf("en/") === 0;
    const label = isEn ? "Privacy policy" : "Política de privacidad";
    const href = "/" + (isEn ? "en/" : "") + PRIVACY_SLUG;
    let html = fs.readFileSync(full, "utf8");
    if (html.indexOf('class="privacy-link"') !== -1) return;
    const link =
      '<p class="privacy-link"><a href="' + href + '">' + label + "</a></p>";
    const footerEnd = html.lastIndexOf("</footer>");
    if (footerEnd !== -1) {
      html = html.slice(0, footerEnd) + link + "\n    " + html.slice(footerEnd);
    } else {
      const bodyEnd = html.lastIndexOf("</body>");
      if (bodyEnd === -1) return;
      html =
        html.slice(0, bodyEnd) +
        '<footer class="privacy-footer">' +
        link +
        "</footer>\n  " +
        html.slice(bodyEnd);
    }
    fs.writeFileSync(full, html, "utf8");
  });
}
addPrivacyLinks(DIST_SITE);

// ---- robots.txt ------------------------------------------------------------

console.log("==> Writing robots.txt...");
const robotsTxt = [
  "User-agent: *",
  "Allow: /",
  "",
  "Sitemap: " + SITE_BASE_URL + "/sitemap.xml",
  "",
].join("\n");
const robotsFile = path.join(DIST_SITE, "robots.txt");
fs.writeFileSync(robotsFile, robotsTxt, "utf8");
say(path.relative(ROOT, robotsFile));

// ---- sitemap.xml -----------------------------------------------------------

console.log("==> Writing sitemap.xml...");
const today = new Date().toISOString().slice(0, 10);

// Each entry: URL path, the built file whose content defines "modified", and
// (for bilingual pages) the es/en alternates. lastmod comes from the
// build-generated content-hash manifest.
const sitemapEntries = [];
function addBilingual(esPath, esFile, enPath, enFile, priorities) {
  sitemapEntries.push({
    loc: esPath,
    file: esFile,
    changefreq: "monthly",
    priority: priorities[0],
    es: esPath,
    en: enPath,
  });
  sitemapEntries.push({
    loc: enPath,
    file: enFile,
    changefreq: "monthly",
    priority: priorities[1],
    es: esPath,
    en: enPath,
  });
}
addBilingual("/", "index.html", "/en", "en.html", ["1.0", "0.9"]);
addBilingual("/v7", "v7.html", "/en/v7", "en/v7.html", ["0.6", "0.5"]);
addBilingual("/v7-menor", "v7-menor.html", "/en/v7-menor", "en/v7-menor.html", [
  "0.5",
  "0.4",
]);
function addSlugPages(slugs) {
  slugs.forEach(function (slug) {
    addBilingual(
      "/" + slug,
      slug + ".html",
      "/en/" + slug,
      "en/" + slug + ".html",
      ["0.5", "0.4"],
    );
  });
}
addSlugPages(
  CIRCLE_PAGES.map(function (page) {
    return page.slug;
  }),
);
addSlugPages([DIM_SLUG, NOTE_FINDER_SLUG, SIXTHS_SLUG]);
addBilingual(
  "/" + TAB_EDITOR_SLUG,
  TAB_EDITOR_SLUG + ".html",
  "/en/" + TAB_EDITOR_SLUG,
  "en/" + TAB_EDITOR_SLUG + ".html",
  ["0.7", "0.6"],
);
addBilingual(
  "/" + PRIVACY_SLUG,
  PRIVACY_SLUG + ".html",
  "/en/" + PRIVACY_SLUG,
  "en/" + PRIVACY_SLUG + ".html",
  ["0.3", "0.3"],
);
if (PARTITURA_ENABLED) {
  addBilingual(
    "/" + PARTITURA_SLUG,
    PARTITURA_SLUG + ".html",
    "/en/" + PARTITURA_SLUG,
    "en/" + PARTITURA_SLUG + ".html",
    ["0.7", "0.6"],
  );
}
addSlugPages(
  ALL_PICKING_PAGES.map(function (page) {
    return page.slug;
  }),
);
sitemapEntries.push({
  loc: "/store/privacy-policy.html",
  file: "store/privacy-policy.html",
  changefreq: "yearly",
  priority: "0.3",
});
CANCIONES_SLUGS.forEach(function (file) {
  sitemapEntries.push({
    loc: "/canciones/" + file,
    file: "canciones/" + file,
    changefreq: "yearly",
    priority: "0.4",
  });
});

const lastmodManifestFile = path.join(
  ROOT,
  "src",
  "site",
  "sitemap-lastmod.json",
);
const lastmodContent = {};
sitemapEntries.forEach(function (entry) {
  lastmodContent[entry.loc] = fs.readFileSync(path.join(DIST_SITE, entry.file));
});
const resolvedLastmods = resolveLastmods(
  loadManifest(lastmodManifestFile),
  lastmodContent,
  today,
);
saveManifest(lastmodManifestFile, resolvedLastmods.manifest);

const sitemapXml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
  '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ...sitemapEntries.flatMap(function (entry) {
    return [
      "  <url>",
      "    <loc>" + SITE_BASE_URL + entry.loc + "</loc>",
      "    <lastmod>" + resolvedLastmods.lastmods[entry.loc] + "</lastmod>",
      "    <changefreq>" + entry.changefreq + "</changefreq>",
      "    <priority>" + entry.priority + "</priority>",
      ...(entry.es
        ? [
            '    <xhtml:link rel="alternate" hreflang="es" href="' +
              SITE_BASE_URL +
              entry.es +
              '"/>',
            '    <xhtml:link rel="alternate" hreflang="en" href="' +
              SITE_BASE_URL +
              entry.en +
              '"/>',
          ]
        : []),
      "  </url>",
    ];
  }),
  "</urlset>",
  "",
].join("\n");
const sitemapFile = path.join(DIST_SITE, "sitemap.xml");
fs.writeFileSync(sitemapFile, sitemapXml, "utf8");
say(path.relative(ROOT, sitemapFile));

// ---- CNAME (GitHub Pages custom domain) -----------------------------------

const cnameFile = path.join(DIST_SITE, "CNAME");
fs.writeFileSync(cnameFile, SITE_HOSTNAME + "\n", "utf8");
say(path.relative(ROOT, cnameFile));

// ---- .nojekyll (GitHub Pages) ----------------------------------------------

const noJekyll = path.join(DIST_SITE, ".nojekyll");
fs.writeFileSync(noJekyll, "", "utf8");
say(path.relative(ROOT, noJekyll));

// ---- Fingerprinted assets ---------------------------------
// Last step: every reference (HTML, JS, manifests, sw.js precache) is rewritten
// to content-hashed URLs, so a changed file always gets a new URL.

console.log("==> Fingerprinting assets...");
const fingerprinted = fingerprintAssets(DIST_SITE);
say(fingerprinted.size + " assets versioned");

console.log("==> Done. Site output: dist/site/");
