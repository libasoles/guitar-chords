'use strict';
const assert = require('node:assert/strict');
const { pagePath } = require('../scripts/lib/slugs');
const progressive = require('../scripts/lib/article-carcassi-progressive');
const { run, checkCollection, checkLateralNav } = require('./articles-harness');

run('articles-progresivas', async (env) => {
  const published = progressive.publishedPieces();
  await checkCollection(env, {
    slug: 'articulo-piezas-progresivas-carcassi',
    published,
    titles: (locale, published) => published.map((p) => new RegExp('^' + (locale === 'es' ? 'Pieza ' : 'Piece ') + p.number + ': ')),
    firstSrc: /\/full\/progressive-01-p1(?:\.[a-f0-9]+)?\.svg$/,
    download: true,
    extra: async (page, locale) => {
      assert.equal(await page.locator('main a[href="' + pagePath('articulo-preludios-carcassi', locale) + '"]').count(), 1);
    },
  });
  await checkLateralNav(env, 'articulo-piezas-progresivas-carcassi');
});
