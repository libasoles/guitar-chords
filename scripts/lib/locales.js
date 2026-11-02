'use strict';
/* locales.js — Lista unica de idiomas del sitio (ver docs/adr/0003 y el spec #59).
   Todo lo que depende del idioma (build, registro de slugs, hreflang, canonical,
   sitemap, selector) sale de aqui. Agregar un idioma = agregar una entrada. */

const LOCALES = [
  { code: 'es', hreflang: 'es', htmlLang: 'es', ogLocale: 'es_AR', prefix: '' },
  { code: 'en', hreflang: 'en', htmlLang: 'en', ogLocale: 'en_US', prefix: 'en' },
  { code: 'pt', hreflang: 'pt-BR', htmlLang: 'pt-BR', ogLocale: 'pt_BR', prefix: 'pt' },
];

const LOCALE_CODES = LOCALES.map((l) => l.code);
const DEFAULT_LOCALE = 'es';
/* x-default apunta a esta version. */
const X_DEFAULT_LOCALE = 'en';
/* Idiomas con paginas publicadas. Un idioma registrado pero no publicado no se
   genera ni aparece en hreflang ni en el sitemap. */
const PUBLISHED_LOCALES = ['es', 'en'];
/* Idioma de las imagenes sociales cuando el idioma no tiene las suyas. */
const OG_IMAGE_FALLBACK = { pt: 'en' };

function localeConfig(code) {
  const config = LOCALES.find((l) => l.code === code);
  if (!config) throw new Error('Idioma desconocido: ' + code);
  return config;
}

function publishedLocales(published = PUBLISHED_LOCALES) {
  return LOCALES.filter((l) => published.includes(l.code));
}

/* Idioma alterno para el boton de cambio de idioma de la cabecera (mientras no
   exista el selector de tres idiomas). */
function altLocale(code) {
  return code === 'es' ? 'en' : 'es';
}

function ogImageLocale(code) {
  return OG_IMAGE_FALLBACK[code] || code;
}

/* <link rel="alternate"> de una pagina. urlFor(code) devuelve la URL absoluta de la
   pagina en ese idioma. Incluye una por idioma publicado y x-default. */
function hreflangLinks(urlFor, published = PUBLISHED_LOCALES) {
  const links = publishedLocales(published).map(
    (l) => '<link rel="alternate" hreflang="' + l.hreflang + '" href="' + urlFor(l.code) + '" />',
  );
  links.push('<link rel="alternate" hreflang="x-default" href="' + urlFor(X_DEFAULT_LOCALE) + '" />');
  return links.join('\n    ');
}

module.exports = {
  LOCALES, LOCALE_CODES, DEFAULT_LOCALE, X_DEFAULT_LOCALE, PUBLISHED_LOCALES,
  localeConfig, publishedLocales, altLocale, ogImageLocale, hreflangLinks,
};
