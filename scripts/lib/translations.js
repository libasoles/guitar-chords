'use strict';
/* translations.js — Que paginas existen en cada idioma (spec #59).
   es y en lo tienen todo. Los idiomas nuevos (pt) publican las herramientas desde
   el principio y los articulos de a una coleccion: una coleccion marcada como
   traducida en TRANSLATED_COLLECTIONS debe tener su cuerpo pt completo, si no el
   build falla. Una pagina sin traducir no se genera, no sale en hreflang, en el
   sitemap, en el menu ni en el indice de articulos de ese idioma. */

const { PUBLISHED_LOCALES, publishedLocales } = require('./locales');

/* Claves de slug (scripts/lib/slugs.js) de cada coleccion de articulos. */
const COLLECTIONS = {
  indice: ['articulos', 'articulo-favoritas'],
  carcassi: ['articulo-carcassi', 'articulo-preludios-carcassi', 'articulo-preludios-santisteban', 'articulo-valses-carcassi', 'articulo-piezas-progresivas-carcassi'],
  sor: ['articulo-lecciones-sor', 'articulo-estudios-sor'],
  aguado: ['articulo-partituras-aguado'],
  sagreras: ['articulo-lecciones-sagreras'],
  giuliani: ['articulo-estudios-giuliani', 'articulo-arpegios-giuliani'],
  barrios: ['articulo-partituras-barrios'],
  arpegios: ['articulo-tablaturas-arpegios'],
};

/* Colecciones con cuerpo pt publicado. Se agregan de a una (tickets 6a-6h). */
const TRANSLATED_COLLECTIONS = {
  pt: [
    'indice',
    // 'carcassi',
    // 'sor',
    // 'aguado',
    'sagreras',
    // 'giuliani',
    // 'barrios',
    // 'arpegios',
  ],
};

const ARTICLE_KEYS = new Set(Object.values(COLLECTIONS).flat());

function isTranslated(key, locale) {
  if (!ARTICLE_KEYS.has(key)) return true;
  const translated = TRANSLATED_COLLECTIONS[locale];
  if (!translated) return true;
  return translated.some((collection) => COLLECTIONS[collection].includes(key));
}

/* Idiomas (config) en los que existe la pagina `key`. */
function localesFor(key, published = PUBLISHED_LOCALES) {
  return publishedLocales(published).filter((l) => isTranslated(key, l.code));
}

module.exports = { COLLECTIONS, TRANSLATED_COLLECTIONS, isTranslated, localesFor };
