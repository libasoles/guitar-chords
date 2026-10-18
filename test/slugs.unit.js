/* Registro de slugs por idioma. Run: node --test test/slugs.unit.js */

const test = require('node:test');
const assert = require('node:assert/strict');
const { SLUGS, pagePath, pageFile, legacyEnglishRedirects, lastmodRenames, redirectHtml } = require('../scripts/lib/slugs');

test('rutas y archivos por idioma', () => {
  assert.equal(pagePath('v7-menor', 'es'), '/v7-menor');
  assert.equal(pagePath('v7-menor', 'en'), '/en/v7-minor');
  assert.equal(pageFile('politica-de-privacidad', 'en'), 'en/privacy-policy.html');
  assert.equal(pageFile('politica-de-privacidad', 'es'), 'politica-de-privacidad.html');
});

test('los slugs ingleses son unicos', () => {
  const en = Object.values(SLUGS).map((s) => s.en);
  assert.equal(new Set(en).size, en.length);
});

test('redirecciones solo para paginas cuyo slug ingles cambia', () => {
  const redirects = legacyEnglishRedirects();
  const existing = Object.values(SLUGS).filter((s) => !s.isNew);
  assert.equal(redirects.length, existing.length - 1);
  assert.ok(!redirects.some((r) => r.file === 'en/v7.html'));
  assert.deepEqual(redirects.find((r) => r.file === 'en/circulo-de-quintas.html'), { file: 'en/circulo-de-quintas.html', to: '/en/circle-of-fifths' });
  assert.equal(lastmodRenames()['/en/circle-of-fifths'], '/en/circulo-de-quintas');
});

test('las paginas nuevas registran es y en y no dejan redireccion', () => {
  assert.equal(pagePath('articulos', 'en'), '/en/articles');
  assert.equal(pagePath('articulo-carcassi', 'es'), '/articulos/descomposicion-de-acordes-en-carcassi');
  assert.equal(pageFile('articulo-carcassi', 'en'), 'en/articles/chord-decomposition-in-carcassi.html');
  assert.ok(!legacyEnglishRedirects().some((r) => r.file.includes('articul')));
  assert.equal(lastmodRenames()['/en/articles'], undefined);
});

test('HTML de redireccion: canonical, meta refresh y noindex', () => {
  const html = redirectHtml('https://x.test', '/en/a');
  assert.ok(html.includes('<link rel="canonical" href="https://x.test/en/a">'));
  assert.ok(html.includes('http-equiv="refresh" content="0; url=/en/a"'));
  assert.ok(html.includes('content="noindex"'));
});
