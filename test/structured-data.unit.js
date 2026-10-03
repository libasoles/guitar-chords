/* Datos estructurados (JSON-LD). Run: node --test test/structured-data.unit.js */

const test = require('node:test');
const assert = require('node:assert/strict');
const { homeJsonLd, guideJsonLd, toScriptTag, injectJsonLd } = require('../scripts/lib/structured-data');

const BASE = 'https://example.test';
const site = { baseUrl: BASE, siteName: 'Acordes', ogImage: BASE + '/assets/og-image.png' };

const es = { ...site, locale: 'es', url: BASE + '/', homeUrl: BASE + '/', name: 'Buscador de acordes', description: 'Encontra acordes' };
const en = { ...site, locale: 'en', url: BASE + '/en', homeUrl: BASE + '/en', name: 'Chord finder', description: 'Find chords' };

test('la home es una herramienta: WebApplication + WebSite con url canonica e idioma', () => {
  const graph = homeJsonLd(en)['@graph'];
  const app = graph.find((n) => n['@type'] === 'WebApplication');
  const web = graph.find((n) => n['@type'] === 'WebSite');
  assert.equal(app.url, BASE + '/en');
  assert.equal(app.inLanguage, 'en');
  assert.equal(app.name, 'Chord finder');
  assert.equal(app.applicationCategory, 'MusicApplication');
  assert.equal(web.url, BASE + '/en');
  assert.equal(web.inLanguage, 'en');
});

test('la home en espanol usa la URL raiz y el idioma es', () => {
  const app = homeJsonLd(es)['@graph'].find((n) => n['@type'] === 'WebApplication');
  assert.equal(app.url, BASE + '/');
  assert.equal(app.inLanguage, 'es');
});

test('una guia es un Article educativo con migas de pan hacia la home', () => {
  const data = guideJsonLd({ ...es, url: BASE + '/v7', name: 'V7', description: 'Guia' });
  const graph = data['@graph'];
  const article = graph.find((n) => n['@type'] === 'Article');
  const crumbs = graph.find((n) => n['@type'] === 'BreadcrumbList');
  assert.equal(article.headline, 'V7');
  assert.equal(article.inLanguage, 'es');
  assert.equal(article.mainEntityOfPage['@id'], BASE + '/v7');
  assert.equal(article.image, site.ogImage);
  assert.deepEqual(crumbs.itemListElement.map((i) => i.item), [BASE + '/', BASE + '/v7']);
  assert.deepEqual(crumbs.itemListElement.map((i) => i.position), [1, 2]);
});

test('el script escapa < para no cerrar la etiqueta y es JSON valido', () => {
  const tag = toScriptTag({ name: '</script><b>' });
  assert.ok(tag.startsWith('<script type="application/ld+json">'));
  const body = tag.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
  assert.ok(!body.includes('<'));
  assert.equal(JSON.parse(body).name, '</script><b>');
});

test('injectJsonLd inserta el script antes de </head>', () => {
  const out = injectJsonLd('<head><title>x</title></head>', { a: 1 });
  assert.match(out, /<script type="application\/ld\+json">.*<\/script>\n?\s*<\/head>/s);
});

/* Salida generada (needs `npm run build:site`). */
const fs = require('node:fs');
const path = require('node:path');
const DIST = path.join(__dirname, '..', 'dist', 'site');

function ldOf(file) {
  const html = fs.readFileSync(path.join(DIST, file), 'utf8');
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)];
  assert.equal(blocks.length, 1, file + ' debe tener un unico bloque JSON-LD');
  return {
    graph: JSON.parse(blocks[0][1])['@graph'],
    canonical: html.match(/rel="canonical" href="([^"]+)"/)[1],
    lang: html.match(/<html lang="(\w+)"/)[1],
  };
}

test('home y guias generadas emiten JSON-LD con canonica e idioma de la pagina', () => {
  const files = ['index.html', 'en.html', 'v7.html', 'en/v7-menor.html', 'acordes-mayores-y-sus-notas.html',
    'acordes-disminuidos.html', 'en/acordes-disminuidos.html', 'punteo-dorico-sexta-cuerda-al-aire.html',
    'en/punteo-locrio-sexta-cuerda-al-aire.html'];
  files.forEach((file) => {
    const { graph, canonical, lang } = ldOf(file);
    const typed = graph.filter((n) => n.url);
    assert.ok(typed.length > 0, file);
    typed.forEach((n) => assert.equal(n.url, canonical, file));
    graph.filter((n) => n.inLanguage).forEach((n) => assert.equal(n.inLanguage, lang, file));
    const kinds = graph.map((n) => n['@type']);
    assert.ok(kinds.includes(file === 'index.html' || file === 'en.html' ? 'WebApplication' : 'Article'), file);
  });
});
