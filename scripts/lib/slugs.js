'use strict';
const { LOCALE_CODES, localeConfig } = require('./locales');
/* slugs.js — Registro unico de slugs por idioma (ver docs/adr/0003).
   La clave de cada pagina es su slug en espanol; los demas idiomas pueden diferir.
   Toda pagina registra su slug en cada idioma de scripts/lib/locales.js (es, en, pt):
   falta uno y el build falla. Toda pagina nueva se marca `isNew: true`: no
   existia con otra URL, asi que no deja redireccion. `was` registra los slugs
   anteriores de una pagina que cambio de carpeta: la URL vieja redirige a la nueva. */

const SLUGS = {
  'v7': { es: 'v7', en: 'v7', pt: 'v7' },
  'v7-menor': { es: 'v7-menor', en: 'v7-minor', pt: 'v7-menor' },
  'circulo-de-quintas': { es: 'recursos/circulo-de-quintas', en: 'resources/circle-of-fifths', pt: 'recursos/circulo-das-quintas', was: { es: 'circulo-de-quintas', en: 'circle-of-fifths', pt: 'circulo-das-quintas' } },
  'acordes-mayores-y-sus-notas': { es: 'acordes-mayores-y-sus-notas', en: 'major-chords-and-their-notes', pt: 'acordes-maiores-e-suas-notas' },
  'acordes-menores-y-sus-notas': { es: 'acordes-menores-y-sus-notas', en: 'minor-chords-and-their-notes', pt: 'acordes-menores-e-suas-notas' },
  'acordes-disminuidos': { es: 'acordes-disminuidos', en: 'diminished-chords', pt: 'acordes-diminutos' },
  'identificar-acordes-por-notas': { es: 'recursos/identificar-acordes-por-notas', en: 'resources/identify-chords-by-notes', pt: 'recursos/identificar-acordes-pelas-notas', was: { es: 'identificar-acordes-por-notas', en: 'identify-chords-by-notes', pt: 'identificar-acordes-pelas-notas' } },
  'crear-tablaturas-de-guitarra': { es: 'recursos/crear-tablaturas-de-guitarra', en: 'resources/create-guitar-tabs', pt: 'recursos/criar-tablaturas-de-violao', was: { es: 'crear-tablaturas-de-guitarra', en: 'create-guitar-tabs', pt: 'criar-tablaturas-de-violao' } },
  'ejercicio-de-sextas': { es: 'ejercicio-de-sextas', en: 'sixths-exercise', pt: 'exercicio-de-sextas' },
  'partitura-y-tablatura': { es: 'partitura-y-tablatura', en: 'sheet-music-to-tab', pt: 'partitura-e-tablatura' },
  'punteo-terceras-sextas-decimas': { es: 'punteo-terceras-sextas-decimas', en: 'picking-thirds-sixths-tenths', pt: 'dedilhado-terceiras-sextas-decimas' },
  'politica-de-privacidad': { es: 'politica-de-privacidad', en: 'privacy-policy', pt: 'politica-de-privacidade' },
  'partitura': { es: 'partitura', en: 'sheet-music-editor', pt: 'editor-de-partitura', isNew: true },
  'articulos': { es: 'articulos', en: 'articles', pt: 'artigos', isNew: true },
  'articulo-carcassi': { es: 'articulos/descomposicion-de-acordes-en-carcassi', en: 'articles/chord-decomposition-in-carcassi', pt: 'artigos/decomposicao-de-acordes-em-carcassi', isNew: true },
  'articulo-tablaturas-arpegios': { es: 'recursos/tablaturas-para-arpegios', en: 'resources/tabs-for-arpeggios', pt: 'recursos/tablaturas-para-arpejos', isNew: true, was: { es: 'articulos/tablaturas-para-arpegios', en: 'articles/tabs-for-arpeggios', pt: 'artigos/tablaturas-para-arpejos' } },
  'articulo-preludios-santisteban': { es: 'partituras/preludios-de-carcassi-santisteban', en: 'sheet-music/carcassi-preludes-santisteban', pt: 'partituras/preludios-de-carcassi-santisteban', isNew: true, was: { es: 'articulos/preludios-de-carcassi-santisteban', en: 'articles/carcassi-preludes-santisteban', pt: 'artigos/preludios-de-carcassi-santisteban' } },
  'articulo-preludios-carcassi': { es: 'partituras/preludios-de-carcassi', en: 'sheet-music/carcassi-preludes', pt: 'partituras/preludios-de-carcassi', isNew: true, was: { es: 'articulos/preludios-de-carcassi', en: 'articles/carcassi-preludes', pt: 'artigos/preludios-de-carcassi' } },
  'articulo-valses-carcassi': { es: 'partituras/valses-de-carcassi', en: 'sheet-music/carcassi-waltzes', pt: 'partituras/valsas-de-carcassi', isNew: true, was: { es: 'articulos/valses-de-carcassi', en: 'articles/carcassi-waltzes', pt: 'artigos/valsas-de-carcassi' } },
  'articulo-piezas-progresivas-carcassi': { es: 'partituras/piezas-progresivas-de-carcassi', en: 'sheet-music/carcassi-progressive-pieces', pt: 'partituras/pecas-progressivas-de-carcassi', isNew: true, was: { es: 'articulos/piezas-progresivas-de-carcassi', en: 'articles/carcassi-progressive-pieces', pt: 'artigos/pecas-progressivas-de-carcassi' } },
  'articulo-partituras-aguado': { es: 'partituras/partituras-de-aguado', en: 'sheet-music/aguado-sheet-music', pt: 'partituras/partituras-de-aguado', isNew: true, was: { es: 'articulos/partituras-de-aguado', en: 'articles/aguado-sheet-music', pt: 'artigos/partituras-de-aguado' } },
  'articulo-lecciones-sagreras': { es: 'partituras/primeras-lecciones-de-sagreras', en: 'sheet-music/sagreras-first-lessons', pt: 'partituras/primeiras-licoes-de-sagreras', isNew: true, was: { es: 'articulos/primeras-lecciones-de-sagreras', en: 'articles/sagreras-first-lessons', pt: 'artigos/primeiras-licoes-de-sagreras' } },
  'articulo-lecciones-sor': { es: 'partituras/lecciones-progresivas-de-sor', en: 'sheet-music/sor-progressive-lessons', pt: 'partituras/licoes-progressivas-de-sor', isNew: true, was: { es: 'articulos/lecciones-progresivas-de-sor', en: 'articles/sor-progressive-lessons', pt: 'artigos/licoes-progressivas-de-sor' } },
  'articulo-estudios-sor': { es: 'partituras/estudios-de-sor', en: 'sheet-music/sor-studies', pt: 'partituras/estudos-de-sor', isNew: true, was: { es: 'articulos/estudios-de-sor', en: 'articles/sor-studies', pt: 'artigos/estudos-de-sor' } },
  'articulo-partituras-barrios': { es: 'partituras/partituras-de-barrios', en: 'sheet-music/barrios-sheet-music', pt: 'partituras/partituras-de-barrios', isNew: true, was: { es: 'articulos/partituras-de-barrios', en: 'articles/barrios-sheet-music', pt: 'artigos/partituras-de-barrios' } },
  'articulo-estudios-giuliani': { es: 'partituras/estudios-de-giuliani', en: 'sheet-music/giuliani-studies', pt: 'partituras/estudos-de-giuliani', isNew: true, was: { es: 'articulos/estudios-de-giuliani', en: 'articles/giuliani-studies', pt: 'artigos/estudos-de-giuliani' } },
  'articulo-arpegios-giuliani': { es: 'partituras/120-arpegios-de-giuliani', en: 'sheet-music/giuliani-120-arpeggios', pt: 'partituras/120-arpejos-de-giuliani', isNew: true, was: { es: 'articulos/120-arpegios-de-giuliani', en: 'articles/giuliani-120-arpeggios', pt: 'artigos/120-arpejos-de-giuliani' } },
  'articulo-favoritas': { es: 'partituras/favoritos', en: 'sheet-music/favorites', pt: 'partituras/favoritos', isNew: true, was: { es: 'articulos/favoritos', en: 'articles/favorites', pt: 'artigos/favoritos' } },
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

/* Clave del registro de la pagina construida en `file` (relativa a dist/site) del idioma
   `locale`, o null (inicio, 404, paginas fuera del registro). */
function keyForFile(file, locale) {
  return Object.keys(SLUGS).find((key) => pageFile(key, locale) === file) || null;
}

/* Slug espanol original de la pagina, antes de cualquier mudanza (`was`). */
function originalEs(key) {
  const entry = SLUGS[key];
  return entry.was ? entry.was.es : entry.es;
}

function renamedKeys() {
  return Object.keys(SLUGS).filter((key) => !SLUGS[key].isNew && SLUGS[key].en !== originalEs(key));
}

/* Paginas inglesas que existian con slug en espanol y hoy cambian de URL. */
function legacyEnglishRedirects() {
  return renamedKeys().map((key) => ({ file: 'en/' + originalEs(key) + '.html', to: pagePath(key, 'en') }));
}

/* Paginas que cambiaron de carpeta (`was` = slugs anteriores por idioma): la URL
   vieja redirige a la nueva. */
function movedRedirects() {
  return Object.keys(SLUGS).flatMap((key) => {
    const was = SLUGS[key].was;
    if (!was) return [];
    return LOCALE_CODES.filter((code) => was[code] !== SLUGS[key][code]).map((code) => {
      const prefix = localeConfig(code).prefix;
      return { file: (prefix ? prefix + '/' : '') + was[code] + '.html', to: pagePath(key, code) };
    });
  });
}

/* Todas las URLs viejas con su destino final, sin duplicados. */
function allRedirects() {
  const byFile = new Map();
  legacyEnglishRedirects().concat(movedRedirects()).forEach((redirect) => byFile.set(redirect.file, redirect));
  return [...byFile.values()];
}

/* Claves del lastmod: URL nueva -> URL vieja, para conservar la fecha. */
function lastmodRenames() {
  const renames = {};
  Object.keys(SLUGS).forEach((key) => {
    const was = SLUGS[key].was;
    if (!was) return;
    LOCALE_CODES.filter((code) => was[code] !== SLUGS[key][code]).forEach((code) => {
      const prefix = localeConfig(code).prefix;
      renames[pagePath(key, code)] = '/' + (prefix ? prefix + '/' : '') + was[code];
    });
  });
  renamedKeys().forEach((key) => {
    const url = pagePath(key, 'en');
    if (!renames[url]) renames[url] = '/en/' + originalEs(key);
  });
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

module.exports = { SLUGS, assertComplete, keyForFile, slugFor, pagePath, pageFile, legacyEnglishRedirects, allRedirects, lastmodRenames, redirectHtml };
