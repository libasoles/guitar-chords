/* Selector de idioma del menu en dist/site. Run: node --test test/language-selector.unit.js (tras npm run build:site) */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SLUGS, pagePath, pageFile } = require('../scripts/lib/slugs');
const { isTranslated } = require('../scripts/lib/translations');
const { publishedLocales } = require('../scripts/lib/locales');

const DIST = path.join(__dirname, '..', 'dist', 'site');

function allHtml(dir = DIST, out = []) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'assets' && entry.name !== 'store') allHtml(full, out);
    } else if (entry.name.endsWith('.html')) out.push(path.relative(DIST, full).split(path.sep).join('/'));
  });
  return out;
}

function selector(file) {
  const html = fs.readFileSync(path.join(DIST, file), 'utf8');
  const block = html.match(/<div class="site-menu-language-links">(.*?)<\/div>/s);
  if (!block) return null;
  return [...block[1].matchAll(/<a href="([^"]+)" lang="([^"]+)" hreflang="([^"]+)"( aria-current="true")?>([^<]+)<\/a>/g)]
    .map((m) => ({ href: m[1], lang: m[2], current: !!m[4], label: m[5] }));
}

test('toda pagina con menu tiene el selector con es, en y pt', () => {
  const withMenu = allHtml().filter((file) => fs.readFileSync(path.join(DIST, file), 'utf8').includes('class="site-menu"'));
  assert.ok(withMenu.length > 50);
  withMenu.forEach((file) => {
    const links = selector(file);
    assert.ok(links, file);
    assert.deepEqual(links.map((l) => l.lang), ['es', 'en', 'pt-BR'], file);
    assert.deepEqual(links.map((l) => l.label), ['Español', 'English', 'Português'], file);
    assert.equal(links.filter((l) => l.current).length, 1, file);
  });
});

test('cada idioma apunta a la pagina equivalente', () => {
  const codes = publishedLocales().map((l) => l.code);
  Object.keys(SLUGS).forEach((key) => {
    codes.filter((code) => isTranslated(key, code) && fs.existsSync(path.join(DIST, pageFile(key, code)))).forEach((from) => {
      const links = selector(pageFile(key, from));
      if (!links) return; // el editor de partitura es una app sin menu
      codes.forEach((to, i) => {
        const expected = isTranslated(key, to) ? pagePath(key, to) : null;
        if (expected) assert.equal(links[i].href, expected, key + ' ' + from + ' -> ' + to);
      });
      assert.ok(links[codes.indexOf(from)].current, key + ' ' + from);
    });
  });
});

test('el inicio y el 404 enlazan al inicio de cada idioma', () => {
  ['index.html', 'en.html', 'pt.html', '404.html'].forEach((file) => {
    assert.deepEqual(selector(file).map((l) => l.href), ['/', '/en', '/pt'], file);
  });
});

test('un articulo sin traducir enlaza al inicio del idioma que le falta', () => {
  const key = 'articulo-carcassi';
  if (isTranslated(key, 'pt')) return;
  const links = selector(pageFile(key, 'es'));
  assert.equal(links[1].href, pagePath(key, 'en'));
  assert.equal(links[2].href, '/pt');
});
