/* Registro de slugs por idioma. Run: node --test test/slugs.unit.js */

const test = require('node:test');
const assert = require('node:assert/strict');
const { SLUGS, pagePath, pageFile, legacyEnglishRedirects, allRedirects, lastmodRenames, redirectHtml } = require('../scripts/lib/slugs');

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
  assert.deepEqual(redirects.find((r) => r.file === 'en/circulo-de-quintas.html'), { file: 'en/circulo-de-quintas.html', to: '/en/resources/circle-of-fifths' });
  assert.equal(lastmodRenames()['/en/resources/circle-of-fifths'], '/en/circle-of-fifths');
});

test('las paginas nuevas registran es y en y no dejan redireccion', () => {
  assert.equal(pagePath('articulos', 'en'), '/en/articles');
  assert.equal(pagePath('articulo-carcassi', 'es'), '/articulos/descomposicion-de-acordes-en-carcassi');
  assert.equal(pageFile('articulo-carcassi', 'en'), 'en/articles/chord-decomposition-in-carcassi.html');
  assert.ok(!legacyEnglishRedirects().some((r) => r.file.includes('articul')));
  assert.equal(lastmodRenames()['/en/articles'], undefined);
});

test('las paginas que cambian de carpeta redirigen desde su URL anterior en cada idioma', () => {
  const redirects = allRedirects();
  const to = (file) => (redirects.find((r) => r.file === file) || {}).to;
  assert.equal(pagePath('articulo-preludios-carcassi', 'es'), '/partituras/preludios-de-carcassi');
  assert.equal(pagePath('articulo-preludios-carcassi', 'en'), '/en/sheet-music/carcassi-preludes');
  assert.equal(to('articulos/preludios-de-carcassi.html'), '/partituras/preludios-de-carcassi');
  assert.equal(to('en/articles/carcassi-preludes.html'), '/en/sheet-music/carcassi-preludes');
  assert.equal(to('pt/artigos/valsas-de-carcassi.html'), '/pt/partituras/valsas-de-carcassi');
  assert.equal(to('articulos/tablaturas-para-arpegios.html'), '/recursos/tablaturas-para-arpegios');
  assert.equal(to('circulo-de-quintas.html'), '/recursos/circulo-de-quintas');
  assert.equal(to('en/identify-chords-by-notes.html'), '/en/resources/identify-chords-by-notes');
  assert.equal(to('en/identificar-acordes-por-notas.html'), '/en/resources/identify-chords-by-notes');
  assert.equal(to('pt/criar-tablaturas-de-violao.html'), '/pt/recursos/criar-tablaturas-de-violao');
  assert.equal(to('articulos/descomposicion-de-acordes-en-carcassi.html'), undefined);
  assert.equal(lastmodRenames()['/partituras/valses-de-carcassi'], '/articulos/valses-de-carcassi');
  redirects.forEach((r) => assert.ok(!Object.values(SLUGS).some((s) => ['es', 'en', 'pt'].some((l) => (l === 'es' ? '' : l + '/') + s[l] + '.html' === r.file)), r.file + ' redirige desde una pagina vigente'));
});

test('HTML de redireccion: canonical, meta refresh y noindex', () => {
  const html = redirectHtml('https://x.test', '/en/a');
  assert.ok(html.includes('<link rel="canonical" href="https://x.test/en/a">'));
  assert.ok(html.includes('http-equiv="refresh" content="0; url=/en/a"'));
  assert.ok(html.includes('content="noindex"'));
});
