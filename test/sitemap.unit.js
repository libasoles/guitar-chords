/* Sitemap e hreflang sobre dist/site. Run: node --test test/sitemap.unit.js (tras npm run build:site) */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { legacyEnglishRedirects } = require('../scripts/lib/slugs');

const DIST = path.join(__dirname, '..', 'dist', 'site');
const BASE = 'https://acordesdeguitarra.com.ar';

function fileForUrl(url) {
  assert.ok(url.startsWith(BASE), url);
  const p = url.slice(BASE.length);
  if (p === '/' || p === '') return 'index.html';
  if (p === '/en') return 'en.html';
  return p.endsWith('.html') ? p.slice(1) : p.slice(1) + '.html';
}

const xml = fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8');
const entries = [...xml.matchAll(/<url>(.*?)<\/url>/gs)].map((m) => ({
  loc: m[1].match(/<loc>(.*?)<\/loc>/)[1],
  alternates: [...m[1].matchAll(/hreflang="(\w+)" href="([^"]+)"/g)].map((a) => [a[1], a[2]]),
}));

test('cada loc del sitemap existe en dist', () => {
  assert.ok(entries.length > 0);
  entries.forEach((e) => assert.ok(fs.existsSync(path.join(DIST, fileForUrl(e.loc))), e.loc));
});

test('cada hreflang apunta a una pagina existente que se apunta de vuelta', () => {
  const html = (url) => fs.readFileSync(path.join(DIST, fileForUrl(url)), 'utf8');
  entries.filter((e) => e.alternates.length).forEach((e) => {
    assert.deepEqual(e.alternates.map((a) => a[0]), ['es', 'en'], e.loc);
    e.alternates.forEach(([, href]) => {
      assert.ok(fs.existsSync(path.join(DIST, fileForUrl(href))), href);
      const back = [...html(href).matchAll(/rel="alternate" hreflang="(\w+)" href="([^"]+)"/g)].map((a) => [a[1], a[2]]);
      assert.deepEqual(back, e.alternates, 'hreflang de ' + href);
    });
  });
});

test('las URL inglesas viejas redirigen con noindex y no estan en el sitemap', () => {
  legacyEnglishRedirects().forEach((r) => {
    const file = path.join(DIST, r.file);
    if (!fs.existsSync(file)) return; // p. ej. Partitura sin publicar
    const html = fs.readFileSync(file, 'utf8');
    assert.ok(html.includes('rel="canonical" href="' + BASE + r.to + '"'), r.file);
    assert.ok(html.includes('noindex'), r.file);
    assert.ok(fs.existsSync(path.join(DIST, fileForUrl(BASE + r.to))), r.to);
    assert.ok(!xml.includes(r.file.replace(/\.html$/, '') .replace(/^en\//, '/en/') + '<'), r.file);
  });
});

test('/en/privacy-policy no choca con store/privacy-policy.html', () => {
  assert.ok(fs.existsSync(path.join(DIST, 'en', 'privacy-policy.html')));
  assert.ok(fs.existsSync(path.join(DIST, 'store', 'privacy-policy.html')));
});
