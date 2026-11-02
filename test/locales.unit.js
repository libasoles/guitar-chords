/* Lista unica de idiomas. Run: node --test test/locales.unit.js */

const test = require('node:test');
const assert = require('node:assert/strict');
const { LOCALE_CODES, hreflangLinks, publishedLocales, X_DEFAULT_LOCALE } = require('../scripts/lib/locales');
const { SLUGS, assertComplete, pagePath, pageFile } = require('../scripts/lib/slugs');

test('el orden de idiomas es es, en, pt y x-default apunta al ingles', () => {
  assert.deepEqual(LOCALE_CODES, ['es', 'en', 'pt']);
  assert.equal(X_DEFAULT_LOCALE, 'en');
});

test('hreflang: un enlace por idioma publicado, pt-BR para portugues, y x-default', () => {
  const url = (code) => 'https://x.test/' + code;
  const all = hreflangLinks(url, publishedLocales(['es', 'en', 'pt']));
  assert.ok(all.includes('hreflang="pt-BR" href="https://x.test/pt"'));
  assert.ok(all.includes('hreflang="x-default" href="https://x.test/en"'));
  const some = hreflangLinks(url, publishedLocales(['es', 'en']));
  assert.ok(!some.includes('pt-BR'));
  assert.deepEqual(publishedLocales(['es', 'pt']).map((l) => l.hreflang), ['es', 'pt-BR']);
});

test('toda pagina registrada tiene slug en todos los idiomas', () => {
  assertComplete(SLUGS);
  Object.values(SLUGS).forEach((entry) => LOCALE_CODES.forEach((code) => assert.ok(entry[code])));
});

test('registrar una pagina sin slug pt rompe el build', () => {
  assert.throws(() => assertComplete({ x: { es: 'x', en: 'x' } }), /pt: x/);
});

test('los slugs portugueses son unicos y las rutas llevan el prefijo /pt', () => {
  const pt = Object.values(SLUGS).map((s) => s.pt);
  assert.equal(new Set(pt).size, pt.length);
  assert.equal(pagePath('circulo-de-quintas', 'pt'), '/pt/circulo-das-quintas');
  assert.equal(pageFile('articulos', 'pt'), 'pt/artigos.html');
});
