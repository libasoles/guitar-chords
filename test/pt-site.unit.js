/* Sitio en portugues (pt-BR) sobre dist/site. Run: node --test test/pt-site.unit.js (tras npm run build:site) */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SLUGS, pagePath, pageFile } = require('../scripts/lib/slugs');
const { isTranslated } = require('../scripts/lib/translations');
const { LOCALE_CODES, localeConfig } = require('../scripts/lib/locales');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist', 'site');
const BASE = 'https://acordesdeguitarra.com.ar';
const read = (file) => fs.readFileSync(path.join(DIST, file), 'utf8');

const PARTITURA_PUBLISHED = fs.existsSync(path.join(DIST, pageFile('partitura-y-tablatura', 'es')));
const optionalKeys = new Set(PARTITURA_PUBLISHED ? [] : ['partitura-y-tablatura']);
/* Paginas ocultas: noindex y fuera del sitemap. */
const hiddenKeys = new Set(['articulo-favoritas']);
/* Paginas de herramientas (no articulos) que existen en es. */
const toolKeys = Object.keys(SLUGS).filter((key) => isTranslated(key, 'pt') && fs.existsSync(path.join(DIST, pageFile(key, 'es'))));
const ptFiles = ['pt.html', 'pt/index.html', ...toolKeys.map((key) => pageFile(key, 'pt'))];

function htmlFiles() {
  return ptFiles.filter((file) => fs.existsSync(path.join(DIST, file)));
}

test('el catalogo pt tiene exactamente las mismas claves que es y en', () => {
  const keys = (locale) => Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'i18n', 'strings.' + locale + '.json'), 'utf8')));
  assert.deepEqual(keys('pt'), keys('es'));
  assert.deepEqual(keys('en'), keys('es'));
});

test('cada pagina es/en publicada tiene su par /pt/', () => {
  assert.ok(toolKeys.length > 10);
  toolKeys.filter((key) => !optionalKeys.has(key)).forEach((key) => {
    assert.ok(fs.existsSync(path.join(DIST, pageFile(key, 'pt'))), key);
  });
  assert.ok(fs.existsSync(path.join(DIST, 'pt.html')));
  assert.ok(fs.existsSync(path.join(DIST, 'pt', 'index.html')));
});

test('las paginas pt declaran lang pt-BR, canonical propio y hreflang es, en, pt-BR y x-default', () => {
  htmlFiles().forEach((file) => {
    const html = read(file);
    assert.match(html, /<html lang="pt-BR"/, file);
    const canonical = html.match(/rel="canonical" href="([^"]+)"/)[1];
    assert.ok(canonical.startsWith(BASE + '/pt'), file + ' ' + canonical);
    const alternates = [...html.matchAll(/rel="alternate" hreflang="([\w-]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]]);
    assert.deepEqual(alternates.map((a) => a[0]), ['es', 'en', 'pt-BR', 'x-default'], file);
    assert.equal(alternates.find((a) => a[0] === 'pt-BR')[1], canonical, file + ' se apunta a si misma');
    assert.equal(alternates[3][1], alternates[1][1], file + ' x-default es el ingles');
  });
});

test('hreflang es recíproco: cada alternativa existe y declara las mismas', () => {
  const fileForUrl = (url) => {
    const p = url.slice(BASE.length);
    if (p === '/' || p === '') return 'index.html';
    if (p === '/en' || p === '/pt') return p.slice(1) + '.html';
    return p.slice(1) + '.html';
  };
  htmlFiles().forEach((file) => {
    const own = [...read(file).matchAll(/rel="alternate" hreflang="([\w-]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]]);
    own.forEach(([, href]) => {
      assert.ok(fs.existsSync(path.join(DIST, fileForUrl(href))), href);
      const back = [...read(fileForUrl(href)).matchAll(/rel="alternate" hreflang="([\w-]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]]);
      assert.deepEqual(back, own, 'hreflang de ' + href);
    });
  });
});

test('el sitemap lista las URL pt con sus alternativas', () => {
  const xml = read('sitemap.xml');
  const entries = [...xml.matchAll(/<url>(.*?)<\/url>/gs)].map((m) => ({
    loc: m[1].match(/<loc>(.*?)<\/loc>/)[1],
    alternates: [...m[1].matchAll(/hreflang="([\w-]+)" href="([^"]+)"/g)].map((a) => a[1]),
  }));
  const locs = entries.map((e) => e.loc);
  assert.ok(locs.includes(BASE + '/pt'));
  toolKeys.filter((key) => !optionalKeys.has(key) && !hiddenKeys.has(key)).forEach((key) => {
    assert.ok(locs.includes(BASE + pagePath(key, 'pt')), key);
  });
  entries.filter((e) => e.loc.includes('/pt')).forEach((e) => assert.deepEqual(e.alternates, ['es', 'en', 'pt-BR'], e.loc));
});

test('los enlaces internos de las paginas pt existen', () => {
  const missing = [];
  htmlFiles().forEach((file) => {
    [...read(file).matchAll(/<a [^>]*href="(\/[^"#?]*)"/g)].forEach((m) => {
      const href = m[1];
      if (href === '/') return;
      if (href.startsWith('/assets/') || href.startsWith('/store/')) return;
      const target = href.replace(/^\//, '');
      if (!fs.existsSync(path.join(DIST, target + '.html')) && !fs.existsSync(path.join(DIST, target))) missing.push(file + ' -> ' + href);
    });
  });
  assert.deepEqual(missing, []);
});

/* Palabras que no existen en portugues y delatan texto en espanol o ingles. */
const SPANISH = /(?<![\w\u00C0-\u017F-])(los|las|una|con|del|para el|para la|también|cuando|donde|mejor|tu|tus|hacé|hacer|cuerda|cuerdas)(?![\w\u00C0-\u017F-])/i;
const ENGLISH = /(?<![\w-])(the|and|with|your|you|from|this|that|are|click|chords?|strings?|frets?|open)(?![\w-])/i;

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<cite>[\s\S]*?<\/cite>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/g, ' ')
    .replace(/\s+/g, ' ');
}

test('las paginas pt no contienen texto en espanol ni en ingles', () => {
  const leaks = [];
  htmlFiles().forEach((file) => {
    const text = visibleText(read(file));
    const es = text.match(SPANISH);
    const en = text.match(ENGLISH);
    if (es) leaks.push(file + ' es: ' + text.slice(Math.max(0, es.index - 40), es.index + 40));
    if (en) leaks.push(file + ' en: ' + text.slice(Math.max(0, en.index - 40), en.index + 40));
  });
  assert.deepEqual(leaks, []);
});

test('el idioma pt esta registrado una sola vez con prefijo /pt', () => {
  assert.ok(LOCALE_CODES.includes('pt'));
  assert.equal(localeConfig('pt').htmlLang, 'pt-BR');
  assert.equal(pagePath('v7', 'pt'), '/pt/v7');
});
