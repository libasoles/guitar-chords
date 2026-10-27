'use strict';
/* slugs.js — Registro unico de slugs por idioma (ver docs/adr/0003).
   La clave de cada pagina es su slug en espanol; el ingles puede diferir.
   Toda pagina nueva registra su slug en es y en y se marca `isNew: true`: no
   existia con otra URL, asi que no deja redireccion. */

const SLUGS = {
  'v7': { es: 'v7', en: 'v7' },
  'v7-menor': { es: 'v7-menor', en: 'v7-minor' },
  'circulo-de-quintas': { es: 'circulo-de-quintas', en: 'circle-of-fifths' },
  'acordes-mayores-y-sus-notas': { es: 'acordes-mayores-y-sus-notas', en: 'major-chords-and-their-notes' },
  'acordes-menores-y-sus-notas': { es: 'acordes-menores-y-sus-notas', en: 'minor-chords-and-their-notes' },
  'acordes-disminuidos': { es: 'acordes-disminuidos', en: 'diminished-chords' },
  'identificar-acordes-por-notas': { es: 'identificar-acordes-por-notas', en: 'identify-chords-by-notes' },
  'crear-tablaturas-de-guitarra': { es: 'crear-tablaturas-de-guitarra', en: 'create-guitar-tabs' },
  'ejercicio-de-sextas': { es: 'ejercicio-de-sextas', en: 'sixths-exercise' },
  'partitura-y-tablatura': { es: 'partitura-y-tablatura', en: 'sheet-music-to-tab' },
  'punteo-terceras-sextas-decimas': { es: 'punteo-terceras-sextas-decimas', en: 'picking-thirds-sixths-tenths' },
  'politica-de-privacidad': { es: 'politica-de-privacidad', en: 'privacy-policy' },
  'partitura': { es: 'partitura', en: 'sheet-music-editor', isNew: true },
  'articulos': { es: 'articulos', en: 'articles', isNew: true },
  'articulo-carcassi': { es: 'articulos/descomposicion-de-acordes-en-carcassi', en: 'articles/chord-decomposition-in-carcassi', isNew: true },
  'articulo-tablaturas-arpegios': { es: 'articulos/tablaturas-para-arpegios', en: 'articles/tabs-for-arpeggios', isNew: true },
  'articulo-preludios-santisteban': { es: 'articulos/preludios-de-carcassi-santisteban', en: 'articles/carcassi-preludes-santisteban', isNew: true },
  'articulo-preludios-carcassi': { es: 'articulos/preludios-de-carcassi', en: 'articles/carcassi-preludes', isNew: true },
  'articulo-valses-carcassi': { es: 'articulos/valses-de-carcassi', en: 'articles/carcassi-waltzes', isNew: true },
  'articulo-piezas-progresivas-carcassi': { es: 'articulos/piezas-progresivas-de-carcassi', en: 'articles/carcassi-progressive-pieces', isNew: true },
  'articulo-partituras-aguado': { es: 'articulos/partituras-de-aguado', en: 'articles/aguado-sheet-music', isNew: true },
  'articulo-lecciones-sagreras': { es: 'articulos/primeras-lecciones-de-sagreras', en: 'articles/sagreras-first-lessons', isNew: true },
  'articulo-lecciones-sor': { es: 'articulos/lecciones-progresivas-de-sor', en: 'articles/sor-progressive-lessons', isNew: true },
  'articulo-estudios-sor': { es: 'articulos/estudios-de-sor', en: 'articles/sor-studies', isNew: true },
  'articulo-partituras-barrios': { es: 'articulos/partituras-de-barrios', en: 'articles/barrios-sheet-music', isNew: true },
  'articulo-estudios-giuliani': { es: 'articulos/estudios-de-giuliani', en: 'articles/giuliani-studies', isNew: true },
  'articulo-arpegios-giuliani': { es: 'articulos/120-arpegios-de-giuliani', en: 'articles/giuliani-120-arpeggios', isNew: true },
  'articulo-favoritas': { es: 'articulos/favoritos', en: 'articles/favorites', isNew: true },
};

function slugFor(key, locale) {
  const entry = SLUGS[key];
  if (!entry) throw new Error('Slug sin registrar: ' + key);
  return entry[locale];
}

/* Ruta publica de la pagina: /slug (es) o /en/slug (en). */
function pagePath(key, locale) {
  return (locale === 'es' ? '/' : '/en/') + slugFor(key, locale);
}

/* Archivo construido relativo a dist/site. */
function pageFile(key, locale) {
  return (locale === 'es' ? '' : 'en/') + slugFor(key, locale) + '.html';
}

function renamedKeys() {
  return Object.keys(SLUGS).filter((key) => !SLUGS[key].isNew && SLUGS[key].en !== SLUGS[key].es);
}

/* Paginas inglesas que existian con slug en espanol y hoy cambian de URL. */
function legacyEnglishRedirects() {
  return renamedKeys().map((key) => ({ file: 'en/' + SLUGS[key].es + '.html', to: pagePath(key, 'en') }));
}

/* Claves del lastmod: URL nueva -> URL vieja, para conservar la fecha. */
function lastmodRenames() {
  const renames = {};
  renamedKeys().forEach((key) => { renames[pagePath(key, 'en')] = '/en/' + SLUGS[key].es; });
  return renames;
}

function redirectHtml(baseUrl, to) {
  const url = baseUrl + to;
  return '<!doctype html>\n<html><head><meta charset="utf-8">\n' +
    '<title>Redirecting…</title>\n' +
    '<link rel="canonical" href="' + url + '">\n' +
    '<meta http-equiv="refresh" content="0; url=' + to + '">\n' +
    '<meta name="robots" content="noindex">\n' +
    '</head><body><a href="' + to + '">' + url + '</a></body></html>\n';
}

module.exports = { SLUGS, slugFor, pagePath, pageFile, legacyEnglishRedirects, lastmodRenames, redirectHtml };
