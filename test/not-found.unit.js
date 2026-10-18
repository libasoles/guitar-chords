const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// GitHub Pages serves this same document at any missing URL, including
// directories. Resource URLs must resolve correctly at the requested URL.
const DIST = path.join(__dirname, '..', 'dist', 'site');
const html = fs.readFileSync(path.join(DIST, '404.html'), 'utf8');

for (const pathname of ['/canciones', '/canciones/', '/en/missing/page/']) {
  test(`404: los recursos existen al abrir ${pathname}`, () => {
    const links = [...html.matchAll(/<link\b[^>]*href="([^"]+)"/g)];
    assert.ok(links.length > 0);
    for (const [, href] of links) {
      const url = new URL(href, 'https://acordesdeguitarra.com.ar' + pathname);
      assert.ok(url.pathname.startsWith('/assets/'), url.pathname);
      assert.ok(fs.existsSync(path.join(DIST, url.pathname)), url.pathname);
    }
    assert.match(html, /<h1>Página no encontrada<\/h1>/);
    assert.match(html, /name="robots" content="noindex"/);
  });
}
