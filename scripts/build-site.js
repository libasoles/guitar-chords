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
const { fingerprintAssets } = require("./lib/fingerprint");
const { minifyAssets } = require("./lib/minify-assets");
const { readSiteCss, readPartituraCss } = require("./lib/site-css");
const { normalizeScoreDirections } = require("./lib/score-svg");
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
const { renderSharedTabEditor } = require("./lib/tab-editor");
const { parseAsciiTab } = require("./lib/ascii-tab");
const articleArpeggios = require("./lib/article-arpeggios");
const articleCarcassi = require("./lib/article-carcassi");
const articlePreludes = require("./lib/article-carcassi-preludes");
const articleProgressive = require("./lib/article-carcassi-progressive");
const articleAguado = require("./lib/article-aguado");
const articleSagreras = require("./lib/article-sagreras");
const articleSor = require("./lib/article-sor");
const articleSorEstudios = require("./lib/article-sor-estudios");
const articleBarrios = require("./lib/article-barrios");
const { renderArticleLinks } = require("./lib/article-link");
const {
  pagePath,
  pageFile,
  legacyEnglishRedirects,
  lastmodRenames,
  redirectHtml,
} = require("./lib/slugs");

const ROOT = path.join(__dirname, "..");
const SRC_SITE = path.join(ROOT, "src", "site");
const SRC_SHARED = path.join(ROOT, "src", "shared");
const SRC_I18N = path.join(ROOT, "src", "i18n");
const SRC_EXT = path.join(ROOT, "src", "extensions", "chords");
const SRC_VENDOR = path.join(ROOT, "vendor");
const SRC_STORE = path.join(ROOT, "store", "chords");
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
  if (path.extname(src) === ".svg") {
    fs.writeFileSync(dst, normalizeScoreDirections(fs.readFileSync(src, "utf8")));
  } else {
    fs.copyFileSync(src, dst);
  }
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
const articleTemplate = fs.readFileSync(
  path.join(SRC_SITE, "article.html"),
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
function extensionStoreUrl() {
  return (
    process.env.EXTENSION_STORE_URL ||
    "https://chromewebstore.google.com/detail/guitar-chords/chigeaalpomifocjjhgcpblcepigajme"
  );
}

function ctaButton(strings) {
  return (
    '<a class="ext-btn" href="' +
    extensionStoreUrl() +
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
  return pagePath(slug || "v7", locale);
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

// Articles section (src/site/article.html): an index and one article, found
// only through the sitemap — no link from the home page or the footer.
const ARTICLES_SLUG = "articulos";
const ARTICLE_CARCASSI_SLUG = "articulo-carcassi";
const ARTICLE_ARPEGGIOS_SLUG = "articulo-tablaturas-arpegios";
const ARTICLE_PRELUDES_SLUG = "articulo-preludios-carcassi";
const ARTICLE_SANTISTEBAN_SLUG = "articulo-preludios-santisteban";
const ARTICLE_WALTZES_SLUG = "articulo-valses-carcassi";
const ARTICLE_PROGRESSIVE_SLUG = "articulo-piezas-progresivas-carcassi";
const ARTICLE_AGUADO_SLUG = "articulo-partituras-aguado";
const ARTICLE_SAGRERAS_SLUG = "articulo-lecciones-sagreras";
const ARTICLE_SOR_SLUG = "articulo-lecciones-sor";
const ARTICLE_SOR_ESTUDIOS_SLUG = "articulo-estudios-sor";
const ARTICLE_BARRIOS_SLUG = "articulo-partituras-barrios";
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

// Reserve the extension screenshot for the home page. Other pages share
// raster previews of the existing notation + TAB examples (social crawlers
// do not reliably display SVG images).
function socialImage(url) {
  if (url === SITE_BASE_URL + homeHref("es") ||
      url === SITE_BASE_URL + homeHref("en")) {
    return SITE_BASE_URL + "/assets/og-image.png";
  }
  for (const locale of ["es", "en"]) {
    if (url === v7CanonicalUrl(locale, "circulo-de-quintas")) {
      return SITE_BASE_URL + "/assets/og-fifths-" + locale + ".png";
    }
    if (url === v7CanonicalUrl(locale, TAB_EDITOR_SLUG)) {
      return SITE_BASE_URL + "/assets/og-tab-editor.png";
    }
    if (url === v7CanonicalUrl(locale, ARTICLE_ARPEGGIOS_SLUG)) {
      return SITE_BASE_URL + "/assets/og-score-arpeggios.png";
    }
    if (url === v7CanonicalUrl(locale, NOTE_FINDER_SLUG)) {
      return SITE_BASE_URL + "/assets/og-note-finder-" + locale + ".png";
    }
  }
  const carcassi = ["es", "en"].some(function (locale) {
    return url === v7CanonicalUrl(locale, ARTICLE_CARCASSI_SLUG);
  });
  return SITE_BASE_URL + "/assets/og-score-" +
    (carcassi ? "carcassi" : "preludes") + ".png";
}

// JSON-LD options shared by the home and guide renderers; mirrors the values
// already used for canonical/hreflang/meta so structured data matches the page.
function structuredDataOpts(locale, url, name, description, homeUrl) {
  return {
    baseUrl: SITE_BASE_URL,
    siteName: "Guitar Chords",
    ogImage: socialImage(url),
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

function render(template, strings, locale, assetsPrefix, outputMode) {
  const resolvedAssetsPrefix =
    assetsPrefix || (locale === "es" ? "assets/" : "../assets/");
  const ogImage = socialImage(canonicalUrl(locale));
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
  const ogImage = socialImage();
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
  const ogImage = socialImage(v7CanonicalUrl(locale, page.slug));
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
  const ogImage = socialImage();
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
  const ogImage = socialImage(v7CanonicalUrl(locale, NOTE_FINDER_SLUG));
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
  const ogImage = socialImage(v7CanonicalUrl(locale, TAB_EDITOR_SLUG));
  let html = template;

  const simpleKeys = [
    "htmlLang",
    "wordmark",
    "wordmarkSmall",
    "altLangLabel",
    "tabDisplayOptions",
    "tabNoteNames",
    "tabLetterLabels",
  ];
  simpleKeys.forEach(function (key) {
    html = html.split("%%" + key + "%%").join(strings[key] || "");
  });

  html = html.split("%%PAGE_TITLE%%").join(strings.tabPageTitle || "");
  html = html
    .split("%%PAGE_META_DESCRIPTION%%")
    .join(strings.tabMetaDescription || "");
  html = html.split("%%PAGE_H1%%").join(strings.tabH1 || "");
  html = html.split("%%PAGE_LEAD%%").join(strings.tabLead || "");
  html = html.split("%%TAB_EDITOR%%").join(renderSharedTabEditor(strings, locale));
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
  const ogImage = socialImage();
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
function fillPageChrome(html, strings, locale, slug, ogImage) {
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
    .join(ogImage || socialImage(v7CanonicalUrl(locale, slug)))
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

// The score modal (popover.modal-full) is mirrored in the URL hash (#<modal id>), so a reload or a shared link
// reopens it. Only on desktop: on mobile the cards download the PDF instead of opening the modal.
const MODAL_HASH_SCRIPT =
  "<script>(function(){" +
  'var modals=document.querySelectorAll(".modal-full");' +
  'var desktop=window.matchMedia("(min-width: 48.01rem)");' +
  "function sync(id){try{history.replaceState(null,''," +
  "id?'#'+id:location.pathname+location.search);}catch(e){}}" +
  // The prev/next chevrons live inside the open modal: close it so the target replaces it instead of nesting.
  "document.querySelectorAll('.modal-step[popovertarget]').forEach(function(b){b.addEventListener('click',function(){" +
  "var m=b.closest('.modal-full');if(m)m.hidePopover();});});" +
  "modals.forEach(function(m){m.addEventListener('toggle',function(e){" +
  "if(e.newState==='open')sync(m.id);else if(location.hash==='#'+m.id)sync('');});});" +
  "var target=location.hash&&document.getElementById(location.hash.slice(1));" +
  "if(target&&target.classList.contains('modal-full')&&desktop.matches){" +
  "try{target.showPopover();}catch(e){}}" +
  "})();</script>";

// Render a page of the articles section. These pages live one level deeper
// (/articulos/x, /en/articles/x), so they load assets from the domain root.
function renderArticlePage(strings, locale, slug, keys, bodyHtml, backHtml, headingActions = "") {
  let html = articleTemplate
    .split("%%ASSETS_PREFIX%%")
    .join("/assets/")
    .split("%%MANIFEST_HREF%%")
    .join("/assets/manifest." + locale + ".webmanifest");
  html = fillPageChrome(html, strings, locale, slug);
  html = html
    .split("%%PAGE_TITLE%%")
    .join(strings[keys.title])
    .split("%%PAGE_META_DESCRIPTION%%")
    .join(strings[keys.meta])
    .split("%%PAGE_H1%%")
    .join(strings[keys.h1])
    .split("%%PAGE_H1_ACTIONS%%")
    .join(headingActions)
    .split("%%PAGE_LEAD%%")
    .join(strings[keys.lead])
    .split("%%ARTICLE_BACK%%")
    .join(backHtml)
    .split("%%ARTICLE_BODY%%")
    .join(renderArticleLinks(bodyHtml) + (bodyHtml.indexOf("modal-full") === -1 ? "" : MODAL_HASH_SCRIPT));
  return withGuideJsonLd(html, strings, locale, slug, keys.title, keys.meta);
}

function articleCard(slug, locale, image, size, title, summary) {
  return (
    '<a class="article-card" href="' +
    pagePath(slug, locale) +
    '"><img class="article-card-image" src="' +
    image +
    '" alt="" width="' +
    size[0] +
    '" height="' +
    size[1] +
    '" loading="lazy"><h2>' +
    escapeHtml(title) +
    "</h2><p>" +
    escapeHtml(summary) +
    "</p></a>"
  );
}

function renderArticlesIndex(strings, locale) {
  const card =
    articleCard(
      ARTICLE_CARCASSI_SLUG,
      locale,
      articleCarcassi.cardImage().url,
      [539, 192],
      strings.artCarcH1,
      strings.artCarcCardSummary,
    ) +
    articleCard(
      ARTICLE_PRELUDES_SLUG,
      locale,
      articlePreludes.cardImage().url,
      [684, 204],
      strings.artPreludesH1,
      strings.artPreludesCardSummary,
    ) +
    articleCard(
      ARTICLE_ARPEGGIOS_SLUG,
      locale,
      articleArpeggios.cardImage().url,
      [684, 240],
      strings.artArpeggiosH1,
      strings.artArpeggiosIntro,
    ) +
    articleCard(ARTICLE_SANTISTEBAN_SLUG, locale, articlePreludes.santisteban.cardImage().url, [684, 204], strings.artSantistebanH1, strings.artSantistebanCardSummary) +
    articleCard(ARTICLE_WALTZES_SLUG, locale, articlePreludes.waltzes.cardImage().url, [684, 204], strings.artWaltzesH1, strings.artWaltzesCardSummary) +
    articleCard(ARTICLE_PROGRESSIVE_SLUG, locale, articleProgressive.cardImage().url, articleProgressive.cardImage().size, strings.artProgressiveH1, strings.artProgressiveCardSummary) +
    articleCard(ARTICLE_AGUADO_SLUG, locale, articleAguado.cardImage().url, articleAguado.cardImage().size, strings.artAguadoH1, strings.artAguadoCardSummary) +
    articleCard(ARTICLE_SAGRERAS_SLUG, locale, articleSagreras.cardImage().url, articleSagreras.cardImage().size, strings.artSagrerasH1, strings.artSagrerasCardSummary) +
    articleCard(ARTICLE_SOR_SLUG, locale, articleSor.cardImage().url, articleSor.cardImage().size, strings.artSorH1, strings.artSorCardSummary) +
    articleCard(ARTICLE_SOR_ESTUDIOS_SLUG, locale, articleSorEstudios.cardImage().url, articleSorEstudios.cardImage().size, strings.artSorEstudiosH1, strings.artSorEstudiosCardSummary) +
    articleCard(ARTICLE_BARRIOS_SLUG, locale, articleBarrios.cardImage().url, articleBarrios.cardImage().size, strings.artBarriosH1, strings.artBarriosCardSummary);
  return renderArticlePage(
    strings,
    locale,
    ARTICLES_SLUG,
    {
      title: "artIndexPageTitle",
      meta: "artIndexMetaDescription",
      h1: "artIndexH1",
      lead: "artIndexLead",
    },
    card,
    "",
  );
}

function renderCarcassiArticle(strings, locale) {
  const back =
    '<p class="article-back"><a href="' +
    pagePath(ARTICLES_SLUG, locale) +
    '">' +
    escapeHtml(strings.artBackToIndex) +
    "</a></p>";
  return renderArticlePage(
    strings,
    locale,
    ARTICLE_CARCASSI_SLUG,
    {
      title: "artCarcPageTitle",
      meta: "artCarcMetaDescription",
      h1: "artCarcH1",
      lead: "artCarcLead",
    },
    articleCarcassi.renderBody(locale, strings),
    back,
  );
}

function renderArpeggiosArticle(strings, locale) {
  const back = '<p class="article-back"><a href="' + pagePath(ARTICLES_SLUG, locale) + '">' +
    escapeHtml(strings.artBackToIndex) + '</a></p>';
  return renderArticlePage(strings, locale, ARTICLE_ARPEGGIOS_SLUG, {
    title: "artArpeggiosPageTitle",
    meta: "artArpeggiosMetaDescription",
    h1: "artArpeggiosH1",
    lead: "artArpeggiosLead",
  }, articleArpeggios.renderBody(locale, strings), back, articleArpeggios.searchControl(strings))
    .split("%%CARCASSI_HREF%%").join(pagePath(ARTICLE_CARCASSI_SLUG, locale))
    .split("%%DIM_HREF%%").join(v7PageHref(locale, DIM_SLUG));
}

function renderWaltzesArticle(strings, locale) {
  const back =
    '<p class="article-back"><a href="' +
    pagePath(ARTICLES_SLUG, locale) +
    '">' +
    escapeHtml(strings.artBackToIndex) +
    "</a></p>";
  return renderArticlePage(
    strings,
    locale,
    ARTICLE_WALTZES_SLUG,
    { title: "artWaltzesPageTitle", meta: "artWaltzesMetaDescription", h1: "artWaltzesH1", lead: "artWaltzesLead" },
    articlePreludes.waltzes.renderBody(locale, strings),
    back,
  );
}

function renderPreludesArticle(strings, locale, santisteban = false) {
  const edition = santisteban ? articlePreludes.santisteban : articlePreludes;
  const prefix = santisteban ? "artSantisteban" : "artPreludes";
  const other = santisteban ? ARTICLE_PRELUDES_SLUG : ARTICLE_SANTISTEBAN_SLUG;
  const otherLabel = santisteban ? strings.artPreludesOriginalLink : strings.artPreludesSantistebanLink;
  const crossLink = '<p class="article-back"><a href="' + pagePath(other, locale) + '">' + escapeHtml(otherLabel) + '</a></p>';
  const back =
    '<p class="article-back"><a href="' +
    pagePath(ARTICLES_SLUG, locale) +
    '">' +
    escapeHtml(strings.artBackToIndex) +
    "</a></p>";
  return renderArticlePage(
    strings,
    locale,
    santisteban ? ARTICLE_SANTISTEBAN_SLUG : ARTICLE_PRELUDES_SLUG,
    {
      title: prefix + "PageTitle",
      meta: prefix + "MetaDescription",
      h1: prefix + "H1",
      lead: prefix + "Lead",
    },
    edition.renderBody(locale, strings) + crossLink,
    back,
  );
}

function renderProgressiveArticle(strings, locale) {
  const back =
    '<p class="article-back"><a href="' +
    pagePath(ARTICLES_SLUG, locale) +
    '">' +
    escapeHtml(strings.artBackToIndex) +
    "</a></p>";
  return renderArticlePage(
    strings,
    locale,
    ARTICLE_PROGRESSIVE_SLUG,
    {
      title: "artProgressivePageTitle",
      meta: "artProgressiveMetaDescription",
      h1: "artProgressiveH1",
      lead: "artProgressiveLead",
    },
    articleProgressive.renderBody(locale, strings),
    back,
  ).split("%%PRELUDES_HREF%%").join(pagePath(ARTICLE_PRELUDES_SLUG, locale))
    .split("%%WALTZES_HREF%%").join(pagePath(ARTICLE_WALTZES_SLUG, locale));
}

function renderAguadoArticle(strings, locale) {
  const back =
    '<p class="article-back"><a href="' +
    pagePath(ARTICLES_SLUG, locale) +
    '">' +
    escapeHtml(strings.artBackToIndex) +
    "</a></p>";
  return renderArticlePage(
    strings,
    locale,
    ARTICLE_AGUADO_SLUG,
    {
      title: "artAguadoPageTitle",
      meta: "artAguadoMetaDescription",
      h1: "artAguadoH1",
      lead: "artAguadoLead",
    },
    articleAguado.renderBody(locale, strings),
    back,
  );
}

function renderSagrerasArticle(strings, locale) {
  const back =
    '<p class="article-back"><a href="' +
    pagePath(ARTICLES_SLUG, locale) +
    '">' +
    escapeHtml(strings.artBackToIndex) +
    "</a></p>";
  return renderArticlePage(
    strings,
    locale,
    ARTICLE_SAGRERAS_SLUG,
    {
      title: "artSagrerasPageTitle",
      meta: "artSagrerasMetaDescription",
      h1: "artSagrerasH1",
      lead: "artSagrerasLead",
    },
    articleSagreras.renderBody(locale, strings),
    back,
  );
}

function renderSorArticle(strings, locale) {
  const back =
    '<p class="article-back"><a href="' +
    pagePath(ARTICLES_SLUG, locale) +
    '">' +
    escapeHtml(strings.artBackToIndex) +
    "</a></p>";
  return renderArticlePage(
    strings,
    locale,
    ARTICLE_SOR_SLUG,
    {
      title: "artSorPageTitle",
      meta: "artSorMetaDescription",
      h1: "artSorH1",
      lead: "artSorLead",
    },
    articleSor.renderBody(locale, strings),
    back,
  );
}

function renderSorEstudiosArticle(strings, locale) {
  const back =
    '<p class="article-back"><a href="' +
    pagePath(ARTICLES_SLUG, locale) +
    '">' +
    escapeHtml(strings.artBackToIndex) +
    "</a></p>";
  return renderArticlePage(
    strings,
    locale,
    ARTICLE_SOR_ESTUDIOS_SLUG,
    {
      title: "artSorEstudiosPageTitle",
      meta: "artSorEstudiosMetaDescription",
      h1: "artSorEstudiosH1",
      lead: "artSorEstudiosLead",
    },
    articleSorEstudios.renderBody(locale, strings),
    back,
  );
}

function renderBarriosArticle(strings, locale) {
  const back =
    '<p class="article-back"><a href="' +
    pagePath(ARTICLES_SLUG, locale) +
    '">' +
    escapeHtml(strings.artBackToIndex) +
    "</a></p>";
  return renderArticlePage(
    strings,
    locale,
    ARTICLE_BARRIOS_SLUG,
    {
      title: "artBarriosPageTitle",
      meta: "artBarriosMetaDescription",
      h1: "artBarriosH1",
      lead: "artBarriosLead",
    },
    articleBarrios.renderBody(locale, strings),
    back,
  );
}

function writeArticlePages(strings, locale) {
  [
    [ARTICLES_SLUG, renderArticlesIndex],
    [ARTICLE_CARCASSI_SLUG, renderCarcassiArticle],
    [ARTICLE_PRELUDES_SLUG, renderPreludesArticle],
    [ARTICLE_SANTISTEBAN_SLUG, (strings, locale) => renderPreludesArticle(strings, locale, true)],
    [ARTICLE_WALTZES_SLUG, renderWaltzesArticle],
    [ARTICLE_PROGRESSIVE_SLUG, renderProgressiveArticle],
    [ARTICLE_AGUADO_SLUG, renderAguadoArticle],
    [ARTICLE_SAGRERAS_SLUG, renderSagrerasArticle],
    [ARTICLE_SOR_SLUG, renderSorArticle],
    [ARTICLE_SOR_ESTUDIOS_SLUG, renderSorEstudiosArticle],
    [ARTICLE_BARRIOS_SLUG, renderBarriosArticle],
    [ARTICLE_ARPEGGIOS_SLUG, renderArpeggiosArticle],
  ].forEach(function (entry) {
    const outFile = path.join(DIST_SITE, pageFile(entry[0], locale));
    ensureDir(path.dirname(outFile));
    fs.writeFileSync(outFile, entry[1](strings, locale), "utf8");
    say(path.relative(ROOT, outFile));
  });
}

// Render the Partitura y tablatura tool page (src/site/partitura.html). The
// client script reads window.PARTITURA_CONFIG: API base URL, Turnstile site
// key and every part* and toast* string for the locale.
function renderPartituraPage(template, strings, locale) {
  const i18n = {};
  Object.keys(strings).forEach(function (key) {
    if (key.indexOf("part") === 0 || key.indexOf("toast") === 0) i18n[key] = strings[key];
  });
  const config = {
    apiUrl: PARTITURA_API_URL,
    turnstileSiteKey: TURNSTILE_SITE_KEY,
    locale: locale,
    example: JSON.parse(fs.readFileSync(path.join(SRC_SITE, "partitura-example.json"), "utf8")),
    privacyHref: v7PageHref(locale, PRIVACY_SLUG),
    strings: i18n,
  };
  // Link previews (og:/twitter:) reuse the home banner: its image, kicker-less
  // title and description, rendered by scripts/og-partitura.js.
  let html = fillPageChrome(
    template,
    strings,
    locale,
    PARTITURA_SLUG,
    SITE_BASE_URL + "/assets/og-partitura-" + locale + ".png",
  );
  [
    "partPromoAlt",
    "partHowH2",
    "partHow1Title",
    "partHow1Body",
    "partHow2Title",
    "partHow2Body",
    "partHow2Learn",
    "partHow3Title",
    "partFaqH2",
    "partFaq1Q",
    "partFaq1A",
    "partFaq2Q",
    "partFaq2A",
    "partFaq3Q",
    "partFaq3A",
    "partFaq4Q",
    "partFaq4A",
    "partRightsLabel",
    "partFileLabel",
    "partDropTitle",
    "partExampleTitle",
    "partExampleCaption",
    "partExampleAlt",
    "partTuningLabel",
    "partTuningAuto",
    "partTuningStandard",
    "partTuningDropD",
    "partSubmit",
    "partDurationHint",
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
    .split("%%OG_TITLE%%")
    .join(escapeHtml(strings.partPromoTitle || ""))
    .split("%%OG_DESCRIPTION%%")
    .join(escapeHtml(strings.partPromoDescription || ""))
    .split("%%ogLocale%%")
    .join(locale === "es" ? "es_AR" : "en_US")
    .split("%%PRIVACY_HREF%%")
    .join(v7PageHref(locale, PRIVACY_SLUG))
    .split("%%TAB_EDITOR_PAGE_HREF%%")
    .join(v7PageHref(locale, TAB_EDITOR_SLUG))
    .split("%%PARTITURA_CONFIG%%")
    .join(JSON.stringify(config).replace(/</g, "\\u003c"));
  const faq = [1, 2, 3, 4].map(function (n) {
    return { q: strings["partFaq" + n + "Q"], a: strings["partFaq" + n + "A"] };
  });
  const opts = structuredDataOpts(
    locale,
    v7CanonicalUrl(locale, PARTITURA_SLUG),
    strings.partPageTitle || "",
    strings.partMetaDescription || "",
  );
  opts.ogImage = SITE_BASE_URL + "/assets/og-partitura-" + locale + ".png";
  opts.faq = faq;
  return injectJsonLd(html, toolJsonLd(opts));
}

// Render the intervals lesson page (src/site/picking-intervals.html) for one
// locale. Fretboard diagrams are computed client-side by
// src/site/picking-render.js; no client-side data script.
function renderPickingPage(template, strings, locale, page) {
  const resolvedAssetsPrefix = locale === "es" ? "assets/" : "../assets/";
  const ogImage = socialImage();
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
  // Pages serves this document at the missing URL, potentially nested.
  const resolvedAssetsPrefix = "/assets/";
  const ogImage = socialImage();
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
  "chord-card.js",
  "chord-positions.js",
  "chord-search.js",
  "note-names.js",
  "note-match.js",
  "tab-editor.js",
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
fs.writeFileSync(path.join(ASSETS_DIST, "site.css"), readSiteCss(), "utf8");
copyFile(
  path.join(SRC_SITE, "picking-render.js"),
  path.join(ASSETS_DIST, "picking-render.js"),
);
copyFile(
  path.join(SRC_SITE, "guitar-player-cubist-left-head.svg"),
  path.join(ASSETS_DIST, "guitar-player-cubist-left-head.svg"),
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
  require("esbuild").buildSync({
    entryPoints: [path.join(SRC_SITE, "toast.js")],
    outfile: path.join(ASSETS_DIST, "toast.js"),
    bundle: true,
    minify: true,
    format: "iife",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  copyFile(
    path.join(SRC_SITE, "partitura.js"),
    path.join(ASSETS_DIST, "partitura.js"),
  );
  // The tool page loads only the styles it uses, not the whole site.css.
  fs.writeFileSync(
    path.join(ASSETS_DIST, "partitura.css"),
    readPartituraCss(),
    "utf8",
  );
  copyFile(
    path.join(SRC_SITE, "partitura-loading.svg"),
    path.join(ASSETS_DIST, "partitura-loading.svg"),
  );
  copyFile(
    path.join(SRC_SITE, "partitura-banner.webp"),
    path.join(ASSETS_DIST, "partitura-banner.webp"),
  );
  ["es", "en"].forEach(function (loc) {
    copyFile(
      path.join(SRC_SITE, "og-partitura-" + loc + ".png"),
      path.join(ASSETS_DIST, "og-partitura-" + loc + ".png"),
    );
  });
}
// Raster score previews used by article and guide link cards.
["carcassi", "preludes", "arpeggios"].forEach(function (name) {
  copyFile(
    path.join(SRC_SITE, "og-score-" + name + ".png"),
    path.join(ASSETS_DIST, "og-score-" + name + ".png"),
  );
});
["og-tab-editor.png", "og-note-finder-es.png", "og-note-finder-en.png",
  "og-fifths-es.png", "og-fifths-en.png"].forEach(function (name) {
  copyFile(path.join(SRC_SITE, name), path.join(ASSETS_DIST, name));
});
// OG image (optional — skip silently if not present yet).
const ogImageSrc = path.join(SRC_SITE, "og-image.png");
if (fs.existsSync(ogImageSrc)) {
  copyFile(ogImageSrc, path.join(ASSETS_DIST, "og-image.png"));
} else {
  say("(src/site/og-image.png not found — og:image will 404 until added)");
}
// Score PDFs the article examples download.
const articlePdfDist = path.join(ASSETS_DIST, "articles", "carcassi");
ensureDir(articlePdfDist);
articleCarcassi.pdfFiles().forEach(function (pdf) {
  copyFile(pdf.src, path.join(articlePdfDist, pdf.name));
});
copyFile(
  articleCarcassi.cardImage().src,
  path.join(articlePdfDist, articleCarcassi.cardImage().name),
);
// Independent score downloads and modal pages for each edition.
[articlePreludes, articlePreludes.santisteban, articlePreludes.waltzes, articleProgressive, articleAguado, articleSagreras, articleSor, articleSorEstudios, articleBarrios].forEach(function (edition) {
  const folder = path.basename(edition.PREVIEW_DIR);
  const target = path.join(ASSETS_DIST, "articles", folder);
  ensureDir(path.join(target, "full"));
  edition.pdfFiles().forEach((pdf) => copyFile(pdf.src, path.join(target, pdf.name)));
  const image = edition.cardImage();
  copyFile(image.src, path.join(target, image.name));
  edition.pageSvgFiles().forEach((page) => copyFile(page.src, path.join(target, "full", page.name)));
});
const arpeggiosDist = path.join(ASSETS_DIST, "articles", "arpeggios");
ensureDir(arpeggiosDist);
copyFile(articleArpeggios.cardImage().src, path.join(arpeggiosDist, articleArpeggios.cardImage().name));
// Store-facing static pages.
const storeDist = path.join(DIST_SITE, "store");
ensureDir(storeDist);
copyFile(
  path.join(SRC_STORE, "privacy-policy.html"),
  path.join(storeDist, "privacy-policy.html"),
);

// ---- PWA: icons ------------------------------------------------------------
// Use the committed logo renders on every machine, including deployment
// runners without rsvg-convert. Regenerate with node scripts/generate-pwa-icons.js.
console.log("==> Copying PWA icons...");
const ICONS_DIST = path.join(ASSETS_DIST, "icons");
ensureDir(ICONS_DIST);
[192, 512].forEach(function (size) {
  const file = "icon-" + size + ".png";
  copyFile(path.join(SRC_SITE, "icons", file), path.join(ICONS_DIST, file));
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
  "/assets/tab-editor.js",
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

    writeArticlePages(strings, locale);

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
    const v7OutFile = path.join(DIST_SITE, pageFile(page.slug, "en"));
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
    const circleOutFile = path.join(DIST_SITE, pageFile(page.slug, "en"));
    fs.writeFileSync(circleOutFile, circleHtml, "utf8");
    say(path.relative(ROOT, circleOutFile));
  });

  {
    const dimHtml = renderDimPage(dimTemplate, strings, locale);
    const dimOutFile = path.join(DIST_SITE, pageFile(DIM_SLUG, "en"));
    fs.writeFileSync(dimOutFile, dimHtml, "utf8");
    say(path.relative(ROOT, dimOutFile));
  }

  {
    const noteFinderHtml = renderNoteFinderPage(
      noteFinderTemplate,
      strings,
      locale,
    );
    const noteFinderOutFile = path.join(DIST_SITE, pageFile(NOTE_FINDER_SLUG, "en"));
    fs.writeFileSync(noteFinderOutFile, noteFinderHtml, "utf8");
    say(path.relative(ROOT, noteFinderOutFile));
  }

  {
    const tabEditorHtml = renderTabEditorPage(
      tabEditorTemplate,
      strings,
      locale,
    );
    const tabEditorOutFile = path.join(DIST_SITE, pageFile(TAB_EDITOR_SLUG, "en"));
    fs.writeFileSync(tabEditorOutFile, tabEditorHtml, "utf8");
    say(path.relative(ROOT, tabEditorOutFile));
  }

  {
    const sixthsHtml = renderSixthsPage(sixthsTemplate, strings, locale);
    const sixthsOutFile = path.join(DIST_SITE, pageFile(SIXTHS_SLUG, "en"));
    fs.writeFileSync(sixthsOutFile, sixthsHtml, "utf8");
    say(path.relative(ROOT, sixthsOutFile));
  }

  {
    const privacyOutFile = path.join(DIST_SITE, pageFile(PRIVACY_SLUG, "en"));
    fs.writeFileSync(
      privacyOutFile,
      renderPrivacyPage(privacyTemplate, strings, locale),
      "utf8",
    );
    say(path.relative(ROOT, privacyOutFile));
  }

  writeArticlePages(strings, locale);

  if (PARTITURA_ENABLED) {
    const partOutFile = path.join(DIST_SITE, pageFile(PARTITURA_SLUG, "en"));
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
    const pickingOutFile = path.join(DIST_SITE, pageFile(page.slug, "en"));
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

// ---- Hamburger menu in the header of every page ----------------------------
// Replaces the old EN/ES toggle. Runs on the built HTML, like the privacy
// link below, so every template only carries the <!--SITE_MENU--> marker.

const SITE_MENU_SCRIPT =
  "<script>(function(){var m=document.currentScript.previousElementSibling;" +
  "function c(){m.removeAttribute('open')}" +
  "document.addEventListener('click',function(e){if(!m.contains(e.target))c()});" +
  "document.addEventListener('keydown',function(e){if(e.key==='Escape')c()});" +
  "})()</script>";

function siteMenu(strings, locale) {
  const link = function (href, label) {
    const externalLabel =
      label + " — " + (locale === "en" ? "Open in a new tab" : "Abrir en otra pestaña");
    return '<div class="site-menu-row"><a href="' + href + '">' + escapeHtml(label) +
      '</a><a class="site-menu-external" href="' + href +
      '" target="_blank" rel="noopener" aria-label="' + escapeHtml(externalLabel) +
      '" title="' + escapeHtml(externalLabel) +
      '"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M21 14v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></svg></a></div>';
  };
  const items = [
    link(homeHref(locale), strings.menuChordFinder),
    link(pagePath(TAB_EDITOR_SLUG, locale), strings.menuCreateTabs),
    link(pagePath("identificar-acordes-por-notas", locale), strings.menuIdentifyChords),
  ];
  if (PARTITURA_ENABLED)
    items.push(link(pagePath(PARTITURA_SLUG, locale), strings.menuAddTabs));
  items.push(link(pagePath("circulo-de-quintas", locale), strings.menuFifths));
  items.push(link(pagePath(ARTICLE_ARPEGGIOS_SLUG, locale), strings.artArpeggiosH1));
  const articles = [
    [ARTICLE_CARCASSI_SLUG, strings.artCarcH1],
    [ARTICLE_PRELUDES_SLUG, strings.artPreludesH1],
    [ARTICLE_SANTISTEBAN_SLUG, strings.artSantistebanH1],
    [ARTICLE_WALTZES_SLUG, strings.artWaltzesH1],
    [ARTICLE_PROGRESSIVE_SLUG, strings.artProgressiveH1],
    [ARTICLE_AGUADO_SLUG, strings.artAguadoH1],
    [ARTICLE_SAGRERAS_SLUG, strings.artSagrerasH1],
    [ARTICLE_SOR_SLUG, strings.artSorH1],
    [ARTICLE_SOR_ESTUDIOS_SLUG, strings.artSorEstudiosH1],
    [ARTICLE_BARRIOS_SLUG, strings.artBarriosH1],
  ];
  return (
    '<details class="site-menu"><summary aria-label="' +
    escapeHtml(strings.menuButtonLabel) +
    '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg></summary>' +
    '<nav class="site-menu-panel" aria-label="' +
    escapeHtml(strings.menuButtonLabel) +
    '">' +
    '<div class="site-menu-col"><p class="site-menu-heading">' +
    escapeHtml(strings.menuResources) +
    "</p>" +
    items.join("") +
    '</div><div class="site-menu-col"><p class="site-menu-heading">' +
    escapeHtml(strings.menuArticles) +
    "</p>" +
    articles
      .map(function (a) {
        return link(pagePath(a[0], locale), a[1]);
      })
      .join("") +
    '</div><div class="site-menu-wide"><p class="site-menu-heading">' +
    escapeHtml(strings.menuExtensions) +
    "</p>" +
    '<a class="site-menu-ext" href="' +
    extensionStoreUrl() +
    '" target="_blank" rel="noopener"><span><strong>' +
    escapeHtml(strings.menuChordFinder) +
    "</strong><small>" +
    escapeHtml(strings.extensionDescription) +
    '</small></span><img src="/assets/guitar-player-cubist-left-head.svg" alt="" width="48" height="48"></a></div></nav></details>' +
    SITE_MENU_SCRIPT
  );
}

console.log("==> Adding the hamburger menu to every page...");
{
  const menuStrings = {};
  LOCALES.forEach(function (locale) {
    menuStrings[locale] = JSON.parse(
      fs.readFileSync(path.join(SRC_I18N, "strings." + locale + ".json"), "utf8"),
    );
  });
  const addSiteMenu = function (dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "assets" || entry.name === "store") return;
        addSiteMenu(full);
        return;
      }
      if (!entry.name.endsWith(".html")) return;
      const rel = path.relative(DIST_SITE, full).split(path.sep).join("/");
      const locale = rel === "en.html" || rel.indexOf("en/") === 0 ? "en" : "es";
      const html = fs.readFileSync(full, "utf8");
      if (html.indexOf("<!--SITE_MENU-->") === -1) return;
      fs.writeFileSync(
        full,
        html.split("<!--SITE_MENU-->").join(siteMenu(menuStrings[locale], locale)),
        "utf8",
      );
    });
  };
  addSiteMenu(DIST_SITE);
}

// ---- Privacy policy link at the bottom of every page -------------------------
// Runs on the built HTML so every page, including pages without a footer,
// links to the policy in its own language.

console.log("==> Linking the privacy policy at the bottom of every page...");
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
    const href = pagePath(PRIVACY_SLUG, isEn ? "en" : "es");
    let html = fs.readFileSync(full, "utf8");
    if (html.indexOf('class="privacy-link"') !== -1) return;
    const link =
      '<p class="privacy-link"><a href="' + href + '">' + label + "</a></p>";
    const bodyEnd = html.lastIndexOf("</body>");
    if (bodyEnd === -1) return;
    html = html.slice(0, bodyEnd) + link + "\n  " + html.slice(bodyEnd);
    fs.writeFileSync(full, html, "utf8");
  });
}
addPrivacyLinks(DIST_SITE);

// ---- Redirects for the old English URLs (Spanish slugs under /en/) ---------
// GitHub Pages has no server redirects: minimal HTML with canonical, meta
// refresh and noindex. Not in the sitemap. See docs/adr/0003.

console.log("==> Writing redirects for the old English URLs...");
legacyEnglishRedirects().forEach(function (redirect) {
  // The old Partitura URL never existed unless the tool is published.
  if (!PARTITURA_ENABLED && redirect.file === "en/" + PARTITURA_SLUG + ".html")
    return;
  const redirectFile = path.join(DIST_SITE, redirect.file);
  fs.writeFileSync(redirectFile, redirectHtml(SITE_BASE_URL, redirect.to), "utf8");
  say(path.relative(ROOT, redirectFile));
});

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
// Pages are keyed by their registered slug (scripts/lib/slugs.js).
function addSlugPages(slugs, priorities) {
  slugs.forEach(function (slug) {
    addBilingual(
      pagePath(slug, "es"),
      pageFile(slug, "es"),
      pagePath(slug, "en"),
      pageFile(slug, "en"),
      priorities || ["0.5", "0.4"],
    );
  });
}
addSlugPages(["v7"], ["0.6", "0.5"]);
addSlugPages(["v7-menor"]);
addSlugPages(
  CIRCLE_PAGES.map(function (page) {
    return page.slug;
  }),
);
addSlugPages([DIM_SLUG, NOTE_FINDER_SLUG, SIXTHS_SLUG]);
addSlugPages([TAB_EDITOR_SLUG], ["0.7", "0.6"]);
addSlugPages([PRIVACY_SLUG], ["0.3", "0.3"]);
addSlugPages([ARTICLES_SLUG, ARTICLE_CARCASSI_SLUG, ARTICLE_PRELUDES_SLUG, ARTICLE_SANTISTEBAN_SLUG, ARTICLE_WALTZES_SLUG, ARTICLE_PROGRESSIVE_SLUG, ARTICLE_AGUADO_SLUG, ARTICLE_SAGRERAS_SLUG, ARTICLE_SOR_SLUG, ARTICLE_SOR_ESTUDIOS_SLUG, ARTICLE_BARRIOS_SLUG, ARTICLE_ARPEGGIOS_SLUG]);
if (PARTITURA_ENABLED) addSlugPages([PARTITURA_SLUG], ["0.7", "0.6"]);
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
  lastmodRenames(),
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

console.log("==> Minifying assets...");
const minified = minifyAssets(ASSETS_DIST);
say(
  minified.files +
    " files, " +
    Math.round(minified.before / 1024) +
    " KiB -> " +
    Math.round(minified.after / 1024) +
    " KiB",
);

console.log("==> Fingerprinting assets...");
const fingerprinted = fingerprintAssets(DIST_SITE);
say(fingerprinted.size + " assets versioned");

console.log("==> Done. Site output: dist/site/");
