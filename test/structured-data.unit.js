/* Datos estructurados (JSON-LD). Run: node --test test/structured-data.unit.js */

const test = require('node:test');
const assert = require('node:assert/strict');
const { homeJsonLd, guideJsonLd, toolJsonLd, toScriptTag, injectJsonLd } = require('../scripts/lib/structured-data');

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

test('las vistas previas usan la imagen de cada pagina y reservan la extension para el inicio', () => {
  const { pagePath } = require('../scripts/lib/slugs');
  for (const locale of ['es', 'en']) {
    const cases = [
      ['articulos', 'og-score-preludes.png'],
      ['articulo-carcassi', 'og-score-carcassi.png'],
      ['articulo-preludios-carcassi', 'og-score-preludes.png'],
      ['crear-tablaturas-de-guitarra', 'og-tab-editor.png'],
      ['identificar-acordes-por-notas', `og-note-finder-${locale}.png`],
      ['circulo-de-quintas', `og-fifths-${locale}.png`],
    ];
    for (const [slug, image] of cases) {
      const file = pagePath(slug, locale).slice(1) + '.html';
      const html = fs.readFileSync(path.join(DIST, file), 'utf8');
      const og = html.match(/property="og:image" content="([^"]+)"/)[1];
      const twitter = html.match(/name="twitter:image" content="([^"]+)"/)[1];
      assert.ok(og.endsWith('/assets/' + image), file + ': ' + og);
      assert.equal(twitter, og, file);
      if (html.includes('type="application/ld+json"')) {
        ldOf(file).graph.filter((n) => n.image).forEach((n) => assert.equal(n.image, og, file));
      }
      const png = fs.readFileSync(path.join(DIST, 'assets', image));
      assert.equal(png.subarray(1, 4).toString(), 'PNG');
      assert.equal(png.readUInt32BE(16), 1200);
      assert.equal(png.readUInt32BE(20), 630);
    }
  }
  for (const file of fs.readdirSync(DIST, { recursive: true }).filter((f) => f.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(DIST, file), 'utf8');
    const og = html.match(/property="og:image" content="([^"]+)"/);
    if (!og) continue;
    const home = ['index.html', 'en.html', 'en/index.html'].includes(file);
    assert.equal(og[1].endsWith('/assets/og-image.png'), home, file);
  }
});

test('home y guias generadas emiten JSON-LD con canonica e idioma de la pagina', () => {
  const files = ['index.html', 'en.html', 'v7.html', 'en/v7-minor.html', 'acordes-mayores-y-sus-notas.html',
    'acordes-disminuidos.html', 'en/diminished-chords.html', 'punteo-terceras-sextas-decimas.html',
    'en/picking-thirds-sixths-tenths.html'];
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

test('una pagina-herramienta es WebApplication con migas y FAQPage sin HTML', () => {
  const graph = toolJsonLd({ ...es, url: BASE + '/tab', name: 'Tab', faq: [{ q: '¿<em>Se</em> guarda?', a: 'Sí, en tu <strong>navegador</strong>.' }] })['@graph'];
  const app = graph.find((n) => n['@type'] === 'WebApplication');
  const faq = graph.find((n) => n['@type'] === 'FAQPage');
  assert.equal(app.url, BASE + '/tab');
  assert.equal(app.applicationCategory, 'MusicApplication');
  assert.ok(graph.some((n) => n['@type'] === 'BreadcrumbList'));
  assert.equal(faq.mainEntity[0].name, '¿Se guarda?');
  assert.equal(faq.mainEntity[0].acceptedAnswer.text, 'Sí, en tu navegador.');
});

test('partitura-y-tablatura: vista previa con el banner de la home y FAQPage (si se genero)', (t) => {
  const file = path.join(DIST, 'partitura-y-tablatura.html');
  if (!fs.existsSync(file)) return t.skip('la pagina solo se genera con PARTITURA_API_URL');
  ['partitura-y-tablatura.html', 'en/partitura-y-tablatura.html'].forEach((f) => {
    const html = fs.readFileSync(path.join(DIST, f), 'utf8');
    const lang = html.match(/<html lang="(\w+)"/)[1];
    assert.match(html, new RegExp('property="og:image" content="[^"]+/assets/og-partitura-' + lang + '\\.png"'), f);
    assert.match(html, /name="twitter:card" content="summary_large_image"/, f);
    assert.ok(fs.existsSync(path.join(DIST, 'assets', 'og-partitura-' + lang + '.png')), f);
    const { graph } = ldOf(f);
    const kinds = graph.map((n) => n['@type']);
    assert.ok(kinds.includes('WebApplication') && kinds.includes('FAQPage'), f);
  });
});
