'use strict';
/* Site-wide article checks that read the built files: the home pages link to
   the section only from the hamburger menu, and the sitemap lists the articles. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pagePath } = require('../scripts/lib/slugs');
const { run } = require('./articles-harness');

run('articles-site', async ({ DIST, BASE_URL }) => {
  for (const file of ['index.html', 'en.html']) {
    const html = fs.readFileSync(path.join(DIST, file), 'utf8');
    const locale = file === 'en.html' ? 'en' : 'es';
    const outsideMenu = html.replace(/<details class="site-menu">[\s\S]*?<\/details>/, '');
    assert.ok(html.includes('href="' + pagePath('articulo-carcassi', locale) + '"'), file + ' no enlaza a los articulos desde el menu');
    assert.ok(!/href="[^"]*(articulo|article)/.test(outsideMenu), file + ' enlaza a los articulos fuera del menu');
  }
  const sitemap = fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8');
  ['articulos', 'articulo-carcassi', 'articulo-preludios-carcassi', 'articulo-preludios-santisteban', 'articulo-tablaturas-arpegios'].forEach((key) => ['es', 'en'].forEach((locale) => {
    assert.ok(sitemap.includes('<loc>' + BASE_URL + pagePath(key, locale) + '</loc>'), key + ' ' + locale);
  }));

  // Sitemap entries carry the es/en hreflang pair.
  const esUrl = BASE_URL + pagePath('articulo-carcassi', 'es');
  const enUrl = BASE_URL + pagePath('articulo-carcassi', 'en');
  const entry = sitemap.split('<url>').find((chunk) => chunk.includes('<loc>' + esUrl + '</loc>'));
  assert.ok(entry.includes('hreflang="es" href="' + esUrl + '"') && entry.includes('hreflang="en" href="' + enUrl + '"'));
});
