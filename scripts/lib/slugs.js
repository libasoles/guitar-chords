'use strict';
const { LOCALE_CODES, localeConfig } = require('./locales');
/* slugs.js — Registro unico de slugs por idioma (ver docs/adr/0003).
   La clave de cada pagina es su slug en espanol; los demas idiomas pueden diferir.
   Toda pagina registra su slug en cada idioma de scripts/lib/locales.js (es, en, pt):
   falta uno y el build falla. Toda pagina nueva se marca `isNew: true`: no
   existia con otra URL, asi que no deja redireccion. */

const SLUGS = {
  'v7': { es: 'v7', en: 'v7', pt: 'v7' },
  'v7-menor': { es: 'v7-menor', en: 'v7-minor', pt: 'v7-menor' },
  'circulo-de-quintas': { es: 'circulo-de-quintas', en: 'circle-of-fifths', pt: 'circulo-das-quintas' },
  'acordes-mayores-y-sus-notas': { es: 'acordes-mayores-y-sus-notas', en: 'major-chords-and-their-notes', pt: 'acordes-maiores-e-suas-notas' },
  'acordes-menores-y-sus-notas': { es: 'acordes-menores-y-sus-notas', en: 'minor-chords-and-their-notes', pt: 'acordes-menores-e-suas-notas' },
  'acordes-disminuidos': { es: 'acordes-disminuidos', en: 'diminished-chords', pt: 'acordes-diminutos' },
  'identificar-acordes-por-notas': { es: 'identificar-acordes-por-notas', en: 'identify-chords-by-notes', pt: 'identificar-acordes-pelas-notas' },
  'crear-tablaturas-de-guitarra': { es: 'crear-tablaturas-de-guitarra', en: 'create-guitar-tabs', pt: 'criar-tablaturas-de-violao' },
  'ejercicio-de-sextas': { es: 'ejercicio-de-sextas', en: 'sixths-exercise', pt: 'exercicio-de-sextas' },
  'partitura-y-tablatura': { es: 'partitura-y-tablatura', en: 'sheet-music-to-tab', pt: 'partitura-e-tablatura' },
  'punteo-terceras-sextas-decimas': { es: 'punteo-terceras-sextas-decimas', en: 'picking-thirds-sixths-tenths', pt: 'dedilhado-terceiras-sextas-decimas' },
  'politica-de-privacidad': { es: 'politica-de-privacidad', en: 'privacy-policy', pt: 'politica-de-privacidade' },
  'partitura': { es: 'partitura', en: 'sheet-music-editor', pt: 'editor-de-partitura', isNew: true },
  'articulos': { es: 'articulos', en: 'articles', pt: 'artigos', isNew: true },
  'articulo-carcassi': { es: 'articulos/descomposicion-de-acordes-en-carcassi', en: 'articles/chord-decomposition-in-carcassi', pt: 'artigos/decomposicao-de-acordes-em-carcassi', isNew: true },
  'articulo-tablaturas-arpegios': { es: 'articulos/tablaturas-para-arpegios', en: 'articles/tabs-for-arpeggios', pt: 'artigos/tablaturas-para-arpejos', isNew: true },
  'articulo-preludios-santisteban': { es: 'articulos/preludios-de-carcassi-santisteban', en: 'articles/carcassi-preludes-santisteban', pt: 'artigos/preludios-de-carcassi-santisteban', isNew: true },
  'articulo-preludios-carcassi': { es: 'articulos/preludios-de-carcassi', en: 'articles/carcassi-preludes', pt: 'artigos/preludios-de-carcassi', isNew: true },
  'articulo-valses-carcassi': { es: 'articulos/valses-de-carcassi', en: 'articles/carcassi-waltzes', pt: 'artigos/valsas-de-carcassi', isNew: true },
  'articulo-piezas-progresivas-carcassi': { es: 'articulos/piezas-progresivas-de-carcassi', en: 'articles/carcassi-progressive-pieces', pt: 'artigos/pecas-progressivas-de-carcassi', isNew: true },
  'articulo-partituras-aguado': { es: 'articulos/partituras-de-aguado', en: 'articles/aguado-sheet-music', pt: 'artigos/partituras-de-aguado', isNew: true },
  'articulo-lecciones-sagreras': { es: 'articulos/primeras-lecciones-de-sagreras', en: 'articles/sagreras-first-lessons', pt: 'artigos/primeiras-licoes-de-sagreras', isNew: true },
  'articulo-lecciones-sor': { es: 'articulos/lecciones-progresivas-de-sor', en: 'articles/sor-progressive-lessons', pt: 'artigos/licoes-progressivas-de-sor', isNew: true },
  'articulo-estudios-sor': { es: 'articulos/estudios-de-sor', en: 'articles/sor-studies', pt: 'artigos/estudos-de-sor', isNew: true },
  'articulo-partituras-barrios': { es: 'articulos/partituras-de-barrios', en: 'articles/barrios-sheet-music', pt: 'artigos/partituras-de-barrios', isNew: true },
  'articulo-estudios-giuliani': { es: 'articulos/estudios-de-giuliani', en: 'articles/giuliani-studies', pt: 'artigos/estudos-de-giuliani', isNew: true },
  'articulo-arpegios-giuliani': { es: 'articulos/120-arpegios-de-giuliani', en: 'articles/giuliani-120-arpeggios', pt: 'artigos/120-arpejos-de-giuliani', isNew: true },
  'articulo-favoritas': { es: 'articulos/favoritos', en: 'articles/favorites', pt: 'artigos/favoritos', isNew: true },
};

/* Cada pagina debe tener slug en todos los idiomas. */
function assertComplete(slugs) {
  Object.keys(slugs).forEach((key) => {
    LOCALE_CODES.forEach((code) => {
      if (!slugs[key][code]) throw new Error('Slug sin registrar en ' + code + ': ' + key);
    });
  });
}
assertComplete(SLUGS);

function slugFor(key, locale) {
  const entry = SLUGS[key];
  if (!entry) throw new Error('Slug sin registrar: ' + key);
  return entry[locale];
}

/* Ruta publica de la pagina: /slug (es), /en/slug (en), /pt/slug (pt). */
function pagePath(key, locale) {
  const prefix = localeConfig(locale).prefix;
  return '/' + (prefix ? prefix + '/' : '') + slugFor(key, locale);
}

/* Archivo construido relativo a dist/site. */
function pageFile(key, locale) {
  const prefix = localeConfig(locale).prefix;
  return (prefix ? prefix + '/' : '') + slugFor(key, locale) + '.html';
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

module.exports = { SLUGS, assertComplete, slugFor, pagePath, pageFile, legacyEnglishRedirects, lastmodRenames, redirectHtml };
